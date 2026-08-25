import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RealtimeMessage } from "./protocol";
import { useRealtime } from "./useRealtime";
import { DraggableCallDock } from "./components/DraggableCallDock";
import { VideoTile } from "./components/VideoTile";
import { useStay } from "./stay";
import { getCallStream, iceConfig, parseIce, stopStream } from "./webrtc";

export type CallStatus = "off" | "need" | "ready" | "denied";

type Remote = {
  id: string;
  stream: MediaStream | null;
};

type ExamCallProps = {
  active: boolean;
  onStatus: (status: CallStatus) => void;
  onSession?: () => void;
};

export function ExamCall({ active, onStatus, onSession }: ExamCallProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const localRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const waitingMonitors = useRef(new Set<string>());
  const sendRef = useRef<(message: RealtimeMessage) => void>(() => undefined);
  const onStatusRef = useRef(onStatus);
  const onSessionRef = useRef(onSession);
  const deniedRef = useRef(false);
  onStatusRef.current = onStatus;
  onSessionRef.current = onSession;

  const { connected, send } = useRealtime("candidate", (message) => {
    if (message.type === "qcm.changed") {
      onSessionRef.current?.();
      return;
    }
    if (message.type === "qcm.call.denied") {
      deniedRef.current = true;
      onStatusRef.current("denied");
      return;
    }
    if (message.type === "qcm.call.peers") {
      for (const id of message.monitorIds) void offerTo(id);
      return;
    }
    if (message.type === "qcm.call.ready" && message.monitorId) {
      void offerTo(message.monitorId);
      return;
    }
    if (message.type === "qcm.call.answer" && message.from) {
      void applyAnswer(message.from, message.sdp);
      return;
    }
    if (message.type === "qcm.call.ice" && message.from) {
      void applyIce(message.from, message.candidate);
      return;
    }
    if (message.type === "qcm.call.hangup" && message.from) {
      closePeer(message.from);
    }
  });
  sendRef.current = send;
  const { setAwayReporter } = useStay();
  useEffect(() => {
    setAwayReporter((away) => send({ type: "qcm.presence", away }));
    return () => setAwayReporter(null);
  }, [send, setAwayReporter]);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    if (!active || deniedRef.current || !localRef.current) return;
    if (connected) onStatusRef.current("ready");
  }, [active, connected]);

  function closePeer(id: string) {
    const pc = pcs.current.get(id);
    pc?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    waitingMonitors.current.delete(id);
    setRemotes((prev) => prev.filter((item) => item.id !== id));
  }

  function closeAll() {
    for (const id of [...pcs.current.keys()]) closePeer(id);
    waitingMonitors.current.clear();
  }

  async function flushIce(id: string, pc: RTCPeerConnection) {
    const queued = pendingIce.current.get(id) ?? [];
    pendingIce.current.delete(id);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore late candidates
      }
    }
  }

  async function applyIce(id: string, raw: string) {
    const candidate = parseIce(raw);
    if (!candidate) return;
    const pc = pcs.current.get(id);
    if (!pc?.remoteDescription) {
      const queued = pendingIce.current.get(id) ?? [];
      queued.push(candidate);
      pendingIce.current.set(id, queued);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // ignore
    }
  }

  async function applyAnswer(id: string, sdp: string) {
    const pc = pcs.current.get(id);
    if (!pc) return;
    await pc.setRemoteDescription({ type: "answer", sdp });
    await flushIce(id, pc);
  }

  async function offerTo(monitorId: string) {
    const stream = localRef.current;
    if (!stream) {
      waitingMonitors.current.add(monitorId);
      return;
    }
    if (pcs.current.has(monitorId)) return;
    const pc = new RTCPeerConnection(iceConfig);
    pcs.current.set(monitorId, pc);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendRef.current({
        type: "qcm.call.ice",
        to: monitorId,
        candidate: JSON.stringify(event.candidate.toJSON()),
      });
    };
    pc.ontrack = (event) => {
      const media = event.streams[0];
      if (!media) return;
      setRemotes((prev) => {
        const rest = prev.filter((item) => item.id !== monitorId);
        return [...rest, { id: monitorId, stream: media }];
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        if (pc.connectionState === "disconnected") return;
        closePeer(monitorId);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendRef.current({ type: "qcm.call.offer", to: monitorId, sdp: offer.sdp ?? "" });
  }

  useEffect(() => {
    if (!active) {
      onStatusRef.current("off");
      return;
    }
    let cancelled = false;
    deniedRef.current = false;
    onStatusRef.current("need");
    void (async () => {
      try {
        const stream = await getCallStream();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        localRef.current = stream;
        setLocal(stream);
        if (connectedRef.current && !deniedRef.current) onStatusRef.current("ready");
        for (const id of [...waitingMonitors.current]) {
          waitingMonitors.current.delete(id);
          await offerTo(id);
        }
      } catch {
        if (!cancelled) onStatusRef.current("denied");
      }
    })();
    return () => {
      cancelled = true;
      sendRef.current({ type: "qcm.call.hangup" });
      closeAll();
      stopStream(localRef.current);
      localRef.current = null;
      setLocal(null);
      setRemotes([]);
    };
  }, [active]);

  if (!active) return null;

  return (
    <DraggableCallDock label={t("qcm.callTitle")}>
      {remotes.map((peer) => (
        <VideoTile key={peer.id} stream={peer.stream} label={t("qcm.proctor")} />
      ))}
      <VideoTile stream={local} muted mirror label={t("qcm.you")} className="is-self" />
    </DraggableCallDock>
  );
}

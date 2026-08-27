import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RealtimeMessage } from "./protocol";
import { useRealtime } from "./useRealtime";
import { DraggableCallDock } from "./components/DraggableCallDock";
import { VideoTile } from "./components/VideoTile";
import { useStay } from "./stay";
import { canShareScreen, getCallStream, getScreenStream, iceConfig, parseIce, stopStream } from "./webrtc";

export type CallStatus = "off" | "need" | "ready" | "denied" | "screen";

export type ExamCallHandle = {
  shareScreen: () => Promise<void>;
};

type ExamCallProps = {
  active: boolean;
  onStatus: (status: CallStatus) => void;
  onSession?: () => void;
};

function preferAutoScreenShare() {
  if (typeof window === "undefined" || !canShareScreen()) return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return !coarse && !touch;
}

export const ExamCall = forwardRef<ExamCallHandle, ExamCallProps>(function ExamCall(
  { active, onStatus, onSession },
  ref,
) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<MediaStream | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const waitingMonitors = useRef(new Set<string>());
  const sendRef = useRef<(message: RealtimeMessage) => void>(() => undefined);
  const onStatusRef = useRef(onStatus);
  const onSessionRef = useRef(onSession);
  const deniedRef = useRef(false);
  const { reportAway, setAwayReporter } = useStay();
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
  useEffect(() => {
    setAwayReporter((away) => send({ type: "qcm.presence", away }));
    return () => setAwayReporter(null);
  }, [send, setAwayReporter]);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    if (!active || deniedRef.current || !localRef.current || !screenRef.current) return;
    if (connected) onStatusRef.current("ready");
  }, [active, connected]);

  function closePeer(id: string) {
    const pc = pcs.current.get(id);
    pc?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    waitingMonitors.current.delete(id);
  }

  function closeAll() {
    for (const id of [...pcs.current.keys()]) closePeer(id);
    waitingMonitors.current.clear();
  }

  function markReady() {
    if (deniedRef.current) return;
    if (localRef.current && screenRef.current) {
      onStatusRef.current(connectedRef.current ? "ready" : "need");
      if (connectedRef.current) onStatusRef.current("ready");
    }
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

  async function attachScreen(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.contentHint = "detail";
    track.onended = () => {
      stopStream(screenRef.current);
      screenRef.current = null;
      reportAway(true);
      onStatusRef.current("screen");
    };
    const previous = screenRef.current;
    screenRef.current = stream;
    const cameraTrack = localRef.current?.getVideoTracks()[0] ?? null;
    for (const [monitorId, pc] of pcs.current.entries()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video" && item.track !== cameraTrack);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendRef.current({
          type: "qcm.call.offer",
          to: monitorId,
          sdp: offer.sdp ?? "",
          screenStreamId: stream.id,
        });
      }
    }
    if (previous && previous !== stream) stopStream(previous);
    reportAway(false);
    markReady();
    for (const id of [...waitingMonitors.current]) {
      waitingMonitors.current.delete(id);
      await offerTo(id);
    }
  }

  async function offerTo(monitorId: string) {
    const camera = localRef.current;
    const screen = screenRef.current;
    if (!camera || !screen) {
      waitingMonitors.current.add(monitorId);
      return;
    }
    if (pcs.current.has(monitorId)) return;
    const pc = new RTCPeerConnection(iceConfig);
    pcs.current.set(monitorId, pc);
    camera.getTracks().forEach((track) => pc.addTrack(track, camera));
    screen.getTracks().forEach((track) => pc.addTrack(track, screen));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendRef.current({
        type: "qcm.call.ice",
        to: monitorId,
        candidate: JSON.stringify(event.candidate.toJSON()),
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        closePeer(monitorId);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendRef.current({
      type: "qcm.call.offer",
      to: monitorId,
      sdp: offer.sdp ?? "",
      screenStreamId: screen.id,
    });
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
        onStatusRef.current("screen");
        if (!preferAutoScreenShare()) return;
        try {
          const screen = await getScreenStream();
          if (cancelled) {
            stopStream(screen);
            return;
          }
          await attachScreen(screen);
        } catch {
          if (!cancelled) onStatusRef.current("screen");
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
      stopStream(screenRef.current);
      localRef.current = null;
      screenRef.current = null;
      setLocal(null);
    };
  }, [active]);

  async function shareScreen() {
    if (!active || deniedRef.current || !localRef.current) return;
    try {
      const screen = await getScreenStream();
      await attachScreen(screen);
    } catch {
      onStatusRef.current("screen");
    }
  }

  useImperativeHandle(ref, () => ({ shareScreen }));

  if (!active) return null;

  return (
    <DraggableCallDock label={t("qcm.callTitle")}>
      <VideoTile stream={local} muted mirror label={t("qcm.you")} className="is-self" />
    </DraggableCallDock>
  );
});

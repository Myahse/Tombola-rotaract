import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimeMessage } from "./protocol";
import { getCallStream, iceConfig, parseIce, stopStream } from "./webrtc";

export type CallPeer = {
  peerId: string;
  memberId: string;
  name: string;
  stream: MediaStream | null;
  screen: MediaStream | null;
};

type RealtimeApi = {
  connected: boolean;
  send: (message: RealtimeMessage) => void;
  subscribe: (fn: (message: RealtimeMessage) => void) => () => void;
};

type CallMedia = {
  local: MediaStream | null;
  remotes: CallPeer[];
  camera: "need" | "ready" | "denied" | "off";
  hangUp: () => void;
  startCall: () => Promise<void>;
};

const RealtimeCtx = createContext<RealtimeApi | null>(null);
const CallMediaCtx = createContext<CallMedia>({
  local: null,
  remotes: [],
  camera: "need",
  hangUp: () => undefined,
  startCall: async () => undefined,
});

export function useRealtimeApi() {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) throw new Error("useRealtimeApi must be used within LiveProvider");
  return ctx;
}

export function useCallMedia() {
  return useContext(CallMediaCtx);
}

export function RealtimeBusProvider({
  value,
  children,
}: {
  value: RealtimeApi;
  children: ReactNode;
}) {
  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

export function MonitorCallProvider({ children }: { children: ReactNode }) {
  const { send, subscribe } = useRealtimeApi();
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<CallPeer[]>([]);
  const [camera, setCamera] = useState<CallMedia["camera"]>("need");
  const localRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const pendingOffers = useRef<Extract<RealtimeMessage, { type: "qcm.call.offer" }>[]>([]);
  const meta = useRef(new Map<string, { memberId: string; name: string; screenStreamId?: string }>());
  const mediaSettled = useRef(false);
  const liveRef = useRef(true);
  const sendRef = useRef(send);
  sendRef.current = send;

  function closePeer(id: string) {
    const pc = pcs.current.get(id);
    pc?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    meta.current.delete(id);
    setRemotes((prev) => prev.filter((item) => item.peerId !== id));
  }

  async function flushIce(id: string, pc: RTCPeerConnection) {
    const queued = pendingIce.current.get(id) ?? [];
    pendingIce.current.delete(id);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
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

  const answerOffer = useCallback(async (message: Extract<RealtimeMessage, { type: "qcm.call.offer" }>) => {
    const from = message.from;
    if (!from || !message.sdp) return;
    const existing = pcs.current.get(from);
    if (existing) {
      existing.onconnectionstatechange = null;
      existing.close();
      pcs.current.delete(from);
    }
    const pc = new RTCPeerConnection(iceConfig);
    pcs.current.set(from, pc);
    const info = {
      memberId: message.memberId ?? from,
      name: message.name || "Candidate",
      screenStreamId: message.screenStreamId,
    };
    meta.current.set(from, info);
    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current as MediaStream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendRef.current({
        type: "qcm.call.ice",
        to: from,
        candidate: JSON.stringify(event.candidate.toJSON()),
      });
    };
    pc.ontrack = (event) => {
      const media = event.streams[0];
      if (!media) return;
      const current = meta.current.get(from) ?? info;
      const isScreen =
        event.track.kind === "video" &&
        Boolean(current.screenStreamId) &&
        media.id === current.screenStreamId;
      setRemotes((prev) => {
        const existing = prev.find((item) => item.peerId === from);
        const base = existing ?? {
          peerId: from,
          memberId: current.memberId,
          name: current.name,
          stream: null,
          screen: null,
        };
        const rest = prev.filter((item) => item.peerId !== from);
        if (isScreen) return [...rest, { ...base, memberId: current.memberId, name: current.name, screen: media }];
        return [...rest, { ...base, memberId: current.memberId, name: current.name, stream: media }];
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        closePeer(from);
      }
    };
    await pc.setRemoteDescription({ type: "offer", sdp: message.sdp });
    await flushIce(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendRef.current({ type: "qcm.call.answer", to: from, sdp: answer.sdp ?? "" });
    setRemotes((prev) => {
      if (prev.some((item) => item.peerId === from)) return prev;
      return [...prev, { peerId: from, memberId: info.memberId, name: info.name, stream: null, screen: null }];
    });
  }, []);

  useEffect(() => {
    return subscribe((message) => {
      if (message.type === "qcm.call.offer") {
        if (!liveRef.current) return;
        if (!mediaSettled.current) {
          pendingOffers.current.push(message);
          return;
        }
        void answerOffer(message);
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
  }, [subscribe, answerOffer]);

  const hangUp = useCallback(() => {
    liveRef.current = false;
    pendingOffers.current = [];
    sendRef.current({ type: "qcm.call.hangup" });
    for (const id of [...pcs.current.keys()]) closePeer(id);
    stopStream(localRef.current);
    localRef.current = null;
    setLocal(null);
    setRemotes([]);
    setCamera("off");
  }, []);

  const startCall = useCallback(async () => {
    if (liveRef.current && localRef.current) return;
    liveRef.current = true;
    setCamera("need");
    try {
      const stream = await getCallStream();
      if (!liveRef.current) {
        stopStream(stream);
        return;
      }
      localRef.current = stream;
      setLocal(stream);
      mediaSettled.current = true;
      setCamera("ready");
      sendRef.current({ type: "qcm.call.ready" });
    } catch {
      if (liveRef.current) setCamera("denied");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    liveRef.current = true;
    setCamera("need");
    void (async () => {
      try {
        const stream = await getCallStream();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        localRef.current = stream;
        setLocal(stream);
        mediaSettled.current = true;
        setCamera("ready");
        const queued = pendingOffers.current;
        pendingOffers.current = [];
        for (const offer of queued) await answerOffer(offer);
      } catch {
        if (!cancelled) {
          mediaSettled.current = true;
          setCamera("denied");
          const queued = pendingOffers.current;
          pendingOffers.current = [];
          for (const offer of queued) await answerOffer(offer);
        }
      }
    })();
    return () => {
      cancelled = true;
      liveRef.current = false;
      mediaSettled.current = false;
      sendRef.current({ type: "qcm.call.hangup" });
      for (const id of [...pcs.current.keys()]) closePeer(id);
      stopStream(localRef.current);
      localRef.current = null;
      setLocal(null);
      setRemotes([]);
    };
  }, [answerOffer]);

  const value = useMemo(
    () => ({ local, remotes, camera, hangUp, startCall }),
    [local, remotes, camera, hangUp, startCall],
  );
  return <CallMediaCtx.Provider value={value}>{children}</CallMediaCtx.Provider>;
}

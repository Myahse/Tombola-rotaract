export const iceConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function parseIce(candidate: string): RTCIceCandidateInit | null {
  try {
    const value = JSON.parse(candidate) as RTCIceCandidateInit;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export async function getCallStream() {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  });
}

export function remoteStreamFromEvent(event: RTCTrackEvent) {
  const media = event.streams[0] ?? new MediaStream([event.track]);
  if (!media.getTracks().includes(event.track)) media.addTrack(event.track);
  return media;
}

export async function attachLocalStream(pc: RTCPeerConnection, stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    const transceiver =
      pc.getTransceivers().find((item) => {
        const kind = item.receiver.track?.kind ?? item.sender.track?.kind;
        return kind === track.kind && !item.sender.track;
      }) ??
      pc.getTransceivers().find((item) => {
        const kind = item.receiver.track?.kind ?? item.sender.track?.kind;
        return kind === track.kind;
      });
    if (transceiver) {
      await transceiver.sender.replaceTrack(track);
      transceiver.direction = "sendrecv";
    } else {
      pc.addTrack(track, stream);
    }
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

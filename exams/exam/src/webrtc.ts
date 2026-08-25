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

export async function getScreenStream() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 8, max: 15 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      displaySurface: "monitor",
    } as MediaTrackConstraints,
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = "detail";
  return stream;
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

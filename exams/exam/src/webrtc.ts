export const iceConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 4,
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
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
  });
}

export function canShareScreen() {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

function hintScreen(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = "detail";
  return stream;
}

export async function getScreenStream() {
  if (!canShareScreen()) {
    throw new Error("screen_unsupported");
  }
  try {
    return hintScreen(
      await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: false,
      }),
    );
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "AbortError" || (error instanceof Error && error.message === "screen_unsupported")) {
      throw error;
    }
    return hintScreen(await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }));
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

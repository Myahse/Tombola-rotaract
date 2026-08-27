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

type DisplayCapture = (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;

type NavigatorCapture = Navigator & {
  getDisplayMedia?: DisplayCapture;
  webkitGetDisplayMedia?: DisplayCapture;
};

type MediaCapture = MediaDevices & {
  getDisplayMedia?: DisplayCapture;
  webkitGetDisplayMedia?: DisplayCapture;
};

export function getDisplayMediaFn(): DisplayCapture | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorCapture;
  const media = nav.mediaDevices as MediaCapture | undefined;
  const impl = media?.getDisplayMedia ?? media?.webkitGetDisplayMedia ?? nav.getDisplayMedia ?? nav.webkitGetDisplayMedia;
  if (typeof impl !== "function") return null;
  return impl.bind(media ?? nav);
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isIosSafari() {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Instagram|FBAN|FBAV|Line\//i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone);
}

export type ScreenShareAdvice = "ok" | "ios-safari" | "ios-app" | "insecure";

export function screenShareAdvice(): ScreenShareAdvice {
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure";
  if (isIosDevice() && isStandaloneApp()) return "ios-app";
  if (isIosDevice() && !isIosSafari()) return "ios-safari";
  return "ok";
}

function hintScreen(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = "detail";
  return stream;
}

export async function getScreenStream() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("screen_insecure");
  }
  const capture = getDisplayMediaFn();
  if (!capture) {
    throw new Error("screen_unsupported");
  }
  try {
    return hintScreen(await capture({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }));
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (
      name === "NotAllowedError" ||
      name === "AbortError" ||
      (error instanceof Error && (error.message === "screen_unsupported" || error.message === "screen_insecure"))
    ) {
      throw error;
    }
    return hintScreen(await capture({ video: true, audio: false }));
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

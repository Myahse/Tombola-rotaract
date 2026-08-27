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
  if (typeof media?.getDisplayMedia === "function") return media.getDisplayMedia.bind(media);
  if (typeof media?.webkitGetDisplayMedia === "function") return media.webkitGetDisplayMedia.bind(media);
  if (typeof nav.getDisplayMedia === "function") return nav.getDisplayMedia.bind(nav);
  if (typeof nav.webkitGetDisplayMedia === "function") return nav.webkitGetDisplayMedia.bind(nav);
  return null;
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

export function allowCameraOnlyProctoring() {
  if (typeof window === "undefined") return false;
  if (isIosDevice()) return true;
  if (!getDisplayMediaFn()) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return Boolean(coarse || touch);
}

function hintScreen(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = "detail";
  return stream;
}

type ShareOpts = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
};

export async function getScreenStream() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("screen_insecure");
  }
  const capture = getDisplayMediaFn();
  if (!capture) {
    throw new Error("screen_unsupported");
  }
  const tries: ShareOpts[] = [
    { video: true, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "exclude" },
    { video: true, audio: false },
  ];
  let lastError: unknown;
  for (const options of tries) {
    try {
      return hintScreen(await capture(options));
    } catch (error) {
      lastError = error;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "AbortError") throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("screen_unsupported");
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

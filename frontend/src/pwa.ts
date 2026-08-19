const INSTALL_DISMISS_KEY = "tombola.pwa.install.dismissed";
const NOTIFY_DISMISS_KEY = "tombola.pwa.notify.dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstall: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

function isSecureContextForPwa() {
  return window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice() {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function pushSupported() {
  return (
    isSecureContextForPwa() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function initPwa() {
  if (!("serviceWorker" in navigator) || !isSecureContextForPwa()) return;
  void navigator.serviceWorker.register("/sw.js");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    installListeners.forEach((listener) => listener());
  });
}

export function onInstallAvailable(listener: () => void) {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

export function canPromptInstall() {
  return Boolean(deferredInstall) && !isStandaloneDisplay();
}

export function installDismissed() {
  return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
}

export function dismissInstall() {
  localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  deferredInstall = null;
}

export async function promptInstall() {
  if (!deferredInstall) return false;
  const event = deferredInstall;
  deferredInstall = null;
  await event.prompt();
  const choice = await event.userChoice;
  if (choice.outcome === "accepted") {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    return true;
  }
  return false;
}

export function notifyDismissed() {
  return localStorage.getItem(NOTIFY_DISMISS_KEY) === "1";
}

export function dismissNotify() {
  localStorage.setItem(NOTIFY_DISMISS_KEY, "1");
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePush(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("invalid_subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function disablePush() {
  const subscription = await getPushSubscription();
  const endpoint = subscription?.endpoint;
  if (subscription) await subscription.unsubscribe();
  return endpoint;
}

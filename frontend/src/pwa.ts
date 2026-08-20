const INSTALL_DISMISS_KEY = "tombola.pwa.install.dismissed";
const NOTIFY_DISMISS_KEY = "tombola.pwa.notify.dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
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

export function notificationsAllowedHere() {
  return !isIosDevice() || isStandaloneDisplay();
}

export function initPwa() {
  if (!("serviceWorker" in navigator) || !isSecureContextForPwa()) return;
  void ensureServiceWorker();

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

export async function ensureServiceWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  if (registration.waiting) registration.waiting.postMessage("skipWaiting");
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return registration;
  await Promise.race([
    new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    }),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2500);
    }),
  ]);
  return registration;
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

export function pathFromAppUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return "/fr";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/fr";
  } catch {
    return "/fr";
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = current instanceof ArrayBuffer ? new Uint8Array(current) : new Uint8Array(current);
  if (bytes.length !== expected.length) return false;
  return bytes.every((value, index) => value === expected[index]);
}

function payloadFrom(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("invalid_subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await ensureServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function enablePush(publicKey: string) {
  if (!pushSupported()) return false;
  const registration = await ensureServiceWorker();
  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return false;

  const expected = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription, expected)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expected,
    });
  }
  return payloadFrom(subscription);
}

export async function disablePush() {
  const subscription = await getPushSubscription();
  const endpoint = subscription?.endpoint;
  if (subscription) await subscription.unsubscribe();
  return endpoint;
}

const INSTALL_DISMISS_KEY = "exam.pwa.install.dismissed";

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

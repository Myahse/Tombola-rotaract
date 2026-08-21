import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  canPromptInstall,
  dismissInstall,
  dismissNotify,
  enablePush,
  getPushSubscription,
  installDismissed,
  isIosDevice,
  isStandaloneDisplay,
  notificationsAllowedHere,
  notifyDismissed,
  onInstallAvailable,
  pathFromAppUrl,
  promptInstall,
  pushSupported,
} from "../pwa";

export function PwaPrompts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { member, loading } = useAuth();
  const [installReady, setInstallReady] = useState(canPromptInstall());
  const [showInstall, setShowInstall] = useState(!installDismissed());
  const [showNotify, setShowNotify] = useState(!notifyDismissed());
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    return onInstallAvailable(() => setInstallReady(canPromptInstall()));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; title?: string; body?: string; url?: string } | undefined;
      if (data?.type === "tombola-navigate" && data.url) {
        navigate(pathFromAppUrl(data.url));
        return;
      }
      if (data?.type === "tombola-push") {
        setToast({ title: data.title || t("pwa.notifyTitle"), body: data.body || "" });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!member || !pushSupported() || !notificationsAllowedHere()) return;
    let cancelled = false;
    void (async () => {
      try {
        const keyData = await api.pushKey();
        if (cancelled) return;
        setPublicKey(keyData.publicKey);
        if (!keyData.publicKey) return;
        const local = await getPushSubscription();
        const status = await api.pushStatus(local?.endpoint);
        if (cancelled) return;
        setSubscribed(status.subscribed);
        if (Notification.permission === "granted" && !status.subscribed && local) {
          const subscription = await enablePush(keyData.publicKey);
          if (!subscription || cancelled) return;
          await api.pushSubscribe(subscription);
          if (!cancelled) setSubscribed(true);
        }
      } catch {
        /* keep the last known key */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member]);

  const standalone = isStandaloneDisplay();
  const ios = isIosDevice();
  const installBanner = showInstall && !standalone && (installReady || ios);
  const permission = typeof Notification === "undefined" ? "denied" : Notification.permission;
  const notifyBanner =
    !loading &&
    Boolean(member) &&
    notificationsAllowedHere() &&
    pushSupported() &&
    Boolean(publicKey) &&
    permission !== "denied" &&
    !subscribed &&
    (permission === "default" ? showNotify : true);

  async function onEnable() {
    if (!publicKey) return;
    setBusy(true);
    setError("");
    try {
      const subscription = await enablePush(publicKey);
      if (!subscription) {
        setError(Notification.permission === "denied" ? t("pwa.blocked") : t("pwa.unavailable"));
        return;
      }
      await api.pushSubscribe(subscription);
      dismissNotify();
      setShowNotify(false);
      setSubscribed(true);
    } catch {
      setError(t("pwa.subscribeFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!installBanner && !notifyBanner && !toast) return null;

  return (
    <div className="pwa-stack no-print">
      {toast ? (
        <aside className="pwa-banner pwa-toast" role="status">
          <div>
            <strong>{toast.title}</strong>
            {toast.body ? <p>{toast.body}</p> : null}
          </div>
          <button type="button" className="btn-ghost" onClick={() => setToast(null)}>
            {t("pwa.close")}
          </button>
        </aside>
      ) : null}
      {installBanner ? (
        <aside className="pwa-banner" role="status">
          <div>
            <strong>{t("pwa.installTitle")}</strong>
            <p>{ios ? t("pwa.installIos") : t("pwa.installText")}</p>
          </div>
          <div className="pwa-banner-actions">
            {installReady ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void promptInstall()
                    .then((accepted) => {
                      if (accepted) setShowInstall(false);
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {t("pwa.installCta")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                dismissInstall();
                setShowInstall(false);
              }}
            >
              {t("pwa.later")}
            </button>
          </div>
        </aside>
      ) : null}
      {notifyBanner ? (
        <aside className="pwa-banner" role="status">
          <div>
            <strong>{t("pwa.notifyTitle")}</strong>
            <p>{t("pwa.notifyText")}</p>
            {error ? <p className="pwa-banner-error">{error}</p> : null}
          </div>
          <div className="pwa-banner-actions">
            <button type="button" className="btn-primary" disabled={busy || !publicKey} onClick={() => void onEnable()}>
              {t("pwa.notifyCta")}
            </button>
            {permission === "default" ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  dismissNotify();
                  setShowNotify(false);
                }}
              >
                {t("pwa.later")}
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  canPromptInstall,
  dismissInstall,
  dismissNotify,
  enablePush,
  installDismissed,
  isIosDevice,
  isStandaloneDisplay,
  notifyDismissed,
  onInstallAvailable,
  promptInstall,
  pushSupported,
} from "../pwa";

export function PwaPrompts() {
  const { t } = useTranslation();
  const { member, loading } = useAuth();
  const [installReady, setInstallReady] = useState(canPromptInstall());
  const [showInstall, setShowInstall] = useState(!installDismissed());
  const [showNotify, setShowNotify] = useState(!notifyDismissed());
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onInstallAvailable(() => setInstallReady(canPromptInstall()));
  }, []);

  useEffect(() => {
    if (!member || !pushSupported()) return;
    let cancelled = false;
    api
      .pushKey()
      .then((data) => {
        if (!cancelled) setPublicKey(data.publicKey);
      })
      .catch(() => {
        if (!cancelled) setPublicKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [member]);

  const standalone = isStandaloneDisplay();
  const ios = isIosDevice();
  const installBanner =
    showInstall &&
    !standalone &&
    (installReady || ios);
  const notifyAllowedOnThisDevice = !ios || standalone;
  const notifyBanner =
    !loading &&
    Boolean(member) &&
    showNotify &&
    notifyAllowedOnThisDevice &&
    pushSupported() &&
    Boolean(publicKey) &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default";

  if (!installBanner && !notifyBanner) return null;

  return (
    <div className="pwa-stack no-print">
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
          </div>
          <div className="pwa-banner-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !publicKey}
              onClick={() => {
                if (!publicKey) return;
                setBusy(true);
                void enablePush(publicKey)
                  .then(async (subscription) => {
                    if (!subscription) return;
                    await api.pushSubscribe(subscription);
                    dismissNotify();
                    setShowNotify(false);
                  })
                  .catch(() => undefined)
                  .finally(() => setBusy(false));
              }}
            >
              {t("pwa.notifyCta")}
            </button>
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
          </div>
        </aside>
      ) : null}
    </div>
  );
}

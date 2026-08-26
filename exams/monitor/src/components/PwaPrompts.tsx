import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  canPromptInstall,
  dismissInstall,
  installDismissed,
  isIosDevice,
  isStandaloneDisplay,
  onInstallAvailable,
  promptInstall,
} from "../pwa";

type PwaPromptsProps = {
  authed: boolean;
};

export function PwaPrompts({ authed }: PwaPromptsProps) {
  const { t } = useTranslation();
  const [installReady, setInstallReady] = useState(canPromptInstall());
  const [showInstall, setShowInstall] = useState(!installDismissed());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onInstallAvailable(() => setInstallReady(canPromptInstall()));
  }, []);

  const standalone = isStandaloneDisplay();
  const ios = isIosDevice();
  const installBanner = authed && showInstall && !standalone && (installReady || ios);

  if (!installBanner) return null;

  return (
    <div className="pwa-stack no-print">
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
    </div>
  );
}

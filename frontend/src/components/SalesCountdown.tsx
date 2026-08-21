import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function remainingMs(iso: string) {
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function formatCountdown(ms: number, lang: string) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (lang === "fr") {
    return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
  }
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function SalesCountdown({ opensAt }: { opensAt: string }) {
  const { t, i18n } = useTranslation();
  const [left, setLeft] = useState(() => remainingMs(opensAt));

  useEffect(() => {
    setLeft(remainingMs(opensAt));
    const id = window.setInterval(() => setLeft(remainingMs(opensAt)), 1000);
    return () => window.clearInterval(id);
  }, [opensAt]);

  if (left <= 0) {
    return <p className="sales-countdown">{t("sales.openNow")}</p>;
  }

  return (
    <p className="sales-countdown">
      {t("sales.opensIn", { time: formatCountdown(left, i18n.language) })}
    </p>
  );
}

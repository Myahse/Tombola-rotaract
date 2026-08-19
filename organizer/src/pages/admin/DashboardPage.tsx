import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminEvent, AdminStats } from "../../types";
import { ScratchFeed } from "../../components/ScratchFeed";
import { PageSkeleton } from "../../components/PageSkeleton";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tick = useLiveTick();

  async function load() {
    const data = await api.adminEvent();
    setEvent(data.event);
    setStats(data.stats);
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => {
      setReady(true);
      setMessage(t("errors.generic"));
    });
  }, [t, tick]);

  async function setStatus(status: "on_sale" | "closed") {
    setBusy(true);
    setMessage("");
    try {
      await api.setStatus(status);
      await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message === "need_prizes" ? t("admin.needPrizes") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <PageSkeleton kind="stats" />;
  if (!event || !stats) {
    return (
      <section>
        <h1>{t("admin.dashboard")}</h1>
        <p className="lede mt-3">{t("home.noEvent")}</p>
        <Link className="btn-primary mt-4" to={`/${lang}/tombola`}>
          {t("admin.create")}
        </Link>
      </section>
    );
  }

  const cards = [
    { label: t("admin.paid"), value: stats.paidTickets },
    { label: t("admin.reserved"), value: stats.reservedTickets },
    { label: t("admin.remaining"), value: stats.remainingTickets },
    ...(event.status === "drawn" && event.drawMode !== "roulette"
      ? [{ label: t("admin.scratched"), value: `${stats.scratchedTickets ?? 0}/${stats.paidTickets}` }]
      : []),
  ];

  return (
    <section>
      <p className="eyebrow">
        {event.status === "draft"
          ? t("admin.statusDraft")
          : event.status === "on_sale"
            ? t("admin.statusOnSale")
            : event.status === "closed"
              ? t("admin.statusClosed")
              : t("admin.statusDrawn")}
      </p>
      <h1>{localized(event, i18n.language, "title")}</h1>
      {event.status === "draft" ? <p className="lede mt-3">{t("admin.draftHelp")}</p> : null}
      <dl className="stat-list mt-4">
        {cards.map((card) => (
          <div key={card.label} className="fact">
            <dt>{card.label}</dt>
            <dd>{card.value}</dd>
          </div>
        ))}
      </dl>
      {event.status !== "drawn" ? (
        <div className="no-print mt-6 flex flex-wrap gap-2">
          {event.status !== "on_sale" ? (
            <button disabled={busy} onClick={() => setStatus("on_sale")} className="btn-primary btn-block">
              {t("admin.openSales")}
            </button>
          ) : (
            <button disabled={busy} onClick={() => setStatus("closed")} className="btn-outline btn-block">
              {t("admin.closeSales")}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-4">{t("admin.locked")}</p>
          {event.drawMode !== "roulette" ? <ScratchFeed /> : null}
        </>
      )}
      {message ? <p className="mt-3 text-sm text-ticket">{message}</p> : null}
    </section>
  );
}

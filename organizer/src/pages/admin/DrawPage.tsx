import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminStats, Winner } from "../../types";

export function DrawPage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [status, setStatus] = useState<string>("");
  const [winners, setWinners] = useState<Winner[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const tick = useLiveTick();

  async function load() {
    const [eventData, winnerData] = await Promise.all([api.adminEvent(), api.winners()]);
    setStats(eventData.stats);
    setStatus(eventData.event?.status ?? "");
    setWinners(winnerData.winners);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [tick]);

  async function runDraw() {
    if (!window.confirm(t("admin.drawHelp"))) return;
    setBusy(true);
    setMessage("");
    try {
      await api.draw();
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "no_paid_tickets" ? t("admin.noPaid") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5">
      <h1>{t("admin.draw")}</h1>
      <p className="lede">{t("admin.drawHelp")}</p>
      {stats && stats.reservedOrders > 0 && status !== "drawn" ? (
        <p className="badge wait w-fit">{t("admin.drawWarn")}</p>
      ) : null}
      {status !== "drawn" ? (
        <button
          disabled={busy || !stats?.paidTickets}
          onClick={runDraw}
          className="btn-primary no-print w-fit"
        >
          {t("admin.startDraw")}
        </button>
      ) : (
        <button type="button" className="btn-outline no-print w-fit" onClick={() => window.print()}>
          {t("admin.print")}
        </button>
      )}
      {message ? <p className="text-sm text-ticket">{message}</p> : null}
      {winners.length ? (
        <ol>
          {winners.map((winner) => (
            <li key={winner.rank} className="pillar flex flex-wrap justify-between gap-2">
              <span>
                <strong>{winner.rank}.</strong> {localized(winner, i18n.language, "prizeName")} — {winner.buyerName}
              </span>
              <span className="badge">{t("results.ticket", { number: winner.ticketNumber })}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

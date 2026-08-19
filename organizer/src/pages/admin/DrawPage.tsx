import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../../api";
import { useLiveTick } from "../../live";
import type { Contestant, Winner } from "../../types";
import { Avatar } from "../../components/Avatar";
import { DrawReel, reelOffsetForWinner } from "../../components/DrawReel";
import { ScratchFeed } from "../../components/ScratchFeed";
import { PageSkeleton } from "../../components/PageSkeleton";

export function DrawPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState("");
  const [drawMode, setDrawMode] = useState<"scratch" | "roulette">("scratch");
  const [paidTickets, setPaidTickets] = useState(0);
  const [reservedOrders, setReservedOrders] = useState(0);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [revealed, setRevealed] = useState<Winner[]>([]);
  const [current, setCurrent] = useState<Winner | null>(null);
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const animating = useRef(false);
  const tick = useLiveTick();

  async function load() {
    const [eventData, winnerData, pool] = await Promise.all([api.adminEvent(), api.winners(), api.contestants()]);
    setStatus(eventData.event?.status ?? "");
    setDrawMode(eventData.event?.drawMode === "roulette" ? "roulette" : "scratch");
    setPaidTickets(eventData.stats?.paidTickets ?? 0);
    setReservedOrders(eventData.stats?.reservedOrders ?? 0);
    setContestants(shuffle(pool.contestants));
    setWinners(winnerData.winners);
    if (eventData.event?.status === "drawn" && !animating.current) {
      setRevealed(winnerData.winners);
      setPhase("done");
    }
    setReady(true);
  }

  useEffect(() => {
    if (animating.current) return;
    load().catch(() => setReady(true));
  }, [tick]);

  async function runDraw() {
    if (!window.confirm(t(drawMode === "scratch" ? "admin.drawHelpScratch" : "admin.drawHelp"))) return;
    setBusy(true);
    setMessage("");
    try {
      const pool = shuffle((await api.contestants()).contestants);
      setContestants(pool);
      const result = await api.draw();
      const drawn = result.winners ?? [];
      setWinners(drawn);
      setPhase("spinning");
      animating.current = true;
      await playDraw(drawn, pool);
      animating.current = false;
      setPhase("done");
      setStatus("drawn");
    } catch (error) {
      animating.current = false;
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "no_paid_tickets" ? t("admin.noPaid") : t("errors.generic"));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function replayDraw() {
    if (!winners.length) return;
    setBusy(true);
    setPhase("spinning");
    animating.current = true;
    try {
      const pool = contestants.length ? shuffle(contestants) : shuffle((await api.contestants()).contestants);
      setContestants(pool);
      await playDraw(winners, pool);
      setPhase("done");
    } finally {
      animating.current = false;
      setBusy(false);
    }
  }

  async function playDraw(drawn: Winner[], pool: Contestant[]) {
    setRevealed([]);
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const winner of drawn) {
      setCurrent(winner);
      setSpinning(false);
      setOffset(0);
      await wait(instant ? 30 : 80);
      setSpinning(true);
      setOffset(reelOffsetForWinner(pool, winner.ticketNumber));
      await wait(instant ? 200 : 4200);
      setSpinning(false);
      setRevealed((list) => [...list, winner]);
      await wait(instant ? 400 : 1400);
    }
    setCurrent(null);
  }

  if (!ready) return <PageSkeleton kind="draw" />;

  return (
    <section className="grid gap-5">
      <h1>{t("admin.draw")}</h1>
      <p className="lede">{t(drawMode === "scratch" ? "admin.drawShowHelpScratch" : "admin.drawShowHelp")}</p>
      {reservedOrders > 0 && status !== "drawn" ? (
        <p className="badge wait w-fit">{t("admin.drawWarn")}</p>
      ) : null}

      {contestants.length || phase !== "idle" ? (
        <div className="draw-stage">
          {current ? (
            <p className="draw-prize">
              {t("admin.drawingPrize", {
                rank: current.rank,
                prize: localized(current, i18n.language, "prizeName"),
              })}
            </p>
          ) : null}
          <DrawReel
            contestants={contestants}
            winnerTicket={current?.ticketNumber}
            spinning={spinning}
            offset={offset}
          />
          {current && !spinning ? (
            <div className="draw-winner-banner">
              <Avatar name={current.buyerName} src={current.avatarUrl} size={56} />
              <div>
                <strong>{current.buyerName}</strong>
                <p>
                  {localized(current, i18n.language, "prizeName")} · {t("results.ticket", { number: current.ticketNumber })}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {status !== "drawn" && phase !== "spinning" ? (
        <button disabled={busy || paidTickets < 1} onClick={() => void runDraw()} className="btn-primary no-print btn-block">
          {busy ? t("admin.drawing") : t(drawMode === "scratch" ? "admin.startAssign" : "admin.startDraw")}
        </button>
      ) : status === "drawn" && phase !== "spinning" ? (
        <div className="flex flex-wrap gap-3 no-print">
          <button type="button" className="btn-primary btn-block" disabled={busy} onClick={() => void replayDraw()}>
            {t("admin.replayDraw")}
          </button>
          <button type="button" className="btn-outline btn-block" onClick={() => window.print()}>
            {t("admin.print")}
          </button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-ticket">{message}</p> : null}

      {revealed.length ? (
        <ol className="draw-results">
          {revealed.map((winner) => (
            <li key={winner.rank} className="draw-result-row">
              <Avatar name={winner.buyerName} src={winner.avatarUrl} size={44} />
              <span>
                <strong>
                  {winner.rank}. {localized(winner, i18n.language, "prizeName")}
                </strong>
                <p>
                  {winner.buyerName} · {t("results.ticket", { number: winner.ticketNumber })}
                </p>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {status === "drawn" && drawMode === "scratch" ? <ScratchFeed /> : null}
    </section>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy;
}

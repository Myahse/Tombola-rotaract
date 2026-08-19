import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../../api";
import { useLiveTick } from "../../live";
import type { Contestant, Winner } from "../../types";
import { Avatar } from "../../components/Avatar";
import { DrawReel, reelOffsetForWinner } from "../../components/DrawReel";
import { ScratchFeed } from "../../components/ScratchFeed";
import { PageSkeleton } from "../../components/PageSkeleton";
import { ConfirmModal } from "../../components/ConfirmModal";

export function DrawPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState("");
  const [drawMode, setDrawMode] = useState<"scratch" | "roulette">("scratch");
  const [totalTickets, setTotalTickets] = useState(0);
  const [paidTickets, setPaidTickets] = useState(0);
  const [prizeCount, setPrizeCount] = useState(0);
  const [reservedOrders, setReservedOrders] = useState(0);
  const [prizesSealed, setPrizesSealed] = useState(false);
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
  const [asking, setAsking] = useState<"seal" | "close" | "draw" | null>(null);
  const animating = useRef(false);
  const tick = useLiveTick();

  async function load() {
    const eventData = await api.adminEvent();
    const mode = eventData.event?.drawMode === "roulette" ? "roulette" : "scratch";
    setStatus(eventData.event?.status ?? "");
    setDrawMode(mode);
    setTotalTickets(eventData.event?.totalTickets ?? 0);
    setPaidTickets(eventData.stats?.paidTickets ?? 0);
    setPrizeCount(eventData.stats?.prizeCount ?? 0);
    setReservedOrders(eventData.stats?.reservedOrders ?? 0);
    setPrizesSealed(Boolean(eventData.stats?.prizesSealed));
    if (mode === "roulette") {
      const [winnerData, pool] = await Promise.all([api.winners(), api.contestants()]);
      setContestants(shuffle(pool.contestants));
      setWinners(winnerData.winners);
      if (eventData.event?.status === "drawn" && !animating.current) {
        setRevealed(winnerData.winners);
        setPhase("done");
      }
    } else {
      const assigned = await api.assignments();
      const pool = numberContestants(assigned.totalTickets || eventData.event?.totalTickets || 0, assigned.assignments);
      setContestants(pool);
      setWinners(assigned.assignments);
      setPrizesSealed(assigned.sealed);
      if (assigned.sealed && !animating.current) {
        setRevealed(assigned.assignments);
        setPhase("done");
      }
    }
    setReady(true);
  }

  useEffect(() => {
    if (animating.current) return;
    load().catch(() => setReady(true));
  }, [tick]);

  async function runSeal() {
    setAsking(null);
    setBusy(true);
    setMessage("");
    try {
      const result = await api.sealPrizes();
      const drawn = result.assignments ?? [];
      const pool = numberContestants(result.totalTickets || totalTickets, drawn);
      setContestants(pool);
      setWinners(drawn);
      setPrizesSealed(result.sealed);
      setPhase("spinning");
      animating.current = true;
      await playDraw(drawn, pool);
      animating.current = false;
      setPhase("done");
    } catch (error) {
      animating.current = false;
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "need_prizes" ? t("admin.needPrizes") : t("errors.generic"));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function runDraw() {
    setAsking(null);
    setBusy(true);
    setMessage("");
    try {
      if (drawMode === "scratch") {
        await api.draw();
        setStatus("drawn");
        await load();
        return;
      }
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
      setMessage(
        code === "no_paid_tickets"
          ? t("admin.noPaid")
          : code === "sales_open"
            ? t("admin.closeSalesFirst")
            : code === "need_assignment"
              ? t("admin.needAssignment")
              : t("errors.generic"),
      );
      setPhase(prizesSealed ? "done" : "idle");
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
      const pool =
        drawMode === "scratch"
          ? numberContestants(totalTickets, winners)
          : contestants.length
            ? shuffle(contestants)
            : shuffle((await api.contestants()).contestants);
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

  const scratch = drawMode === "scratch";
  const showWheel = scratch || contestants.length > 0 || phase !== "idle";

  return (
    <section className="grid gap-5">
      <h1>{t("admin.draw")}</h1>
      <p className="lede">{t(scratch ? "admin.drawShowHelpScratch" : "admin.drawShowHelp")}</p>
      {!scratch && status !== "drawn" && status !== "closed" ? (
        <p className="badge wait w-fit">{t("admin.closeSalesFirst")}</p>
      ) : null}
      {scratch && !prizesSealed ? <p className="badge wait w-fit">{t("admin.assignFirst")}</p> : null}
      {reservedOrders > 0 && status === "closed" ? (
        <p className="badge wait w-fit">{t("admin.drawWarn")}</p>
      ) : null}

      {showWheel ? (
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
            numbersOnly={scratch}
          />
          {current && !spinning ? (
            <div className="draw-winner-banner">
              {scratch ? (
                <span className="person-avatar fallback">{String(current.ticketNumber).padStart(3, "0")}</span>
              ) : (
                <Avatar name={current.buyerName} src={current.avatarUrl} size={56} />
              )}
              <div>
                <strong>
                  {scratch ? t("results.ticket", { number: current.ticketNumber }) : current.buyerName}
                </strong>
                <p>
                  {scratch
                    ? localized(current, i18n.language, "prizeName")
                    : `${localized(current, i18n.language, "prizeName")} · ${t("results.ticket", { number: current.ticketNumber })}`}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase !== "spinning" ? (
        scratch ? (
          <div className="flex flex-wrap gap-3 no-print">
            {!prizesSealed ? (
              <button disabled={busy || totalTickets < 1 || prizeCount < 1} onClick={() => setAsking("seal")} className="btn-primary btn-block">
                {busy ? t("admin.drawing") : t("admin.startSeal")}
              </button>
            ) : (
              <>
                <button type="button" className="btn-primary btn-block" disabled={busy} onClick={() => void replayDraw()}>
                  {t("admin.replayAssign")}
                </button>
                {status !== "drawn" ? (
                  <button
                    disabled={busy || paidTickets < 1 || status !== "closed"}
                    onClick={() => setAsking("close")}
                    className="btn-outline btn-block"
                  >
                    {t("admin.startAssign")}
                  </button>
                ) : (
                  <button type="button" className="btn-outline btn-block" onClick={() => window.print()}>
                    {t("admin.print")}
                  </button>
                )}
              </>
            )}
          </div>
        ) : status !== "drawn" ? (
          <button
            disabled={busy || paidTickets < 1 || status !== "closed"}
            onClick={() => setAsking("draw")}
            className="btn-primary no-print btn-block"
          >
            {busy ? t("admin.drawing") : t("admin.startDraw")}
          </button>
        ) : (
          <div className="flex flex-wrap gap-3 no-print">
            <button type="button" className="btn-primary btn-block" disabled={busy} onClick={() => void replayDraw()}>
              {t("admin.replayDraw")}
            </button>
            <button type="button" className="btn-outline btn-block" onClick={() => window.print()}>
              {t("admin.print")}
            </button>
          </div>
        )
      ) : null}
      {message ? <p className="text-sm text-ticket">{message}</p> : null}

      {revealed.length ? (
        <ol className="draw-results">
          {revealed.map((winner) => (
            <li key={winner.rank} className="draw-result-row">
              {scratch ? (
                <span className="person-avatar fallback">{String(winner.ticketNumber).padStart(3, "0")}</span>
              ) : (
                <Avatar name={winner.buyerName} src={winner.avatarUrl} size={44} />
              )}
              <span>
                <strong>
                  {winner.rank}. {localized(winner, i18n.language, "prizeName")}
                </strong>
                <p>
                  {scratch
                    ? t("results.ticket", { number: winner.ticketNumber })
                    : `${winner.buyerName} · ${t("results.ticket", { number: winner.ticketNumber })}`}
                </p>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {scratch ? <ScratchFeed /> : null}

      {asking ? (
        <ConfirmModal
          title={t("admin.draw")}
          body={t(asking === "seal" ? "admin.drawHelpSeal" : asking === "close" ? "admin.drawHelpScratch" : "admin.drawHelp")}
          confirmLabel={t(asking === "seal" ? "admin.startSeal" : asking === "close" ? "admin.startAssign" : "admin.startDraw")}
          cancelLabel={t("admin.back")}
          busy={busy}
          danger={asking !== "seal"}
          onConfirm={() => void (asking === "seal" ? runSeal() : runDraw())}
          onCancel={() => {
            if (!busy) setAsking(null);
          }}
        />
      ) : null}
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

function numberContestants(total: number, winners: Winner[] = []): Contestant[] {
  const cap = 48;
  const must = winners.map((winner) => winner.ticketNumber).filter((number) => number >= 1 && number <= total);
  const pool =
    total <= cap
      ? [...Array(total).keys()].map((index) => index + 1)
      : shuffle([...Array(total).keys()].map((index) => index + 1).filter((number) => !must.includes(number))).slice(
          0,
          Math.max(cap - must.length, 0),
        );
  return shuffle([...new Set([...must, ...pool])]).map((ticketNumber) => ({
    ticketNumber,
    buyerName: `n° ${String(ticketNumber).padStart(3, "0")}`,
    avatarUrl: null,
  }));
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney, localized } from "../api";
import { useAuth } from "../auth";
import type { OrderTicket, OrderView } from "../types";
import { NumberedTicket, ScratchTicket, StatusPill } from "../components/ScratchTicket";
import { TicketDeck } from "../components/TicketDeck";
import { PageSkeleton } from "../components/PageSkeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { WaveRefSheet } from "../components/WaveRefSheet";
import { useRealtime } from "../useRealtime";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";
import { PaymentReceiptSection } from "../components/PaymentReceiptSection";
import { buildReceiptData, receiptLabels } from "../lib/receipt";

export function TicketsPage() {
  const { token, lang } = useParams();
  const { t, i18n } = useTranslation();
  const { member, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareNumbers, setShareNumbers] = useState<number[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareDone, setShareDone] = useState("");
  const [waveRef, setWaveRef] = useState("");
  const [waveBusy, setWaveBusy] = useState(false);
  const [waveError, setWaveError] = useState("");
  const [waveDone, setWaveDone] = useState("");
  const [showWaveRef, setShowWaveRef] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [view, setView] = useState<"deck" | "list">(() =>
    localStorage.getItem("tombola-tickets-view") === "list" ? "list" : "deck",
  );

  const next = `/${lang}/tickets/${token ?? ""}`;

  useEffect(() => {
    if (!token || !member) return;
    api
      .order(token)
      .then((data) => {
        setOrder(data);
        setShareNumbers((data.tickets ?? []).map((ticket) => ticket.number));
        setWaveRef(data.paymentRef ?? "");
      })
      .catch((err) => {
        const code = err instanceof Error ? err.message : "";
        setError(code || "generic");
      });
  }, [token, member]);

  useRealtime("public", (message) => {
    if (!token || !member) return;
    if (message.type === "public.snapshot" || message.type === "draw.done") {
      api.order(token).then((data) => {
        setOrder(data);
        if (data.paymentRef) setWaveRef(data.paymentRef);
      }).catch(() => undefined);
    }
  });

  const receiptData = useMemo(() => {
    if (!order || order.status !== "paid") return null;
    const ticketList = order.tickets ?? [];
    return buildReceiptData({
      buyerName: order.buyerName,
      eventTitleFr: order.titleFr ?? "",
      eventTitleEn: order.titleEn ?? "",
      ticketPriceCents: order.ticketPriceCents,
      currency: order.currency,
      drawMode: order.drawMode,
      lang: i18n.language,
      orders: [
        {
          quantity: order.quantity,
          paymentMethod: order.paymentMethod,
          paymentRef: order.paymentRef,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
          tickets: ticketList,
        },
      ],
    });
  }, [order, i18n.language]);
  const receiptLabelSet = useMemo(() => receiptLabels(t), [t]);

  if (loading) return <PageSkeleton kind="tickets" />;
  if (!member) {
    return <Navigate to={`/${lang}/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (error === "login_required") {
    return <Navigate to={`/${lang}/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (error === "forbidden") {
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <h1>{t("confirm.notYours")}</h1>
        <p>{t("confirm.notYoursHelp")}</p>
        <Link to={`/${lang}/account`} className="btn-primary">
          {t("nav.account")}
        </Link>
      </section>
    );
  }
  if (error) return <p>{t("errors.generic")}</p>;
  if (!order) return <PageSkeleton kind="tickets" />;

  const tickets = order.tickets ?? [];
  const pay = localized(order, i18n.language, "paymentInstructions");
  const title = localized(order, i18n.language, "title") || t("home.kicker");
  const accessToken = order.token;
  const drawn = order.eventStatus === "drawn";
  const paid = order.status === "paid";
  const scratchMode = order.drawMode !== "roulette";
  const canScratch = paid && scratchMode;
  const lockedLabel = !paid ? t("scratch.payFirst") : t("ticket.waitRoulette");
  const receiptHeading = receiptData
    ? t("receipt.headingNamed", { name: receiptData.buyerName.trim().split(/\s+/)[0] || receiptData.buyerName })
    : "";

  function applyScratch(ticketNumber: number, result: {
    scratchedAt: string;
    prizeRank: number | null;
    prizeNameFr: string | null;
    prizeNameEn: string | null;
  }) {
    setOrder((current) => {
      if (!current?.tickets) return current;
      return {
        ...current,
        tickets: current.tickets.map((ticket) =>
          ticket.number === ticketNumber
            ? {
                ...ticket,
                scratchedAt: result.scratchedAt,
                prizeRank: result.prizeRank,
                prizeNameFr: result.prizeNameFr,
                prizeNameEn: result.prizeNameEn,
              }
            : ticket,
        ),
      };
    });
  }

  function recordScratch(ticket: OrderTicket) {
    void api.scratch(accessToken, ticket.number).then((result) => applyScratch(ticket.number, result));
  }

  function toggleShareNumber(number: number) {
    setShareNumbers((current) =>
      current.includes(number) ? current.filter((n) => n !== number) : [...current, number],
    );
  }

  async function onShare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setShareBusy(true);
    setShareError("");
    setShareDone("");
    try {
      const result = await api.shareTickets(token, { email: shareEmail, numbers: shareNumbers });
      if (!result.remaining) {
        navigate(`/${lang}/account`, { replace: true });
        return;
      }
      const data = await api.order(token);
      setOrder(data);
      setShareNumbers((data.tickets ?? []).map((ticket) => ticket.number));
      setShareEmail("");
      setShareDone(t("share.sent"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setShareError(
        code === "self"
          ? t("share.self")
          : code === "event_locked"
            ? t("share.locked")
            : code === "not_paid"
              ? t("share.unpaid")
              : t("errors.generic"),
      );
    } finally {
      setShareBusy(false);
    }
  }

  async function submitWaveRef() {
    if (!token) return;
    setWaveBusy(true);
    setWaveError("");
    setWaveDone("");
    try {
      const result = await api.sendPaymentRef(token, waveRef);
      setWaveRef(result.paymentRef);
      setOrder((current) => (current ? { ...current, paymentRef: result.paymentRef } : current));
      setWaveDone(t("pay.waveIdSaved"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setWaveError(
        code === "invalid_form"
          ? t("pay.waveIdInvalid")
          : code === "already_paid" || code === "event_locked"
            ? t("pay.waveIdLocked")
            : t("errors.generic"),
      );
      throw err;
    } finally {
      setWaveBusy(false);
    }
  }

  async function onCancelOrder() {
    if (!token) return;
    setCancelBusy(true);
    try {
      await api.cancelMyOrder(token);
      navigate(`/${lang}/account`, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setConfirmCancel(false);
      setCancelError(
        code === "already_paid"
          ? t("confirm.cancelPaid")
          : code === "event_locked"
            ? t("confirm.cancelLocked")
            : t("errors.generic"),
      );
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <>
      <section className="section">
        <p className="eyebrow">{t("home.kicker")}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{paid ? t("confirm.titlePaid") : t("confirm.title")}</h1>
            <p>{order.buyerName}</p>
          </div>
          <StatusPill tone={paid ? "ok" : "wait"}>
            {paid ? t("confirm.statusPaid") : t("confirm.statusReserved")}
          </StatusPill>
        </div>
        <p className="lede">{paid ? (scratchMode ? t("scratch.howto") : t("ticket.howto")) : t("confirm.waitingTickets")}</p>
        <p className="lede">{t("confirm.saveLink")}</p>
      </section>

      {receiptData ? (
        <PaymentReceiptSection data={receiptData} labels={receiptLabelSet} buyerHeading={receiptHeading} />
      ) : null}

      {paid && tickets.length ? (
        <section className="section">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2>{scratchMode ? t("confirm.yourTickets") : t("confirm.yourPlainTickets")}</h2>
            <div className="view-toggle" role="group" aria-label={t("deck.view")}>
              <button
                type="button"
                className={view === "deck" ? "active" : ""}
                onClick={() => {
                  setView("deck");
                  localStorage.setItem("tombola-tickets-view", "deck");
                }}
              >
                {t("deck.viewCards")}
              </button>
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                onClick={() => {
                  setView("list");
                  localStorage.setItem("tombola-tickets-view", "list");
                }}
              >
                {t("deck.viewList")}
              </button>
            </div>
          </div>
          {view === "list" ? (
            <div className="scratch-grid">
              {tickets.map((ticket) =>
                scratchMode ? (
                  <ScratchTicket
                    key={ticket.number}
                    number={ticket.number}
                    title={title}
                    buyerName={order.buyerName}
                    token={order.token}
                    canScratch={canScratch}
                    lockedLabel={lockedLabel}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    alreadyOpen={Boolean(ticket.scratchedAt)}
                    onStart={() => recordScratch(ticket)}
                    onReveal={() => recordScratch(ticket)}
                  />
                ) : (
                  <NumberedTicket
                    key={ticket.number}
                    number={ticket.number}
                    title={title}
                    buyerName={order.buyerName}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    drawn={drawn}
                    paid={paid}
                    waitLabel={lockedLabel}
                  />
                ),
              )}
            </div>
          ) : (
            <TicketDeck hint={scratchMode ? t("deck.hintScratch") : t("deck.hintRoulette")}>
              {tickets.map((ticket) =>
                scratchMode ? (
                  <ScratchTicket
                    key={ticket.number}
                    number={ticket.number}
                    title={title}
                    buyerName={order.buyerName}
                    token={order.token}
                    canScratch={canScratch}
                    lockedLabel={lockedLabel}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    alreadyOpen={Boolean(ticket.scratchedAt)}
                    onStart={() => recordScratch(ticket)}
                    onReveal={() => recordScratch(ticket)}
                  />
                ) : (
                  <NumberedTicket
                    key={ticket.number}
                    number={ticket.number}
                    title={title}
                    buyerName={order.buyerName}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    drawn={drawn}
                    paid={paid}
                    waitLabel={lockedLabel}
                  />
                ),
              )}
            </TicketDeck>
          )}
        </section>
      ) : null}

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("confirm.pay")}</h2>
        <p>
          {t("buy.total")}: <strong>{formatMoney(order.ticketPriceCents * order.quantity, order.currency, i18n.language)}</strong>
        </p>
        {order.paymentMethod === "wave" ? (
          <>
            <p className="pay-label">
              <WaveLogo />
              <strong>{t("pay.wave")}</strong>
            </p>
            <p>{t("pay.waveLead")}</p>
            {!paid && safeWavePayUrl(order.wavePayUrl) ? (
              <a className="btn-primary btn-block" href={safeWavePayUrl(order.wavePayUrl)} target="_blank" rel="noopener noreferrer">
                {t("pay.waveCta")}
              </a>
            ) : null}
            {!paid ? (
              <>
                {order.paymentRef ? (
                  <p className="lede mt-3">
                    {t("pay.waveId")}: <strong className="wave-ref">{order.paymentRef}</strong>
                  </p>
                ) : null}
                {waveDone && !showWaveRef ? <p className="field-ok mt-3">{waveDone}</p> : null}
                <button
                  type="button"
                  className="btn-primary btn-block mt-3"
                  onClick={() => {
                    setWaveRef(order.paymentRef ?? waveRef);
                    setWaveError("");
                    setShowWaveRef(true);
                  }}
                >
                  {order.paymentRef ? t("pay.waveRefEdit") : t("pay.waveRefOpen")}
                </button>
                {waveError && !showWaveRef ? <p className="text-sm text-ticket mt-3">{waveError}</p> : null}
              </>
            ) : order.paymentRef ? (
              <p className="lede mt-3">
                {t("pay.waveId")}: <strong className="wave-ref">{order.paymentRef}</strong>
              </p>
            ) : null}
          </>
        ) : (
          <p>{t("pay.cashLead")}</p>
        )}
        {pay ? <p className="whitespace-pre-wrap pay-note">{pay}</p> : null}
        {!paid ? (
          <div className="mt-6 grid gap-3">
            {cancelError ? <p className="text-sm text-ticket">{cancelError}</p> : null}
            <p>
              <button type="button" className="btn-danger" onClick={() => setConfirmCancel(true)}>
                {t("confirm.cancelCta")}
              </button>
            </p>
          </div>
        ) : null}
      </section>

      {paid && tickets.length && order.eventStatus !== "drawn" ? (
        <section className="section" style={{ borderBottom: 0 }}>
          <h2>{t("share.title")}</h2>
          <p>{t("share.lead")}</p>
          <form className="mt-6 grid gap-4" onSubmit={(e) => void onShare(e)}>
            <label>
              {t("share.email")}
              <input
                type="email"
                required
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {tickets.length > 1 ? (
              <fieldset className="share-numbers">
                <legend>{t("share.which")}</legend>
                {tickets.map((ticket) => (
                  <label key={ticket.number} className="share-number">
                    <input
                      type="checkbox"
                      checked={shareNumbers.includes(ticket.number)}
                      onChange={() => toggleShareNumber(ticket.number)}
                    />
                    {t("results.ticket", { number: ticket.number })}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {shareError ? <p className="text-sm text-ticket">{shareError}</p> : null}
            {shareDone ? <p className="field-ok">{shareDone}</p> : null}
            <button
              disabled={shareBusy || (tickets.length > 1 && shareNumbers.length < 1)}
              className="btn-primary btn-block"
            >
              {shareBusy ? t("auth.submitting") : t("share.submit")}
            </button>
          </form>
        </section>
      ) : null}
      {showWaveRef ? (
        <WaveRefSheet
          title={t("pay.waveId")}
          help={t("pay.waveIdHelp")}
          value={waveRef}
          placeholder={t("pay.waveIdPlaceholder")}
          confirmLabel={waveBusy ? t("pay.waveIdSaving") : t("pay.waveIdCta")}
          cancelLabel={t("pay.waveRefClose")}
          busy={waveBusy}
          error={waveError}
          onChange={setWaveRef}
          onConfirm={() => submitWaveRef()}
          onClose={() => {
            setShowWaveRef(false);
            setWaveError("");
          }}
        />
      ) : null}
      {confirmCancel ? (
        <ConfirmModal
          title={t("confirm.cancelTitle")}
          body={t("confirm.cancelBody")}
          confirmLabel={t("confirm.cancelCta")}
          cancelLabel={t("confirm.cancelKeep")}
          busy={cancelBusy}
          danger
          onConfirm={() => void onCancelOrder()}
          onCancel={() => {
            if (!cancelBusy) setConfirmCancel(false);
          }}
        />
      ) : null}
    </>
  );
}

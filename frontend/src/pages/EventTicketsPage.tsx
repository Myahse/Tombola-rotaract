import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney, localized } from "../api";
import { useAuth } from "../auth";
import type { MemberOrder, MemberTombola, OrderTicket, PaymentMethod } from "../types";
import { NumberedTicket, ScratchTicket } from "../components/ScratchTicket";
import { TicketDeck } from "../components/TicketDeck";
import { PageSkeleton } from "../components/PageSkeleton";
import { CancelReservedModal } from "../components/CancelReservedModal";
import { WaveRefSheet } from "../components/WaveRefSheet";
import { WaveLogo } from "../components/WaveLogo";
import { PaymentReceiptSection } from "../components/PaymentReceiptSection";
import { useRealtime } from "../useRealtime";
import { safeWavePayUrl } from "../safeWave";
import { buildTombolaReceipt, receiptLabels } from "../lib/receipt";

type FlatTicket = OrderTicket & { orderToken: string };

function flattenTickets(orders: MemberOrder[]): FlatTicket[] {
  return orders.flatMap((order) =>
    order.tickets.map((ticket) => ({
      ...ticket,
      orderToken: order.token,
    })),
  );
}

export function EventTicketsPage() {
  const { eventId, lang } = useParams();
  const { t, i18n } = useTranslation();
  const { member, loading } = useAuth();
  const [tombola, setTombola] = useState<MemberTombola | null | undefined>(undefined);
  const [wavePayUrl, setWavePayUrl] = useState("");
  const [cancelQty, setCancelQty] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [waveRef, setWaveRef] = useState("");
  const [waveBusy, setWaveBusy] = useState(false);
  const [waveError, setWaveError] = useState("");
  const [waveDone, setWaveDone] = useState("");
  const [showWaveRef, setShowWaveRef] = useState(false);
  const [view, setView] = useState<"deck" | "list">(() =>
    localStorage.getItem("tombola-tickets-view") === "list" ? "list" : "deck",
  );

  const reload = useCallback(() => {
    if (!member) return;
    api
      .myTombolas()
      .then((data) => {
        const match = data.tombolas.find((row) => row.eventId === eventId) ?? null;
        setTombola(match);
        if (match) {
          const latestWaveRef = match.orders.find((order) => order.status === "reserved" && order.paymentRef)?.paymentRef;
          if (latestWaveRef) setWaveRef(latestWaveRef);
        }
      })
      .catch(() => setTombola(null));
  }, [eventId, member]);

  useEffect(() => {
    reload();
    api.payments().then((data) => setWavePayUrl(data.wavePayUrl)).catch(() => undefined);
  }, [reload]);

  useRealtime("public", (message) => {
    if (message.type === "public.snapshot" || message.type === "draw.done") {
      reload();
    }
  });

  const reservedOrders = useMemo(
    () => tombola?.orders.filter((order) => order.status === "reserved") ?? [],
    [tombola],
  );
  const reservedTickets = useMemo(
    () => reservedOrders.reduce((sum, order) => sum + order.quantity, 0),
    [reservedOrders],
  );
  const paymentBreakdown = useMemo(() => {
    const groups = new Map<PaymentMethod, number>();
    for (const order of reservedOrders) {
      const method = order.paymentMethod ?? "cash";
      groups.set(method, (groups.get(method) ?? 0) + order.quantity);
    }
    return [...groups.entries()];
  }, [reservedOrders]);
  const waveReservedOrders = useMemo(
    () => reservedOrders.filter((order) => order.paymentMethod === "wave"),
    [reservedOrders],
  );
  const savedWaveRef = useMemo(
    () => waveReservedOrders.find((order) => order.paymentRef)?.paymentRef ?? "",
    [waveReservedOrders],
  );
  const paidTickets = useMemo(() => flattenTickets(tombola?.orders.filter((o) => o.status === "paid") ?? []), [tombola]);
  const title = tombola ? localized(tombola, i18n.language, "title") : "";
  const payNote = tombola ? localized(tombola, i18n.language, "paymentInstructions") : "";
  const scratchMode = tombola?.drawMode !== "roulette";
  const drawn = tombola?.status === "drawn";
  const canScratch = paidTickets.length > 0 && scratchMode && tombola?.status !== "drawn";
  const receiptData = useMemo(
    () => (tombola && member ? buildTombolaReceipt(tombola, member.name, i18n.language) : null),
    [tombola, member, i18n.language],
  );
  const receiptLabelSet = useMemo(() => receiptLabels(t), [t]);
  const receiptHeading = receiptData
    ? t("receipt.headingNamed", { name: receiptData.buyerName.trim().split(/\s+/)[0] || receiptData.buyerName })
    : "";

  useEffect(() => {
    if (reservedTickets > 0) {
      setCancelQty((current) => Math.min(Math.max(1, current), reservedTickets));
    }
  }, [reservedTickets]);

  if (loading) return <PageSkeleton kind="tickets" />;
  if (!member) {
    return <Navigate to={`/${lang}/login?next=/${lang}/my-tickets/${eventId ?? ""}`} replace />;
  }
  if (tombola === undefined) return <PageSkeleton kind="tickets" />;
  if (!tombola) {
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <h1>{t("account.empty")}</h1>
        <Link to={`/${lang}/account`} className="btn-primary">
          {t("nav.account")}
        </Link>
      </section>
    );
  }

  function applyScratch(ticketNumber: number, orderToken: string, result: {
    scratchedAt: string;
    prizeRank: number | null;
    prizeNameFr: string | null;
    prizeNameEn: string | null;
  }) {
    setTombola((current) => {
      if (!current) return current;
      return {
        ...current,
        orders: current.orders.map((order) =>
          order.token !== orderToken
            ? order
            : {
                ...order,
                tickets: order.tickets.map((ticket) =>
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
              },
        ),
      };
    });
  }

  async function submitWaveRef() {
    const paymentRef = waveRef.trim();
    if (!paymentRef || waveReservedOrders.length === 0) return;
    setWaveBusy(true);
    setWaveError("");
    setWaveDone("");
    try {
      for (const order of waveReservedOrders) {
        await api.sendPaymentRef(order.token, paymentRef);
      }
      setWaveDone(t("pay.waveIdSaved"));
      reload();
    } catch {
      setWaveError(t("errors.generic"));
      throw new Error("wave_ref_failed");
    } finally {
      setWaveBusy(false);
    }
  }

  async function onCancelReserved() {
    if (!eventId) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      await api.cancelReserved(eventId, cancelQty);
      setCancelError("");
      reload();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setCancelError(
        code === "not_enough_reserved"
          ? t("account.cancelNotEnough")
          : code === "event_locked"
            ? t("confirm.cancelLocked")
            : t("errors.generic"),
      );
      throw err;
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="page-appear">
      <section className="section">
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{title}</h1>
        <p className="lede">
          {paidTickets.length
            ? scratchMode
              ? t("scratch.howto")
              : t("ticket.howto")
            : t("confirm.waitingTickets")}
        </p>
        <p className="lede">{t("account.allTicketsLead")}</p>
        <p>
          <Link to={`/${lang}/account`} className="btn-ghost">
            {t("nav.account")}
          </Link>
        </p>
      </section>

      {receiptData ? (
        <PaymentReceiptSection data={receiptData} labels={receiptLabelSet} buyerHeading={receiptHeading} />
      ) : null}

      {paidTickets.length ? (
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
              {paidTickets.map((ticket) =>
                scratchMode ? (
                  <ScratchTicket
                    key={`${ticket.orderToken}-${ticket.number}`}
                    number={ticket.number}
                    title={title}
                    buyerName={member.name}
                    token={ticket.orderToken}
                    canScratch={canScratch}
                    lockedLabel={t("scratch.payFirst")}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    alreadyOpen={Boolean(ticket.scratchedAt)}
                    onStart={() => void api.scratch(ticket.orderToken, ticket.number).then((r) => applyScratch(ticket.number, ticket.orderToken, r))}
                    onReveal={() => void api.scratch(ticket.orderToken, ticket.number).then((r) => applyScratch(ticket.number, ticket.orderToken, r))}
                  />
                ) : (
                  <NumberedTicket
                    key={`${ticket.orderToken}-${ticket.number}`}
                    number={ticket.number}
                    title={title}
                    buyerName={member.name}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    drawn={drawn}
                    paid
                    waitLabel={t("ticket.waitRoulette")}
                  />
                ),
              )}
            </div>
          ) : (
            <TicketDeck hint={scratchMode ? t("deck.hintScratch") : t("deck.hintRoulette")}>
              {paidTickets.map((ticket) =>
                scratchMode ? (
                  <ScratchTicket
                    key={`${ticket.orderToken}-${ticket.number}`}
                    number={ticket.number}
                    title={title}
                    buyerName={member.name}
                    token={ticket.orderToken}
                    canScratch={canScratch}
                    lockedLabel={t("scratch.payFirst")}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    alreadyOpen={Boolean(ticket.scratchedAt)}
                    onStart={() => void api.scratch(ticket.orderToken, ticket.number).then((r) => applyScratch(ticket.number, ticket.orderToken, r))}
                    onReveal={() => void api.scratch(ticket.orderToken, ticket.number).then((r) => applyScratch(ticket.number, ticket.orderToken, r))}
                  />
                ) : (
                  <NumberedTicket
                    key={`${ticket.orderToken}-${ticket.number}`}
                    number={ticket.number}
                    title={title}
                    buyerName={member.name}
                    prizeName={i18n.language === "en" ? ticket.prizeNameEn : ticket.prizeNameFr}
                    prizeRank={ticket.prizeRank}
                    drawn={drawn}
                    paid
                    waitLabel={t("ticket.waitRoulette")}
                  />
                ),
              )}
            </TicketDeck>
          )}
        </section>
      ) : null}

      {reservedTickets > 0 ? (
        <section className="section" style={{ borderBottom: 0 }}>
          <h2>{t("confirm.pay")}</h2>
          <p>
            {t("account.reservedSummary", { count: reservedTickets })} ·{" "}
            <strong>
              {formatMoney(tombola.ticketPriceCents * reservedTickets, tombola.currency, i18n.language)}
            </strong>
          </p>
          <ul className="payment-breakdown">
            {paymentBreakdown.map(([method, count]) => (
              <li key={method}>
                {t("account.paymentLine", { count })}
                {" · "}
                {method === "wave" ? (
                  <span className="pay-label">
                    <WaveLogo />
                    {t("pay.wave")}
                  </span>
                ) : (
                  t("pay.cash")
                )}
              </li>
            ))}
          </ul>
          {waveReservedOrders.length > 0 ? (
            <>
              {safeWavePayUrl(wavePayUrl) ? (
                <a className="btn-primary btn-block mt-4" href={safeWavePayUrl(wavePayUrl)!} target="_blank" rel="noopener noreferrer">
                  {t("pay.waveCta")}
                </a>
              ) : null}
              {savedWaveRef ? (
                <p className="lede mt-4">
                  {t("pay.waveId")}: <strong className="wave-ref">{savedWaveRef}</strong>
                </p>
              ) : null}
              {waveDone && !showWaveRef ? <p className="field-ok mt-3">{waveDone}</p> : null}
              <button
                type="button"
                className="btn-primary btn-block mt-3"
                onClick={() => {
                  setWaveRef(savedWaveRef || waveRef);
                  setWaveError("");
                  setShowWaveRef(true);
                }}
              >
                {savedWaveRef ? t("pay.waveRefEdit") : t("pay.waveRefOpen")}
              </button>
            </>
          ) : null}
          {waveError && !showWaveRef ? <p className="text-sm text-ticket mt-3">{waveError}</p> : null}
          {payNote ? <p className="whitespace-pre-wrap pay-note mt-4">{payNote}</p> : null}
          {cancelError && !confirmCancel ? <p className="text-sm text-ticket mt-4">{cancelError}</p> : null}
          <div className="mt-6">
            <button type="button" className="btn-danger" onClick={() => setConfirmCancel(true)}>
              {t("account.cancelReservedCta")}
            </button>
          </div>
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
        <CancelReservedModal
          title={t("account.cancelTitle")}
          body={t("account.cancelLead", { max: reservedTickets })}
          quantity={cancelQty}
          max={reservedTickets}
          quantityLabel={t("account.cancelQuantity")}
          confirmLabel={t("account.cancelReservedCta")}
          cancelLabel={t("confirm.cancelKeep")}
          busy={cancelBusy}
          error={cancelError}
          onQuantityChange={setCancelQty}
          onConfirm={() => onCancelReserved()}
          onClose={() => {
            setConfirmCancel(false);
            setCancelError("");
          }}
        />
      ) : null}
    </div>
  );
}

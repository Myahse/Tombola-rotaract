import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney, localized } from "../api";
import type { OrderView } from "../types";
import { ScratchTicket, StatusPill } from "../components/ScratchTicket";
import { useRealtime } from "../useRealtime";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";

export function TicketsPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .order(token)
      .then(setOrder)
      .catch(() => setError(true));
  }, [token]);

  useRealtime("public", (message) => {
    if (!token) return;
    if (message.type === "public.snapshot" || message.type === "draw.done") {
      api.order(token).then(setOrder).catch(() => undefined);
    }
  });

  if (error) return <p>{t("errors.generic")}</p>;
  if (!order) return <p className="lede">…</p>;

  const tickets = order.tickets?.length
    ? order.tickets
    : (order.numbers ?? []).map((number) => ({
        number,
        prizeId: null,
        prizeRank: null,
        prizeNameFr: null,
        prizeNameEn: null,
      }));
  const pay = localized(order, i18n.language, "paymentInstructions");
  const title = localized(order, i18n.language, "title") || t("home.kicker");
  const href = window.location.href;
  const drawn = order.eventStatus === "drawn";
  const paid = order.status === "paid";
  const canScratch = paid && drawn;
  const lockedLabel = !paid ? t("scratch.payFirst") : t("scratch.wait");

  return (
    <>
      <section className="section">
        <p className="eyebrow">{t("home.kicker")}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{t("confirm.title")}</h1>
            <p>{order.buyerName}</p>
          </div>
          <StatusPill tone={paid ? "ok" : "wait"}>
            {paid ? t("confirm.statusPaid") : t("confirm.statusReserved")}
          </StatusPill>
        </div>
        <p className="lede">{t("scratch.howto")}</p>
        <p className="lede">
          {t("confirm.saveLink")}{" "}
          <a href={href} className="break-all font-semibold">
            {href}
          </a>
        </p>
      </section>

      <section className="section">
        <h2>{t("confirm.yourTickets")}</h2>
        <div className="scratch-grid">
          {tickets.map((ticket) => (
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
            />
          ))}
        </div>
      </section>

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
            <p>{t("pay.affiliate")}</p>
            {!paid && safeWavePayUrl(order.wavePayUrl) ? (
              <a className="btn-primary btn-block" href={safeWavePayUrl(order.wavePayUrl)} target="_blank" rel="noopener noreferrer">
                {t("pay.waveCta")}
              </a>
            ) : null}
          </>
        ) : (
          <p>{t("pay.cashLead")}</p>
        )}
        {pay ? <p className="whitespace-pre-wrap pay-note">{pay}</p> : null}
      </section>
    </>
  );
}

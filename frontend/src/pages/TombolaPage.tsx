import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney, localized } from "../api";
import type { PublicEvent } from "../types";
import { StatusPill } from "../components/ScratchTicket";
import { useRealtime } from "../useRealtime";

export function TombolaPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const [event, setEvent] = useState<PublicEvent | null | undefined>(undefined);

  useEffect(() => {
    api
      .currentEvent()
      .then((data) => setEvent(data.event))
      .catch(() => setEvent(null));
  }, []);

  useRealtime("public", (message) => {
    if (message.type === "public.snapshot") {
      setEvent((message.event as PublicEvent | null) ?? null);
    }
  });

  if (event === undefined) {
    return <p className="lede" style={{ padding: "4rem 0", textAlign: "center" }}>…</p>;
  }
  if (!event) {
    return (
      <section className="vitrine-hero">
        <span className="brand-dot lg" aria-hidden />
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{t("home.noEvent")}</h1>
        <Link to={`/${lang}`} className="btn-outline">
          {t("nav.home")}
        </Link>
      </section>
    );
  }

  const title = localized(event, i18n.language, "title");
  const description = localized(event, i18n.language, "description");
  const canBuy = event.status === "on_sale" && event.remainingTickets > 0;
  const statusLabel =
    event.status === "on_sale"
      ? event.remainingTickets === 0
        ? t("home.soldOut")
        : t("home.onSale")
      : event.status === "drawn"
        ? t("home.drawn")
        : t("home.closed");

  return (
    <>
      <section className="vitrine-hero">
        <span className="brand-dot lg" aria-hidden />
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StatusPill tone={event.status === "on_sale" ? "ok" : "wait"}>{statusLabel}</StatusPill>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {canBuy ? (
            <Link to={`/${lang}/buy`} className="btn-primary">
              {t("nav.buy")}
            </Link>
          ) : null}
          {event.status === "drawn" ? (
            <Link to={`/${lang}/results`} className="btn-outline">
              {t("home.seeResults")}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="section">
        <dl className="fact-list">
          <div className="fact">
            <dt>{t("admin.remaining")}</dt>
            <dd>{t("home.ticketsLeft", { count: event.remainingTickets })}</dd>
          </div>
          <div className="fact">
            <dt>{t("landing.ticketPrice")}</dt>
            <dd>{t("home.price", { price: formatMoney(event.ticketPriceCents, event.currency, i18n.language) })}</dd>
          </div>
        </dl>
      </section>

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("home.prizes")}</h2>
        <div>
          {event.prizes.map((prize) => (
            <article key={prize.rank} className="pillar">
              <h3>
                {prize.rank}. {localized(prize, i18n.language, "name")}
              </h3>
              <p>{localized(prize, i18n.language, "description")}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

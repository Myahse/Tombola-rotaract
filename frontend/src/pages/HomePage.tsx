import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, eventCanBuy, eventPreRegister, formatMoney, localized } from "../api";
import { SalesCountdown } from "../components/SalesCountdown";
import type { PublicEvent } from "../types";
import { StatusPill } from "../components/ScratchTicket";
import { BrandLogo } from "../components/BrandLogo";
import { useRealtime } from "../useRealtime";

export function HomePage() {
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

  const canBuy = eventCanBuy(event);
  const preRegister = eventPreRegister(event);

  return (
    <>
      <section className="vitrine-hero">
        <BrandLogo hero />
        <h1>{t("landing.heroTitle")}</h1>
        <p className="lede">{t("landing.heroLede")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {event !== undefined ? (
            canBuy ? (
              <Link to={`/${lang}/buy`} className="btn-primary">
                {t("nav.buy")}
              </Link>
            ) : preRegister ? (
              <Link to={`/${lang}/register?next=${encodeURIComponent(`/${lang}/buy`)}`} className="btn-primary">
                {t("sales.preRegisterCta")}
              </Link>
            ) : (
              <Link to={`/${lang}/tombola`} className="btn-primary">
                {t("landing.seeTombola")}
              </Link>
            )
          ) : null}
          <a href="#how" className="btn-outline">
            {t("landing.howCta")}
          </a>
        </div>
      </section>

      <section id="how" className="section">
        <h2>{t("landing.howTitle")}</h2>
        <div className="pillar-grid">
          <article className="pillar">
            <h3>{t("landing.step1Title")}</h3>
            <p>{t("landing.step1Text")}</p>
          </article>
          <article className="pillar">
            <h3>{t("landing.step2Title")}</h3>
            <p>{t("landing.step2Text")}</p>
          </article>
          <article className="pillar">
            <h3>{t("landing.step3Title")}</h3>
            <p>{t("landing.step3Text")}</p>
          </article>
          <article className="pillar">
            <h3>{t("landing.step4Title")}</h3>
            <p>{t("landing.step4Text")}</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>{t("landing.currentTitle")}</h2>
        {event === undefined ? null : !event ? (
          <p>{t("home.noEvent")}</p>
        ) : (
          <>
            <p className="lede">{localized(event, i18n.language, "title")}</p>
            <dl className="fact-list">
              <div className="fact">
                <dt>{t("landing.status")}</dt>
                <dd>
                  <StatusPill tone={event.status === "on_sale" ? "ok" : "wait"}>
                    {event.status === "on_sale"
                      ? t("home.onSale")
                      : event.status === "drawn"
                        ? t("home.drawn")
                        : t("home.closed")}
                  </StatusPill>
                </dd>
              </div>
              <div className="fact">
                <dt>{t("admin.remaining")}</dt>
                <dd>{t("home.ticketsLeft", { count: event.remainingTickets })}</dd>
              </div>
              <div className="fact">
                <dt>{t("landing.ticketPrice")}</dt>
                <dd>{formatMoney(event.ticketPriceCents, event.currency, i18n.language)}</dd>
              </div>
            </dl>
            {preRegister && event.salesOpensAt ? <SalesCountdown opensAt={event.salesOpensAt} /> : null}
            {preRegister ? <p className="mt-4">{t("sales.preRegisterLead")}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={`/${lang}/tombola`} className="btn-outline">
                {t("landing.seeTombola")}
              </Link>
              {canBuy ? (
                <Link to={`/${lang}/buy`} className="btn-primary">
                  {t("nav.buy")}
                </Link>
              ) : preRegister ? (
                <Link to={`/${lang}/register?next=${encodeURIComponent(`/${lang}/buy`)}`} className="btn-primary">
                  {t("sales.preRegisterCta")}
                </Link>
              ) : null}
              {event.status === "drawn" && event.drawMode !== "scratch" ? (
                <Link to={`/${lang}/results`} className="btn-outline">
                  {t("home.seeResults")}
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("landing.donateTitle")}</h2>
        <p className="lede">{t("landing.donateText")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/${lang}/donate`} className="btn-primary">
            {t("landing.donateCta")}
          </Link>
        </div>
      </section>

      <footer className="vitrine-foot">
        {t("landing.footer")}
        {" · "}
        <Link to={`/${lang}/donate`}>{t("nav.donate")}</Link>
      </footer>
    </>
  );
}

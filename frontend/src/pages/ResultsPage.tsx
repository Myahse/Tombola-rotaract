import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import type { Winner } from "../types";
import { useRealtime } from "../useRealtime";

export function ResultsPage() {
  const { t, i18n } = useTranslation();
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    api.results().then((data) => {
      setWinners(data.winners);
      if (data.event) setTitle(localized(data.event, i18n.language, "title"));
    });
  }, [i18n.language]);

  useRealtime("public", (message) => {
    if (message.type === "draw.done" || message.type === "public.snapshot") {
      api.results().then((data) => {
        setWinners(data.winners);
        if (data.event) setTitle(localized(data.event, i18n.language, "title"));
      });
    }
  });

  return (
    <>
      <section className="vitrine-hero">
        <img
          src="/logo.png"
          alt="Rotaract IUGB Club"
          className="brand-logo hero"
          width={960}
          height={614}
          decoding="async"
          fetchPriority="high"
        />
        <p className="eyebrow">{title || t("home.kicker")}</p>
        <h1>{t("results.title")}</h1>
      </section>
      <section className="section" style={{ borderBottom: 0 }}>
        {!winners?.length ? (
          <p>{t("results.empty")}</p>
        ) : (
          <ol className="results-list">
            {winners.map((winner) => (
              <li key={winner.rank} className="pillar flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3>
                    {winner.rank}. {localized(winner, i18n.language, "prizeName")}
                  </h3>
                  <p>{winner.buyerName}</p>
                </div>
                <span className="badge">{t("results.ticket", { number: winner.ticketNumber })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

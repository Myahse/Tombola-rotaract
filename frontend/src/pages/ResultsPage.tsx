import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { Avatar } from "../components/Avatar";
import { BrandLogo } from "../components/BrandLogo";
import type { DrawMode, Winner } from "../types";
import { useRealtime } from "../useRealtime";
import { PageSkeleton } from "../components/PageSkeleton";

export function ResultsPage() {
  const { t, i18n } = useTranslation();
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [title, setTitle] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode | "">("");
  const [eventStatus, setEventStatus] = useState("");

  function load() {
    api.results().then((data) => {
      setWinners(data.winners);
      if (data.event) {
        setTitle(localized(data.event, i18n.language, "title"));
        setDrawMode(data.event.drawMode === "roulette" ? "roulette" : "scratch");
        setEventStatus(data.event.status);
      }
    }).catch(() => setWinners([]));
  }

  useEffect(() => {
    load();
  }, [i18n.language]);

  useRealtime("public", (message) => {
    if (message.type === "draw.done" || message.type === "public.snapshot") {
      load();
    }
  });

  const scratchHidden = eventStatus === "drawn" && drawMode === "scratch";

  return (
    <>
      <section className="vitrine-hero">
        <BrandLogo hero />
        <p className="eyebrow">{title || t("home.kicker")}</p>
        <h1>{t("results.title")}</h1>
      </section>
      <section className="section" style={{ borderBottom: 0 }}>
        {winners === null ? (
          <PageSkeleton kind="results" />
        ) : scratchHidden ? (
          <p>{t("results.scratchHidden")}</p>
        ) : !winners.length ? (
          <p>{t("results.empty")}</p>
        ) : (
          <ol className="results-list">
            {winners.map((winner) => (
              <li key={winner.rank} className="pillar flex flex-wrap items-center justify-between gap-3">
                <div className="results-person">
                  <Avatar name={winner.buyerName} src={winner.avatarUrl} size={48} />
                  <div>
                    <h3>
                      {winner.rank}. {localized(winner, i18n.language, "prizeName")}
                    </h3>
                    <p>{winner.buyerName}</p>
                  </div>
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

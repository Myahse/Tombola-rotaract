import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useLiveTick } from "../live";
import { PageSkeleton } from "./PageSkeleton";
import type { ScratchedTicket } from "../types";

export function ScratchFeed() {
  const { t, i18n } = useTranslation();
  const tick = useLiveTick();
  const [scratches, setScratches] = useState<ScratchedTicket[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .scratches()
      .then((data) => {
        setScratches(data.scratches);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [tick]);

  return (
    <section className="scratch-feed no-print">
      <h2>{t("admin.scratches")}</h2>
      <p className="lede">{t("admin.scratchesHelp")}</p>
      { !ready ? (
        <PageSkeleton kind="feed" />
      ) : scratches.length === 0 ? (
        <p className="lede">{t("admin.scratchesEmpty")}</p>
      ) : (
        <ol className="scratch-feed-list">
          {scratches.map((scratch) => {
            const prize = localized(scratch, i18n.language, "prizeName");
            const time = new Date(scratch.scratchedAt).toLocaleTimeString(i18n.language === "en" ? "en-GB" : "fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return (
              <li key={`${scratch.ticketNumber}-${scratch.scratchedAt}`} className="scratch-feed-row">
                <span className="scratch-feed-number">N° {String(scratch.ticketNumber).padStart(3, "0")}</span>
                <span>
                  <strong>{scratch.buyerName}</strong>
                  <p>
                    {prize
                      ? t("admin.scratchWin", { rank: scratch.prizeRank ?? 0, prize })
                      : t("admin.scratchLose")}
                    {" · "}
                    {time}
                  </p>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

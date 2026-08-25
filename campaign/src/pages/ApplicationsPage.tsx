import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { adhesionFormUrl } from "../formTemplate";
import type { AdhesionApplication } from "../types";

function statusClass(item: AdhesionApplication) {
  if (item.status === "awaiting_sponsor") return "badge wait";
  if (item.finalDecision === "accepted") return "badge ok";
  if (item.finalDecision === "rejected") return "badge";
  return "badge wait";
}

function statusLabel(item: AdhesionApplication, t: (key: string) => string) {
  if (item.status === "awaiting_sponsor") return t("form.awaitingSponsor");
  return t(`form.${item.finalDecision}`);
}

export function ApplicationsPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [rows, setRows] = useState<AdhesionApplication[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .listAdhesion()
      .then((data) => setRows(data.applications))
      .catch(() => setMessage(t("errors.generic")));
  }, [t]);

  return (
    <section>
      <p className="eyebrow">{t("form.kicker")}</p>
      <h1>{t("form.inbox")}</h1>
      <p className="lede mt-3">{t("form.inboxLead")}</p>
      <p className="hint">{t("form.shareUrl", { url: adhesionFormUrl(lang ?? "fr") })}</p>
      {message ? <p className="mt-4 text-sm text-ticket">{message}</p> : null}
      {!rows ? (
        <p className="lede mt-6">…</p>
      ) : !rows.length ? (
        <p className="lede mt-6">{t("form.empty")}</p>
      ) : (
        <div className="mt-6">
          {rows.map((item) => (
            <article key={item.id} className="pillar flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3>{item.fullName}</h3>
                <p>
                  {item.email} · {item.phone}
                </p>
                <p className="hint">{new Date(item.createdAt).toLocaleString(lang)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass(item)}>{statusLabel(item, t)}</span>
                <Link className="btn-outline" to={`/${lang}/forms/${item.id}`}>
                  {t("form.open")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

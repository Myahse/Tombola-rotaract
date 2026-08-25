import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { AdhesionApplication } from "../types";

export function ApplicationDetailPage() {
  const { t } = useTranslation();
  const { lang, id } = useParams();
  const [row, setRow] = useState<AdhesionApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [commissionOpinion, setCommissionOpinion] = useState("");
  const [finalDecision, setFinalDecision] = useState<AdhesionApplication["finalDecision"]>("pending");
  const [presidentSignature, setPresidentSignature] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .getAdhesion(id)
      .then(({ application }) => {
        setRow(application);
        setDepositDate(application.depositDate ?? "");
        setCommissionOpinion(application.commissionOpinion ?? "");
        setFinalDecision(application.finalDecision);
        setPresidentSignature(application.presidentSignature ?? "");
      })
      .catch(() => setMessage(t("errors.generic")));
  }, [id, t]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setMessage("");
    try {
      const { application } = await api.reviewAdhesion(id, {
        depositDate,
        commissionOpinion,
        finalDecision,
        presidentSignature,
      });
      setRow(application);
      setMessage(t("form.saved"));
    } catch {
      setMessage(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (!row) return <p className="lede">{message || "…"}</p>;

  return (
    <section className="grid gap-6">
      <div>
        <Link to={`/${lang}/forms`} className="hint">
          ← {t("form.inbox")}
        </Link>
        <h1 className="mt-2">{row.fullName}</h1>
        <p className="hint mt-2">
          {row.email} · {row.phone}
        </p>
        <p className="hint mt-1">{new Date(row.createdAt).toLocaleString(lang)}</p>
      </div>
      {message ? <p className="text-sm text-ticket">{message}</p> : null}

      <dl className="form-facts">
        <div>
          <dt>{t("form.birthDate")}</dt>
          <dd>{row.birthDate}</dd>
        </div>
        <div>
          <dt>{t("form.sex")}</dt>
          <dd>{t(`form.${row.sex === "female" ? "female" : row.sex === "male" ? "male" : "other"}`)}</dd>
        </div>
        <div>
          <dt>{t("form.address")}</dt>
          <dd>{row.address}</dd>
        </div>
        <div>
          <dt>{t("form.profession")}</dt>
          <dd>{row.profession}</dd>
        </div>
        <div>
          <dt>{t("form.sponsorName")}</dt>
          <dd>
            {row.sponsorName}
            {row.sponsorEmail ? ` · ${row.sponsorEmail}` : ""}
            {row.sponsorRole ? ` · ${row.sponsorRole}` : ""}
          </dd>
        </div>
        <div>
          <dt>{t("form.pledgeName")}</dt>
          <dd>{row.pledgeName}</dd>
        </div>
        <div>
          <dt>{t("form.applicantSignature")}</dt>
          <dd>{row.applicantSignature}</dd>
        </div>
        <div>
          <dt>{t("form.sponsorSignature")}</dt>
          <dd>
            {row.status === "awaiting_sponsor"
              ? t("form.awaitingSponsor")
              : `${row.sponsorConfirmName ?? ""} · ${row.sponsorSignature ?? ""} · ${row.sponsorDate ?? ""}`}
          </dd>
        </div>
      </dl>

      {row.status === "awaiting_sponsor" ? (
        <p className="lede">{t("form.waitingSponsor")}</p>
      ) : (
      <form className="form-block grid gap-4" onSubmit={(e) => void save(e)}>
        <h2>{t("form.commission")}</h2>
        <label>
          {t("form.depositDate")}
          <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
        </label>
        <label>
          {t("form.commissionOpinion")}
          <textarea rows={4} value={commissionOpinion} onChange={(e) => setCommissionOpinion(e.target.value)} />
        </label>
        <label>
          {t("form.finalDecision")}
          <select
            value={finalDecision}
            onChange={(e) => setFinalDecision(e.target.value as AdhesionApplication["finalDecision"])}
          >
            <option value="pending">{t("form.pending")}</option>
            <option value="accepted">{t("form.accepted")}</option>
            <option value="rejected">{t("form.rejected")}</option>
          </select>
        </label>
        <label>
          {t("form.presidentSignature")}
          <input value={presidentSignature} onChange={(e) => setPresidentSignature(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={busy}>
          {busy ? t("form.saving") : t("form.saveReview")}
        </button>
      </form>
      )}
    </section>
  );
}

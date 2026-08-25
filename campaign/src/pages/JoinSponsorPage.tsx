import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { JoinShell } from "../components/JoinShell";
import type { AdhesionSponsorPreview } from "../types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function JoinSponsorPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [row, setRow] = useState<AdhesionSponsorPreview | null>(null);
  const [missing, setMissing] = useState(false);
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorRole, setSponsorRole] = useState("");
  const [sponsorConfirmName, setSponsorConfirmName] = useState("");
  const [sponsorSignature, setSponsorSignature] = useState("");
  const [sponsorDate, setSponsorDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setMissing(true);
      return;
    }
    api
      .getAdhesionSponsor(token)
      .then(({ application }) => {
        setRow(application);
        setSponsorName(application.sponsorName);
        setSponsorConfirmName(application.sponsorName);
        setSponsorSignature(application.sponsorName);
        if (application.status !== "awaiting_sponsor") setDone(true);
      })
      .catch(() => setMissing(true));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await api.submitAdhesionSponsor(token, {
        sponsorName,
        sponsorRole,
        sponsorConfirmName,
        sponsorSignature,
        sponsorDate,
      });
      setDone(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "already_done") {
        setDone(true);
        return;
      }
      setError(
        code === "too_many_requests"
          ? t("errors.rateLimited")
          : code === "api_down"
            ? t("errors.apiDown")
            : t("errors.invalidJoin"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <JoinShell>
      <section className="form-doc">
        <p className="eyebrow">{t("form.kicker")}</p>
        <h1>{t("form.sponsorTitle")}</h1>
        {missing ? (
          <p className="lede mt-4">{t("form.sponsorMissing")}</p>
        ) : !row ? (
          <p className="lede mt-4">…</p>
        ) : done ? (
          <p className="lede mt-4">{t("form.sponsorThanks")}</p>
        ) : (
          <form className="grid gap-6 mt-4" onSubmit={(e) => void onSubmit(e)}>
            <p className="lede">{t("form.sponsorLede", { name: row.fullName })}</p>
            <dl className="form-facts">
              <div>
                <dt>{t("form.fullName")}</dt>
                <dd>{row.fullName}</dd>
              </div>
              <div>
                <dt>{t("form.email")}</dt>
                <dd>{row.email}</dd>
              </div>
              <div>
                <dt>{t("form.profession")}</dt>
                <dd>{row.profession}</dd>
              </div>
            </dl>
            <fieldset className="form-block">
              <legend>{t("form.sponsor")}</legend>
              <label>
                {t("form.sponsorName")}
                <input required value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} />
              </label>
              <label>
                {t("form.sponsorRole")}
                <input required value={sponsorRole} onChange={(e) => setSponsorRole(e.target.value)} />
              </label>
            </fieldset>
            <fieldset className="form-block">
              <legend>{t("form.sponsorConfirm")}</legend>
              <p className="hint">{t("form.sponsorConfirmLead")}</p>
              <label>
                {t("form.sponsorConfirmName")}
                <input required value={sponsorConfirmName} onChange={(e) => setSponsorConfirmName(e.target.value)} />
              </label>
              <label>
                {t("form.sponsorSignature")}
                <input required value={sponsorSignature} onChange={(e) => setSponsorSignature(e.target.value)} />
              </label>
              <label>
                {t("form.sponsorDate")}
                <input required type="date" value={sponsorDate} onChange={(e) => setSponsorDate(e.target.value)} />
              </label>
            </fieldset>
            {error ? <p className="text-sm text-ticket">{error}</p> : null}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t("form.sending") : t("form.sponsorSubmit")}
            </button>
          </form>
        )}
      </section>
    </JoinShell>
  );
}

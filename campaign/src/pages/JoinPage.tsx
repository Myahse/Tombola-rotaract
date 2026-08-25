import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { JoinShell } from "../components/JoinShell";
import type { AdhesionApplicantSubmit } from "../types";

const empty: AdhesionApplicantSubmit = {
  fullName: "",
  birthDate: "",
  sex: "female",
  address: "",
  phone: "",
  email: "",
  profession: "",
  sponsorName: "",
  sponsorEmail: "",
  pledgeName: "",
  pledgeRules: false,
  pledgeParticipate: false,
  pledgeDues: false,
  pledgeObservation: false,
  applicantSignature: "",
};

export function JoinPage() {
  const { lang } = useParams();
  const { t } = useTranslation();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function patch(next: Partial<AdhesionApplicantSubmit>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.submitAdhesion({ ...form, lang: lang === "en" ? "en" : "fr" });
      setDone(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
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
        <h1>{t("form.title")}</h1>
        {done ? (
          <p className="lede mt-4">{t("form.thanks")}</p>
        ) : (
          <form className="grid gap-6 mt-4" onSubmit={(e) => void onSubmit(e)}>
            <p className="lede">{t("form.lede")}</p>
            <fieldset className="form-block">
              <legend>{t("form.personal")}</legend>
              <label>
                {t("form.fullName")}
                <input required value={form.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
              </label>
              <label>
                {t("form.birthDate")}
                <input required type="date" value={form.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} />
              </label>
              <label>
                {t("form.sex")}
                <select value={form.sex} onChange={(e) => patch({ sex: e.target.value as AdhesionApplicantSubmit["sex"] })}>
                  <option value="female">{t("form.female")}</option>
                  <option value="male">{t("form.male")}</option>
                  <option value="other">{t("form.other")}</option>
                </select>
              </label>
              <label>
                {t("form.address")}
                <input required value={form.address} onChange={(e) => patch({ address: e.target.value })} />
              </label>
              <label>
                {t("form.phone")}
                <input required value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </label>
              <label>
                {t("form.email")}
                <input required type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
              </label>
              <label>
                {t("form.profession")}
                <input required value={form.profession} onChange={(e) => patch({ profession: e.target.value })} />
              </label>
            </fieldset>

            <fieldset className="form-block">
              <legend>{t("form.pledge")}</legend>
              <p className="hint">{t("form.pledgeLead")}</p>
              <label>
                {t("form.pledgeName")}
                <input required value={form.pledgeName} onChange={(e) => patch({ pledgeName: e.target.value })} />
              </label>
              <label className="check-row">
                <input type="checkbox" required checked={form.pledgeRules} onChange={(e) => patch({ pledgeRules: e.target.checked })} />
                <span>{t("form.pledgeRules")}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={form.pledgeParticipate}
                  onChange={(e) => patch({ pledgeParticipate: e.target.checked })}
                />
                <span>{t("form.pledgeParticipate")}</span>
              </label>
              <label className="check-row">
                <input type="checkbox" required checked={form.pledgeDues} onChange={(e) => patch({ pledgeDues: e.target.checked })} />
                <span>{t("form.pledgeDues")}</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={form.pledgeObservation}
                  onChange={(e) => patch({ pledgeObservation: e.target.checked })}
                />
                <span>{t("form.pledgeObservation")}</span>
              </label>
              <label>
                {t("form.applicantSignature")}
                <input required value={form.applicantSignature} onChange={(e) => patch({ applicantSignature: e.target.value })} />
              </label>
            </fieldset>

            <fieldset className="form-block">
              <legend>{t("form.sponsor")}</legend>
              <p className="hint">{t("form.sponsorInvite")}</p>
              <label>
                {t("form.sponsorName")}
                <input required value={form.sponsorName} onChange={(e) => patch({ sponsorName: e.target.value })} />
              </label>
              <label>
                {t("form.sponsorEmail")}
                <input
                  required
                  type="email"
                  value={form.sponsorEmail}
                  onChange={(e) => patch({ sponsorEmail: e.target.value })}
                />
              </label>
            </fieldset>

            {error ? <p className="text-sm text-ticket">{error}</p> : null}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t("form.sending") : t("form.submit")}
            </button>
          </form>
        )}
      </section>
    </JoinShell>
  );
}

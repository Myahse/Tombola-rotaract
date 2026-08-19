import { useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const { member, loading } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (loading) return <PageSkeleton kind="auth" />;
  if (member) return <Navigate to={`/${lang}/account`} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.forgotPassword(String(form.get("email") ?? ""));
      setSent(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(code === "too_many_requests" ? t("errors.tooMany") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.forgotTitle")}</h1>
      <p>{t("auth.forgotLead")}</p>
      {sent ? (
        <p className="mt-6">{t("auth.forgotSent")}</p>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label>
            {t("auth.email")}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          {error ? <p className="text-sm text-ticket">{error}</p> : null}
          <button disabled={busy} className="btn-primary btn-block">
            {busy ? t("auth.submitting") : t("auth.forgotSubmit")}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to={`/${lang}/login`}>{t("auth.forgotBack")}</Link>
      </p>
    </section>
  );
}

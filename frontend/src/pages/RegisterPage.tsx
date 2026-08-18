import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";

export function RegisterPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next") || `/${lang}/account`;

  if (!loading && member) {
    return <Navigate to={next.startsWith("/") ? next : `/${lang}/account`} replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.register({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        password,
      });
      await refresh();
      navigate(next.startsWith("/") ? next : `/${lang}/account`, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "email_taken"
          ? t("errors.emailTaken")
          : code === "invalid_form"
            ? t("errors.weakPassword")
            : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.registerTitle")}</h1>
      <p>{t("auth.registerLead")}</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <label>
          {t("auth.name")}
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
        <label>
          {t("auth.email")}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {t("auth.phone")}
          <input name="phone" autoComplete="tel" />
        </label>
        <label>
          {t("auth.password")}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label>
          {t("auth.confirmPassword")}
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button disabled={busy} className="btn-primary btn-block">
          {busy ? t("auth.submitting") : t("auth.submitRegister")}
        </button>
      </form>
      <p className="auth-switch">
        {t("auth.haveAccount")}{" "}
        <Link to={`/${lang}/login?next=${encodeURIComponent(next)}`}>{t("nav.login")}</Link>
      </p>
    </section>
  );
}

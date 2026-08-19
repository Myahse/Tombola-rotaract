import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";

export function LoginPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next") || `/${lang}/account`;

  if (loading) return <PageSkeleton kind="auth" />;
  if (member) {
    return <Navigate to={next.startsWith("/") ? next : `/${lang}/account`} replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.memberLogin({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      await refresh();
      navigate(next.startsWith("/") ? next : `/${lang}/account`, { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message === "invalid_credentials" ? t("errors.invalidCredentials") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.loginTitle")}</h1>
      <p>{t("auth.loginLead")}</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <label>
          {t("auth.email")}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {t("auth.password")}
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button disabled={busy} className="btn-primary btn-block">
          {busy ? t("auth.submitting") : t("auth.submitLogin")}
        </button>
      </form>
      <p className="auth-switch">
        {t("auth.noAccount")}{" "}
        <Link to={`/${lang}/register?next=${encodeURIComponent(next)}`}>{t("nav.register")}</Link>
      </p>
    </section>
  );
}

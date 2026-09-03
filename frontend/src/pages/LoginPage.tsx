import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { formatApiError, isRetryableError } from "../formatApiError";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";
import { PasswordField } from "../components/PasswordField";
import { safeNextPath } from "../safeNext";

export function LoginPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = safeNextPath(params.get("next"), lang);

  if (loading) return <PageSkeleton kind="auth" />;
  if (member) {
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setRetryable(false);
    try {
      await api.memberLogin({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      await refresh();
      navigate(next, { replace: true });
    } catch (err) {
      setRetryable(isRetryableError(err));
      setError(formatApiError(err, t));
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
        <PasswordField
          label={t("auth.password")}
          name="password"
          required
          autoComplete="current-password"
        />
        <p className="auth-forgot">
          <Link to={`/${lang}/forgot`}>{t("auth.forgotLink")}</Link>
        </p>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button disabled={busy} className="btn-primary btn-block">
          {busy ? t("auth.submitting") : retryable ? t("errors.retryAction") : t("auth.submitLogin")}
        </button>
      </form>
      <p className="auth-switch">
        {t("auth.noAccount")}{" "}
        <Link to={`/${lang}/register?next=${encodeURIComponent(next)}`}>{t("nav.register")}</Link>
      </p>
    </section>
  );
}

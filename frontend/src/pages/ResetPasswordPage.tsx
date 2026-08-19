import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, loading } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = params.get("token") ?? "";

  if (loading) return <PageSkeleton kind="auth" />;

  if (!token) {
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{t("auth.resetTitle")}</h1>
        <p>{t("errors.invalidToken")}</p>
        <p className="auth-switch">
          <Link to={`/${lang}/forgot`}>{t("auth.forgotTitle")}</Link>
        </p>
      </section>
    );
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
      await api.resetPassword({ token, password });
      await refresh();
      navigate(`/${lang}/account`, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "invalid_token"
          ? t("errors.invalidToken")
          : code === "too_many_requests"
            ? t("errors.tooMany")
            : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.resetTitle")}</h1>
      <p>{t("auth.resetLead")}</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
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
          {busy ? t("auth.submitting") : t("auth.resetSubmit")}
        </button>
      </form>
      <p className="auth-switch">
        <Link to={`/${lang}/login`}>{t("auth.forgotBack")}</Link>
      </p>
    </section>
  );
}

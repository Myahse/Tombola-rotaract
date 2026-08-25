import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { memberSiteUrl } from "../config";

export function LoginPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registerUrl = memberSiteUrl(`/${lang ?? "fr"}/register`);

  if (loading) return <p className="lede">…</p>;
  if (member) return <Navigate to={`/${lang}`} replace />;

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
      navigate(`/${lang}`, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(code === "api_down" ? t("errors.apiDown") : t("errors.invalidCredentials"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.loginTitle")}</h1>
      <p className="lede">{t("auth.loginLead")}</p>
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
        <a href={registerUrl}>{t("auth.createAccount")}</a>
      </p>
    </section>
  );
}

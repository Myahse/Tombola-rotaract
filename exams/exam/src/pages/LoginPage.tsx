import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { memberSiteUrl } from "../config";

function safeNext(raw: string | null, lang: string) {
  if (!raw) return `/${lang}/induction`;
  try {
    const value = decodeURIComponent(raw);
    const match = value.match(/^\/(fr|en)\/([a-z0-9-]{2,40})$/);
    if (!match?.[2]) return `/${lang}/induction`;
    return `/${lang}/${match[2]}`;
  } catch {
    return `/${lang}/induction`;
  }
}

export function LoginPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"), lang ?? "fr");
  const registerUrl = memberSiteUrl(`/${lang ?? "fr"}/register`);

  if (loading) return <p className="lede">…</p>;
  if (member) return <Navigate to={next} replace />;

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
      navigate(next, { replace: true });
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

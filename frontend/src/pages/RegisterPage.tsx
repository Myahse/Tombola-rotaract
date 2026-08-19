import { useState, type FormEvent, type MouseEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";
import { resizeImage } from "../resizeImage";

export function RegisterPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptEmails, setAcceptEmails] = useState(false);
  const next = params.get("next") || `/${lang}/account`;

  if (loading) return <PageSkeleton kind="register" />;
  if (member) {
    return <Navigate to={next.startsWith("/") ? next : `/${lang}/account`} replace />;
  }

  async function onPhoto(file: File | undefined) {
    if (!file) {
      setAvatarUrl("");
      return;
    }
    const dataUrl = await resizeImage(file);
    setAvatarUrl(dataUrl ?? "");
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
    if (!acceptTerms || !acceptEmails) {
      setError(t("errors.termsRequired"));
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
        avatarUrl: avatarUrl || undefined,
        acceptTerms: true,
        acceptEmails: true,
      });
      await refresh();
      navigate(next.startsWith("/") ? next : `/${lang}/account`, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "email_taken"
          ? t("errors.emailTaken")
          : code === "terms_required"
            ? t("errors.termsRequired")
            : code === "invalid_form"
            ? t("errors.invalidRegister")
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
        <label className="avatar-picker">
          <span>{t("auth.photo")}</span>
          <span className="avatar-picker-row">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="person-avatar" width={72} height={72} />
            ) : (
              <span className="person-avatar fallback" style={{ width: 72, height: 72, fontSize: 22 }}>
                +
              </span>
            )}
            <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </span>
        </label>
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
          <input name="phone" type="tel" required minLength={8} autoComplete="tel" inputMode="tel" />
        </label>
        <label>
          {t("auth.password")}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label>
          {t("auth.confirmPassword")}
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <fieldset className="pay-options">
          <legend>{t("auth.termsLegend")}</legend>
          <label className={`pay-option legal-check ${acceptTerms ? "active" : ""}`}>
            <input
              type="checkbox"
              name="acceptTerms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
            />
            <span>
              {t("auth.acceptTerms")}{" "}
              <a
                href={`/${lang}/terms`}
                className="terms-link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
              >
                {t("auth.termsLink")}
              </a>
            </span>
          </label>
          <label className={`pay-option legal-check ${acceptEmails ? "active" : ""}`}>
            <input
              type="checkbox"
              name="acceptEmails"
              checked={acceptEmails}
              onChange={(e) => setAcceptEmails(e.target.checked)}
              required
            />
            <span>{t("auth.acceptEmails")}</span>
          </label>
        </fieldset>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button disabled={busy || !acceptTerms || !acceptEmails} className="btn-primary btn-block">
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

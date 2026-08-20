import { useState, type FormEvent, type MouseEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";
import { resizeImage } from "../resizeImage";
import { safeNextPath } from "../safeNext";

const ROLE_SUGGESTIONS = [
  "Membre",
  "Président",
  "Vice-président",
  "Secrétaire",
  "Trésorier",
  "Sergent d’armes",
  "Directeur",
  "Past President",
  "Ami du club",
];

export function RegisterPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { member, loading, refresh } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubRole, setClubRole] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptEmails, setAcceptEmails] = useState(false);
  const next = safeNextPath(params.get("next"), lang);

  if (loading) return <PageSkeleton kind="register" />;
  if (member) {
    return <Navigate to={next} replace />;
  }

  async function onPhoto(file: File | undefined) {
    if (!file) {
      setAvatarUrl("");
      return;
    }
    const dataUrl = await resizeImage(file);
    setAvatarUrl(dataUrl ?? "");
  }

  function goStep2(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    setError("");
    setStep(2);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptTerms || !acceptEmails) {
      setError(t("errors.termsRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.register({
        name,
        email,
        phone,
        password,
        avatarUrl: avatarUrl || undefined,
        clubName,
        clubRole,
        acceptTerms: true,
        acceptEmails: true,
      });
      await refresh();
      navigate(next, { replace: true });
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
      <p className="register-steps" aria-hidden>
        <span className={step === 1 ? "is-on" : ""}>1</span>
        <span className={step === 2 ? "is-on" : ""}>2</span>
      </p>
      <h1>{step === 1 ? t("auth.step1Title") : t("auth.step2Title")}</h1>
      <p>{step === 1 ? t("auth.step1Lead") : t("auth.step2Lead")}</p>

      {step === 1 ? (
        <form className="mt-6 grid gap-4" onSubmit={goStep2}>
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
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
          </label>
          <label>
            {t("auth.email")}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </label>
          <label>
            {t("auth.phone")}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              required
              minLength={8}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label>
            {t("auth.password")}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t("auth.confirmPassword")}
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-sm text-ticket">{error}</p> : null}
          <button className="btn-primary btn-block">{t("auth.nextStep")}</button>
        </form>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={(e) => void onSubmit(e)}>
          <label>
            {t("auth.clubName")}
            <input
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              required
              minLength={2}
              placeholder={t("auth.clubNameHint")}
              autoComplete="organization"
            />
          </label>
          <label>
            {t("auth.clubRole")}
            <input
              value={clubRole}
              onChange={(e) => setClubRole(e.target.value)}
              required
              minLength={2}
              list="club-roles"
              placeholder={t("auth.clubRoleHint")}
            />
            <datalist id="club-roles">
              {ROLE_SUGGESTIONS.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
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
          <button
            type="button"
            className="btn-ghost btn-block"
            onClick={() => {
              setError("");
              setStep(1);
            }}
          >
            {t("auth.backStep")}
          </button>
        </form>
      )}
      <p className="auth-switch">
        {t("auth.haveAccount")}{" "}
        <Link to={`/${lang}/login?next=${encodeURIComponent(next)}`}>{t("nav.login")}</Link>
      </p>
    </section>
  );
}

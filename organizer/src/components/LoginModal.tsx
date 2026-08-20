import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { inferredClubSlug, rememberClubSlug } from "../clubSlug";

export function LoginModal({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const clubSlug = String(form.get("clubSlug") ?? inferredClubSlug());
      rememberClubSlug(clubSlug);
      await api.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        clubSlug,
      });
      onSuccess();
    } catch {
      setError(t("errors.invalidCredentials"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="organizer-login-title">
      <div className="modal-card">
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1 id="organizer-login-title">{t("admin.loginTitle")}</h1>
        <p className="modal-lead">{t("admin.loginLead")}</p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label>
            {t("admin.clubSlug")}
            <input name="clubSlug" defaultValue={inferredClubSlug()} autoComplete="organization" required />
          </label>
          <label>
            {t("admin.email")}
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            {t("admin.password")}
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          {error ? <p className="text-sm text-ticket">{error}</p> : null}
          <button disabled={busy} className="btn-primary btn-block">
            {busy ? t("admin.loggingIn") : t("admin.login")}
          </button>
        </form>
      </div>
    </div>
  );
}

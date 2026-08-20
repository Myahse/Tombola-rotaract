import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isLanguage } from "../i18n";
import { api } from "../api";
import { LangSwitcher } from "./LangSwitcher";

export function Layout() {
  const { lang } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<"loading" | "yes" | "no">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLanguage(lang)) {
      navigate("/fr", { replace: true });
      return;
    }
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.title = t("login.title");
  }, [lang, i18n, navigate, t]);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed("yes"))
      .catch(() => setAuthed("no"));
  }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      setAuthed("yes");
    } catch (err) {
      setError(
        err instanceof Error && err.message === "api_down" ? t("errors.apiDown") : t("errors.invalidCredentials"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await api.logout();
    setAuthed("no");
    setPassword("");
  }

  if (authed === "loading") {
    return (
      <div className="app-shell">
        <main className="page">
          <p className="lede">…</p>
        </main>
      </div>
    );
  }

  if (authed === "no") {
    return (
      <div className="app-shell">
        <header className="site-header">
          <p className="brand-row">{t("login.title")}</p>
          <div className="header-end">
            <LangSwitcher />
          </div>
        </header>
        <main className="page">
          <section className="stack" style={{ maxWidth: 420, margin: "2rem auto" }}>
            <p className="eyebrow">{t("login.kicker")}</p>
            <h1>{t("login.title")}</h1>
            <p className="lede">{t("login.lead")}</p>
            <form className="grid gap-4" onSubmit={onLogin}>
              <label>
                {t("login.password")}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error ? <p className="text-sm text-ticket">{error}</p> : null}
              <button className="btn-primary" disabled={busy}>
                {busy ? t("login.busy") : t("login.submit")}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to={`/${lang}`} className="brand-row">
          {t("login.title")}
        </NavLink>
        <nav className="site-nav hide-mobile">
          <NavLink to={`/${lang}`} end className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav.clubs")}
          </NavLink>
        </nav>
        <div className="header-end">
          <button type="button" className="header-auth" onClick={() => void onLogout()}>
            {t("nav.logout")}
          </button>
          <LangSwitcher />
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

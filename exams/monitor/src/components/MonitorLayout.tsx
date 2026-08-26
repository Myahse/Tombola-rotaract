import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { isLanguage } from "../i18n";
import { LangSwitcher } from "./LangSwitcher";
import { BrandLogo } from "./BrandLogo";
import { LoginModal } from "./LoginModal";
import { PwaPrompts } from "./PwaPrompts";
import { LiveProvider } from "../live";

export function MonitorLayout() {
  const { lang } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState<"loading" | "yes" | "no">("loading");

  useEffect(() => {
    if (!isLanguage(lang)) {
      navigate("/fr", { replace: true });
      return;
    }
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang, i18n, navigate]);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed("yes"))
      .catch(() => setAuthed("no"));
  }, []);

  const base = `/${lang}`;
  const loggedIn = authed === "yes";

  async function onLogout() {
    await api.logout();
    setAuthed("no");
    navigate(base);
  }

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <NavLink to={base} className="brand-row">
          <BrandLogo />
        </NavLink>
        {loggedIn ? (
          <nav className="site-nav hide-mobile" aria-label="Monitor">
            <NavLink to={base} end className={({ isActive }) => (isActive ? "active" : "")}>
              {t("nav.live")}
            </NavLink>
            <NavLink to={`${base}/questions`} className={({ isActive }) => (isActive ? "active" : "")}>
              {t("nav.questions")}
            </NavLink>
          </nav>
        ) : null}
        <div className="header-end">
          {loggedIn ? (
            <button type="button" className="header-auth" onClick={() => void onLogout()}>
              <span className="hide-mobile">{t("admin.logout")}</span>
              <span className="show-mobile">{t("admin.logoutShort")}</span>
            </button>
          ) : null}
          <LangSwitcher />
        </div>
      </header>
      <PwaPrompts authed={loggedIn} />
      <main className="page">
        {loggedIn ? (
          <LiveProvider>
            <div key={`${authed}-${location.pathname}`} className="page-appear">
              <Outlet />
            </div>
          </LiveProvider>
        ) : (
          <div key={`${authed}-${location.pathname}`} className="page-appear">
            {authed === "loading" ? <p className="lede">…</p> : null}
          </div>
        )}
      </main>
      {loggedIn ? (
        <nav className="bottom-nav nav-2 show-mobile no-print" aria-label="Mobile">
          <NavLink to={base} end className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav.live")}
          </NavLink>
          <NavLink to={`${base}/questions`} className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav.questions")}
          </NavLink>
        </nav>
      ) : null}
      {authed === "no" ? <LoginModal onSuccess={() => setAuthed("yes")} /> : null}
    </div>
  );
}

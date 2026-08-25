import { NavLink, Outlet, useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isLanguage } from "../i18n";
import { StayProvider, useStay } from "../stay";
import { LangSwitcher } from "./LangSwitcher";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../auth";

export function Layout() {
  return (
    <StayProvider>
      <ExamShell />
    </StayProvider>
  );
}

function ExamShell() {
  const { lang } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { member, logout } = useAuth();
  const { locked } = useStay();
  const blocker = useBlocker(locked);

  useEffect(() => {
    if (!isLanguage(lang)) {
      navigate("/fr", { replace: true });
      return;
    }
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang, i18n, navigate]);

  useEffect(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!locked) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [locked]);

  const base = `/${lang ?? "fr"}`;

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        {locked ? (
          <span className="brand-row">
            <BrandLogo />
          </span>
        ) : (
          <NavLink to={base} className="brand-row">
            <BrandLogo />
          </NavLink>
        )}
        <div className="header-end">
          {member && !locked ? (
            <button type="button" className="header-auth" onClick={() => void logout()}>
              {t("nav.logout")}
            </button>
          ) : null}
          {!member ? (
            <NavLink to={`${base}/login`} className="header-auth">
              {t("nav.login")}
            </NavLink>
          ) : null}
          <LangSwitcher disabled={locked} />
        </div>
      </header>
      <main className="page">
        <div key={location.pathname} className="page-appear">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

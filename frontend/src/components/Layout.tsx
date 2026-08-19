import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isLanguage } from "../i18n";
import { LangSwitcher } from "./LangSwitcher";
import { BrandLogo } from "./BrandLogo";
import { PwaPrompts } from "./PwaPrompts";
import { useAuth } from "../auth";

export function Layout() {
  const { lang } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { member, logout } = useAuth();

  useEffect(() => {
    if (!isLanguage(lang)) {
      navigate("/fr", { replace: true });
      return;
    }
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang, i18n, navigate]);

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  const base = `/${lang ?? "fr"}`;
  const items = [
    { to: base, end: true, label: t("nav.home") },
    { to: `${base}/tombola`, end: false, label: t("nav.tombola") },
    { to: `${base}/buy`, end: false, label: t("nav.buyShort") },
    { to: `${base}/donate`, end: false, label: t("nav.donate") },
    { to: `${base}/results`, end: false, label: t("nav.results") },
    member
      ? { to: `${base}/account`, end: false, label: t("nav.accountShort") }
      : { to: `${base}/login`, end: false, label: t("nav.login") },
  ];

  const navLinks = (id: string) =>
    items.map((item) => (
      <NavLink key={`${id}-${item.to}`} to={item.to} end={item.end} className={navClass}>
        {item.label}
      </NavLink>
    ));

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <NavLink to={base} className="brand-row">
          <BrandLogo />
        </NavLink>
        <nav className="site-nav hide-mobile" aria-label="Primary">
          {navLinks("top")}
        </nav>
        <div className="header-end">
          {member ? (
            <button type="button" className="header-auth" onClick={() => void logout()}>
              {t("nav.logout")}
            </button>
          ) : (
            <NavLink to={`${base}/login`} className="header-auth hide-mobile">
              {t("nav.login")}
            </NavLink>
          )}
          <LangSwitcher />
        </div>
      </header>
      <PwaPrompts />
      <main className="page">
        <div key={location.pathname} className="page-appear">
          <Outlet />
        </div>
      </main>
      <nav className="bottom-nav show-mobile no-print" aria-label="Mobile">
        {navLinks("bottom")}
      </nav>
    </div>
  );
}

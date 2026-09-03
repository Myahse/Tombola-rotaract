import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isLanguage } from "../i18n";
import { LangSwitcher } from "./LangSwitcher";
import { BrandLogo } from "./BrandLogo";
import { NavIcon, type IconName } from "./NavIcon";
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
  const items: { to: string; end: boolean; label: string; icon: IconName }[] = [
    { to: base, end: true, label: t("nav.home"), icon: "home" },
    { to: `${base}/tombola`, end: false, label: t("nav.tombola"), icon: "tombola" },
    { to: `${base}/buy`, end: false, label: t("nav.buyShort"), icon: "buy" },
    { to: `${base}/donate`, end: false, label: t("nav.donate"), icon: "donate" },
    { to: `${base}/results`, end: false, label: t("nav.results"), icon: "results" },
    member
      ? { to: `${base}/account`, end: false, label: t("nav.accountShort"), icon: "account" }
      : { to: `${base}/login`, end: false, label: t("nav.login"), icon: "login" },
  ];

  const navLinks = (id: string, withIcons = false) =>
    items.map((item) => (
      <NavLink key={`${id}-${item.to}`} to={item.to} end={item.end} className={navClass}>
        {withIcons ? <NavIcon name={item.icon} /> : null}
        <span>{item.label}</span>
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
        {navLinks("bottom", true)}
      </nav>
    </div>
  );
}

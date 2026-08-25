import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { LangSwitcher } from "./LangSwitcher";
import { isLanguage } from "../i18n";
import { useTranslation } from "react-i18next";

export function JoinShell({ children }: { children: ReactNode }) {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLanguage(lang)) {
      void i18n.changeLanguage(lang);
      document.documentElement.lang = lang;
      return;
    }
    const parts = location.pathname.split("/");
    parts[1] = "fr";
    navigate(parts.join("/") + location.search, { replace: true });
  }, [lang, i18n, navigate, location.pathname, location.search]);

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <span className="brand-row">
          <BrandLogo />
        </span>
        <div className="header-end">
          <LangSwitcher />
        </div>
      </header>
      <main className="page page-join">{children}</main>
    </div>
  );
}

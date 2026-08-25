import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function LangSwitcher({ disabled = false }: { disabled?: boolean }) {
  const { lang } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const switchLang = (next: "fr" | "en") => {
    if (disabled) return;
    const parts = location.pathname.split("/");
    parts[1] = next;
    navigate(parts.join("/") + location.search);
  };

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === "fr" ? "active" : ""} disabled={disabled} onClick={() => switchLang("fr")}>
        {t("lang.fr")}
      </button>
      <button type="button" className={lang === "en" ? "active" : ""} disabled={disabled} onClick={() => switchLang("en")}>
        {t("lang.en")}
      </button>
    </div>
  );
}

import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function LangSwitcher() {
  const { lang } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const switchLang = (next: "fr" | "en") => {
    const parts = location.pathname.split("/");
    parts[1] = next;
    navigate(parts.join("/") + location.search);
  };

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => switchLang("fr")}>
        {t("lang.fr")}
      </button>
      <button type="button" className={lang === "en" ? "active" : ""} onClick={() => switchLang("en")}>
        {t("lang.en")}
      </button>
    </div>
  );
}

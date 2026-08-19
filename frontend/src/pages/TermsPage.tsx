import { useTranslation } from "react-i18next";

export function TermsBody() {
  const { t } = useTranslation();
  return (
    <div className="terms-copy">
      <p>{t("auth.termsBody")}</p>
      <p>{t("auth.termsEmails")}</p>
    </div>
  );
}

export function TermsPage() {
  const { t } = useTranslation();
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <h1>{t("auth.termsTitle")}</h1>
      <TermsBody />
    </section>
  );
}

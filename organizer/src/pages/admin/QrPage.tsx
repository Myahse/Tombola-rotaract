import { useTranslation } from "react-i18next";
import { WaveLogo } from "../../components/WaveLogo";

export function QrPage() {
  const { t } = useTranslation();

  return (
    <section className="qr-display">
      <h1 className="pay-label">
        <WaveLogo className="lg" />
        {t("admin.qrTitle")}
      </h1>
      <p className="lede">{t("admin.qrLead")}</p>
      <img
        src="/wave-qr.png"
        alt={t("admin.qr")}
        className="qr-display-image"
        width={1024}
        height={1024}
      />
    </section>
  );
}

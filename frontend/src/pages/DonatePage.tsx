import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";

export function DonatePage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [wavePayUrl, setWavePayUrl] = useState("");

  useEffect(() => {
    api
      .payments()
      .then((data) => setWavePayUrl(safeWavePayUrl(data.wavePayUrl)))
      .catch(() => setWavePayUrl(safeWavePayUrl("https://pay.wave.com/m/M_ci_pHlyZFYyH1Su/c/ci/")));
  }, []);

  return (
    <>
      <section className="vitrine-hero">
        <img
          src="/logo.png"
          alt="Rotaract IUGB Club"
          className="brand-logo hero"
          width={960}
          height={614}
          decoding="async"
          fetchPriority="high"
        />
        <p className="eyebrow">{t("donate.kicker")}</p>
        <h1>{t("donate.title")}</h1>
        <p className="lede">{t("donate.lede")}</p>
        <p className="lede">{t("pay.affiliate")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {wavePayUrl ? (
            <a className="btn-primary" href={wavePayUrl} target="_blank" rel="noopener noreferrer">
              {t("donate.waveCta")}
            </a>
          ) : null}
          <Link to={`/${lang}/buy`} className="btn-outline">
            {t("nav.buy")}
          </Link>
        </div>
      </section>

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("donate.howTitle")}</h2>
        <div className="pillar-grid">
          <article className="pillar">
            <h3 className="pay-label">
              <WaveLogo />
              {t("pay.wave")}
            </h3>
            <p>{t("donate.waveText")}</p>
          </article>
          <article className="pillar">
            <h3>{t("pay.cash")}</h3>
            <p>{t("donate.cashText")}</p>
          </article>
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";
import { BrandLogo } from "../components/BrandLogo";
import { NoticeModal } from "../components/NoticeModal";
import { DonateRefSheet } from "../components/DonateRefSheet";

export function DonatePage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const { member } = useAuth();
  const [wavePayUrl, setWavePayUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showRefSheet, setShowRefSheet] = useState(false);

  useEffect(() => {
    api
      .payments()
      .then((data) => setWavePayUrl(safeWavePayUrl(data.wavePayUrl)))
      .catch(() => setWavePayUrl(safeWavePayUrl("https://pay.wave.com/m/M_ci_pHlyZFYyH1Su/c/ci/")));
  }, []);

  useEffect(() => {
    if (!member) return;
    setName((current) => current || member.name);
    setEmail((current) => current || member.email);
  }, [member]);

  async function submitDonationRef() {
    setBusy(true);
    setError("");
    try {
      await api.donate({
        name,
        email,
        amount: Number(amount),
        paymentRef,
      });
      setPaymentRef("");
      setAmount("");
      setNotice(t("donate.sent"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "invalid_form"
          ? t("donate.invalid")
          : code === "too_many_requests"
            ? t("errors.tooMany")
            : t("errors.generic"),
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="vitrine-hero">
        <BrandLogo hero />
        <p className="eyebrow">{t("donate.kicker")}</p>
        <h1>{t("donate.title")}</h1>
        <p className="lede">{t("donate.lede")}</p>
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

      <section className="section">
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

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("donate.refTitle")}</h2>
        <p className="lede">{t("donate.refHelp")}</p>
        {error && !showRefSheet ? <p className="text-sm text-ticket mt-4">{error}</p> : null}
        <button
          type="button"
          className="btn-primary btn-block mt-6"
          onClick={() => {
            setError("");
            setShowRefSheet(true);
          }}
        >
          {t("donate.send")}
        </button>
      </section>

      {showRefSheet ? (
        <DonateRefSheet
          title={t("donate.refTitle")}
          help={t("donate.refHelp")}
          name={name}
          email={email}
          amount={amount}
          paymentRef={paymentRef}
          nameLabel={t("buy.name")}
          emailLabel={t("buy.email")}
          amountLabel={t("donate.amount")}
          refLabel={t("pay.waveId")}
          refPlaceholder={t("pay.waveIdPlaceholder")}
          confirmLabel={busy ? t("donate.sending") : t("donate.send")}
          cancelLabel={t("pay.waveRefClose")}
          busy={busy}
          error={error}
          onNameChange={setName}
          onEmailChange={setEmail}
          onAmountChange={setAmount}
          onPaymentRefChange={setPaymentRef}
          onConfirm={() => submitDonationRef()}
          onClose={() => {
            setShowRefSheet(false);
            setError("");
          }}
        />
      ) : null}

      {notice ? (
        <NoticeModal title={t("donate.title")} body={notice} okLabel={t("donate.ok")} onClose={() => setNotice("")} />
      ) : null}
    </>
  );
}

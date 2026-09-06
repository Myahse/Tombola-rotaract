import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DonateReceiptSheet } from "../components/DonateReceiptSheet";
import { uploadReceipt } from "../lib/receiptUpload";
import { api } from "../api";
import { useAuth } from "../auth";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";
import { BrandLogo } from "../components/BrandLogo";
import { NoticeModal } from "../components/NoticeModal";
import { Link, useParams } from "react-router-dom";

export function DonatePage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const { member } = useAuth();
  const [wavePayUrl, setWavePayUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSheet, setShowSheet] = useState(false);

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

  async function submitDonation(file: File) {
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadReceipt("donations", file);
      await api.donate({
        name,
        email,
        amount: Number(amount),
        receiptKey: uploaded.key,
        receiptMime: uploaded.mimeType,
      });
      setAmount("");
      setNotice(t("donate.sent"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "invalid_form" || code === "receipt_missing"
          ? t("donate.invalid")
          : code === "storage_unavailable"
            ? t("receiptUpload.storageUnavailable")
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
        {error && !showSheet ? <p className="text-sm text-ticket mt-4">{error}</p> : null}
        <button
          type="button"
          className="btn-primary btn-block mt-6"
          onClick={() => {
            setError("");
            setShowSheet(true);
          }}
        >
          {t("donate.send")}
        </button>
      </section>

      {showSheet ? (
        <DonateReceiptSheet
          title={t("donate.refTitle")}
          help={t("donate.refHelp")}
          name={name}
          email={email}
          amount={amount}
          nameLabel={t("buy.name")}
          emailLabel={t("buy.email")}
          amountLabel={t("donate.amount")}
          confirmLabel={busy ? t("donate.sending") : t("donate.send")}
          cancelLabel={t("receiptUpload.close")}
          busy={busy}
          error={error}
          onNameChange={setName}
          onEmailChange={setEmail}
          onAmountChange={setAmount}
          onConfirm={(file) => submitDonation(file)}
          onClose={() => {
            setShowSheet(false);
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

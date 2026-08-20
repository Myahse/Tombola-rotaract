import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { safeWavePayUrl } from "../safeWave";
import { WaveLogo } from "../components/WaveLogo";
import { BrandLogo } from "../components/BrandLogo";
import { NoticeModal } from "../components/NoticeModal";

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        <form className="mt-6 grid gap-4" onSubmit={(e) => void onSubmit(e)}>
          <label>
            {t("buy.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
          <label>
            {t("buy.email")}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          </label>
          <label>
            {t("donate.amount")}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min={100}
              step={100}
              required
            />
          </label>
          <label>
            {t("pay.waveId")}
            <input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder={t("pay.waveIdPlaceholder")}
              required
              minLength={4}
              maxLength={80}
              autoComplete="off"
            />
          </label>
          {error ? <p className="text-sm text-ticket">{error}</p> : null}
          <button className="btn-primary" disabled={busy}>
            {busy ? t("donate.sending") : t("donate.send")}
          </button>
        </form>
      </section>
      {notice ? (
        <NoticeModal title={t("donate.title")} body={notice} okLabel={t("donate.ok")} onClose={() => setNotice("")} />
      ) : null}
    </>
  );
}

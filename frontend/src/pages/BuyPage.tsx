import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, eventCanBuy, eventPreRegister, formatMoney } from "../api";
import { formatApiError, isRetryableError } from "../formatApiError";
import { useAuth } from "../auth";
import type { PublicEvent } from "../types";
import { PageSkeleton } from "../components/PageSkeleton";
import { SalesCountdown } from "../components/SalesCountdown";
import { WaveLogo } from "../components/WaveLogo";

export function BuyPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();
  const { member, loading } = useAuth();
  const [event, setEvent] = useState<PublicEvent | null | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wave">("wave");
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .currentEvent()
      .then((data) => setEvent(data.event))
      .catch(() => setEvent(null));
  }, []);

  if (loading) {
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{t("buy.title")}</h1>
      </section>
    );
  }
  if (!member) {
    const next = `/${lang}/buy`;
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{t("buy.title")}</h1>
        <p>{t("buy.needAccount")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/${lang}/login?next=${encodeURIComponent(next)}`} className="btn-primary">
            {t("nav.login")}
          </Link>
          <Link to={`/${lang}/register?next=${encodeURIComponent(next)}`} className="btn-outline">
            {t("nav.register")}
          </Link>
        </div>
      </section>
    );
  }
  if (event === undefined) return <PageSkeleton kind="buy" />;
  if (!event || event.status !== "on_sale") {
    return (
      <section className="vitrine-hero">
        <h1>{t("buy.none")}</h1>
        <Link to={`/${lang}`} className="btn-outline">
          {t("nav.home")}
        </Link>
      </section>
    );
  }
  if (!eventCanBuy(event)) {
    const preRegister = eventPreRegister(event);
    return (
      <section className="section" style={{ borderBottom: 0 }}>
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>{t("buy.title")}</h1>
        {preRegister && event.salesOpensAt ? <SalesCountdown opensAt={event.salesOpensAt} /> : null}
        <p className="mt-4">{preRegister ? t("sales.preRegisterLead") : t("buy.none")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {preRegister ? (
            <Link to={`/${lang}/register?next=${encodeURIComponent(`/${lang}/buy`)}`} className="btn-primary">
              {t("sales.preRegisterCta")}
            </Link>
          ) : null}
          <Link to={`/${lang}`} className="btn-outline">
            {t("nav.home")}
          </Link>
        </div>
      </section>
    );
  }

  const max = Math.min(20, event.remainingTickets);
  const total = formatMoney(event.ticketPriceCents * quantity, event.currency, i18n.language);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setRetryable(false);
    try {
      const order = await api.buy({
        quantity,
        phone: String(form.get("phone") ?? ""),
        paymentMethod,
      });
      const destination = order.eventId
        ? `/${lang}/my-tickets/${order.eventId}`
        : `/${lang}/tickets/${order.token}`;
      navigate(destination);
    } catch (err) {
      setRetryable(isRetryableError(err));
      setError(formatApiError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("buy.title")}</h1>
      <p>{t("buy.intro")}</p>
      <p>{event.drawMode === "roulette" ? t("buy.introRoulette") : t("buy.introScratch")}</p>
      <p className="buy-as">{t("buy.loggedInAs", { name: member.name, email: member.email })}</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <label>
          {t("buy.phone")}
          <input name="phone" defaultValue={member.phone ?? ""} />
        </label>
        <label>
          {t("buy.quantity")}
          <input
            type="number"
            min={1}
            max={max}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <fieldset className="pay-options">
          <legend>{t("buy.paymentMethod")}</legend>
          <label className={`pay-option ${paymentMethod === "wave" ? "active" : ""}`}>
            <input
              type="radio"
              name="paymentMethod"
              value="wave"
              checked={paymentMethod === "wave"}
              onChange={() => setPaymentMethod("wave")}
            />
            <span>
              <strong className="pay-option-head">
                <WaveLogo />
                {t("pay.wave")}
              </strong>
              <em>{t("pay.waveHint")}</em>
            </span>
          </label>
          <label className={`pay-option ${paymentMethod === "cash" ? "active" : ""}`}>
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={paymentMethod === "cash"}
              onChange={() => setPaymentMethod("cash")}
            />
            <span>
              <strong>{t("pay.cash")}</strong>
              <em>{t("pay.cashHint")}</em>
            </span>
          </label>
        </fieldset>
        <p>
          {t("buy.total")}: <strong>{total}</strong>
        </p>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button disabled={busy} className="btn-primary btn-block">
          {busy ? t("buy.submitting") : retryable ? t("errors.retryAction") : t("buy.submit")}
        </button>
      </form>
    </section>
  );
}

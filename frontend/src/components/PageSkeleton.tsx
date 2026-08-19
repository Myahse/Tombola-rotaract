import { useTranslation } from "react-i18next";
import { WaveLogo } from "./WaveLogo";

function Bone({
  w,
  h = "0.85rem",
  r = "6px",
  className = "",
}: {
  w?: string;
  h?: string;
  r?: string;
  className?: string;
}) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden />;
}

type Kind = "hero" | "auth" | "register" | "form" | "buy" | "tickets" | "account" | "list" | "results";

export function PageSkeleton({ kind = "form" }: { kind?: Kind }) {
  return (
    <div role="status" aria-busy="true">
      {kind === "hero" ? <HeroSkeleton /> : null}
      {kind === "auth" || kind === "form" ? <AuthSkeleton /> : null}
      {kind === "register" ? <RegisterSkeleton /> : null}
      {kind === "buy" ? <BuySkeleton /> : null}
      {kind === "tickets" ? <TicketsSkeleton /> : null}
      {kind === "account" ? <AccountSkeleton /> : null}
      {kind === "list" ? <AccountListSkeleton /> : null}
      {kind === "results" ? <ResultsSkeleton /> : null}
    </div>
  );
}

function HeroSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <section className="vitrine-hero">
        <span className="brand-dot lg" aria-hidden />
        <p className="eyebrow">{t("home.kicker")}</p>
        <h1>
          <Bone w="min(16rem, 80%)" h="1.85rem" />
        </h1>
        <p className="lede">
          <Bone w="100%" />
          <Bone w="72%" className="skeleton-gap" />
        </p>
        <span className="badge wait">
          <Bone w="6rem" h="0.7rem" />
        </span>
      </section>
      <section className="section">
        <dl className="fact-list">
          <div className="fact">
            <dt>{t("admin.remaining")}</dt>
            <dd>
              <Bone w="8rem" h="1rem" />
            </dd>
          </div>
          <div className="fact">
            <dt>{t("landing.ticketPrice")}</dt>
            <dd>
              <Bone w="7rem" h="1rem" />
            </dd>
          </div>
        </dl>
      </section>
      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("home.prizes")}</h2>
        <article className="pillar">
          <h3>
            <Bone w="11rem" h="0.95rem" />
          </h3>
          <p>
            <Bone w="80%" />
          </p>
        </article>
        <article className="pillar">
          <h3>
            <Bone w="9rem" h="0.95rem" />
          </h3>
          <p>
            <Bone w="70%" />
          </p>
        </article>
      </section>
    </>
  );
}

function AuthSkeleton() {
  const { t } = useTranslation();
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.loginTitle")}</h1>
      <p>{t("auth.loginLead")}</p>
      <div className="mt-6 grid gap-4">
        <label>
          {t("auth.email")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("auth.password")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <button type="button" className="btn-primary btn-block" disabled tabIndex={-1}>
          {t("auth.submitLogin")}
        </button>
      </div>
    </section>
  );
}

function RegisterSkeleton() {
  const { t } = useTranslation();
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <p className="register-steps" aria-hidden>
        <span className="is-on">1</span>
        <span>2</span>
      </p>
      <h1>{t("auth.step1Title")}</h1>
      <p>{t("auth.step1Lead")}</p>
      <div className="mt-6 grid gap-4">
        <label className="avatar-picker">
          <span>{t("auth.photo")}</span>
          <span className="avatar-picker-row">
            <span className="person-avatar fallback skeleton" style={{ width: 72, height: 72 }} />
          </span>
        </label>
        <label>
          {t("auth.name")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("auth.email")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("auth.phone")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("auth.password")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("auth.confirmPassword")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <button type="button" className="btn-primary btn-block" disabled tabIndex={-1}>
          {t("auth.nextStep")}
        </button>
      </div>
    </section>
  );
}

function BuySkeleton() {
  const { t } = useTranslation();
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("buy.title")}</h1>
      <p>{t("buy.intro")}</p>
      <p className="buy-as">
        <Bone w="16rem" />
      </p>
      <div className="mt-6 grid gap-4">
        <label>
          {t("buy.phone")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("buy.quantity")}
          <input disabled className="skeleton" aria-hidden tabIndex={-1} />
        </label>
        <fieldset className="pay-options">
          <legend>{t("buy.paymentMethod")}</legend>
          <label className="pay-option">
            <input type="radio" disabled tabIndex={-1} />
            <span>
              <strong className="pay-option-head">
                <WaveLogo />
                {t("pay.wave")}
              </strong>
              <em>{t("pay.waveHint")}</em>
            </span>
          </label>
          <label className="pay-option">
            <input type="radio" disabled tabIndex={-1} />
            <span>
              <strong>{t("pay.cash")}</strong>
              <em>{t("pay.cashHint")}</em>
            </span>
          </label>
        </fieldset>
        <p>
          {t("buy.total")}: <Bone w="5rem" className="skeleton-inline" />
        </p>
        <button type="button" className="btn-primary btn-block" disabled tabIndex={-1}>
          {t("buy.submit")}
        </button>
      </div>
    </section>
  );
}

function TicketCardFace() {
  const { t } = useTranslation();
  return (
    <article className="scratch-card">
      <header className="scratch-card-head">
        <span className="brand-dot" aria-hidden />
        <Bone w="9rem" h="0.75rem" />
      </header>
      <p className="scratch-card-kicker">{t("scratch.ticket")}</p>
      <p className="scratch-card-number">
        <Bone w="5.5rem" h="1.7rem" />
      </p>
      <p className="scratch-card-name">
        <Bone w="8rem" />
      </p>
      <div className="scratch-panel">
        <div className="scratch-result">
          <Bone w="7rem" h="1rem" />
        </div>
      </div>
      <footer className="scratch-card-foot">{t("scratch.instruction")}</footer>
    </article>
  );
}

function TicketsSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <section className="section">
        <p className="eyebrow">{t("home.kicker")}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{t("confirm.title")}</h1>
            <p>
              <Bone w="8rem" />
            </p>
          </div>
          <span className="badge wait">{t("confirm.statusReserved")}</span>
        </div>
        <p className="lede">{t("scratch.howto")}</p>
        <p className="lede">{t("confirm.saveLink")}</p>
      </section>
      <section className="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>{t("confirm.yourTickets")}</h2>
          <div className="view-toggle" role="group">
            <button type="button" className="active" disabled tabIndex={-1}>
              {t("deck.viewCards")}
            </button>
            <button type="button" disabled tabIndex={-1}>
              {t("deck.viewList")}
            </button>
          </div>
        </div>
        <div className="ticket-deck-wrap">
          <p className="ticket-deck-meta">
            <Bone w="4.5rem" h="0.8rem" />
            <span>{t("deck.hintScratch")}</span>
          </p>
          <div className="ticket-deck">
            <div className="ticket-deck-card is-front" style={{ zIndex: 5 }}>
              <TicketCardFace />
            </div>
            <div className="ticket-deck-card" style={{ zIndex: 4, transform: "translateY(10px) scale(0.955)" }}>
              <TicketCardFace />
            </div>
            <div className="ticket-deck-card" style={{ zIndex: 3, transform: "translateY(20px) scale(0.91)" }}>
              <TicketCardFace />
            </div>
          </div>
          <div className="ticket-deck-actions">
            <button type="button" className="btn-outline" disabled tabIndex={-1}>
              {t("deck.prev")}
            </button>
            <button type="button" className="btn-outline" disabled tabIndex={-1}>
              {t("deck.next")}
            </button>
          </div>
        </div>
      </section>
      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{t("confirm.pay")}</h2>
        <p>
          {t("buy.total")}: <Bone w="5rem" className="skeleton-inline" />
        </p>
      </section>
    </>
  );
}

function AccountSkeleton() {
  const { t } = useTranslation();
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("account.title")}</h1>
      <div className="account-hello">
        <span className="person-avatar fallback skeleton" style={{ width: 56, height: 56 }} />
        <p>{t("account.lede")}</p>
      </div>
      <AccountListSkeleton />
    </section>
  );
}

function AccountListSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="account-list">
      <article className="account-card">
        <div className="account-card-head">
          <h2>
            <Bone w="12rem" h="1.05rem" />
          </h2>
          <span className="badge wait">
            <Bone w="5.5rem" h="0.7rem" />
          </span>
        </div>
        <p>
          <Bone w="6rem" />
        </p>
        <div className="account-order">
          <p>
            <Bone w="14rem" />
          </p>
          <button type="button" className="btn-outline" disabled tabIndex={-1}>
            {t("account.openTickets")}
          </button>
        </div>
      </article>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <p className="lede">
      <Bone w="18rem" />
    </p>
  );
}

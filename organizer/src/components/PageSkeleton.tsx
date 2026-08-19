import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

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

type Kind = "page" | "stats" | "form" | "tombola" | "list" | "draw" | "feed";

export function PageSkeleton({ kind = "page" }: { kind?: Kind }) {
  return (
    <div role="status" aria-busy="true">
      {kind === "page" || kind === "stats" ? <StatsSkeleton /> : null}
      {kind === "form" || kind === "tombola" ? <TombolaSkeleton /> : null}
      {kind === "list" ? <BuyersSkeleton /> : null}
      {kind === "draw" ? <DrawSkeleton /> : null}
      {kind === "feed" ? <FeedSkeleton /> : null}
    </div>
  );
}

function StatsSkeleton() {
  const { t } = useTranslation();
  return (
    <section>
      <p className="eyebrow">
        <Bone w="9rem" h="0.7rem" />
      </p>
      <h1>
        <Bone w="16rem" h="1.8rem" />
      </h1>
      <dl className="stat-list mt-4">
        <div className="fact">
          <dt>{t("admin.paid")}</dt>
          <dd>
            <Bone w="2rem" h="1.2rem" />
          </dd>
        </div>
        <div className="fact">
          <dt>{t("admin.reserved")}</dt>
          <dd>
            <Bone w="2rem" h="1.2rem" />
          </dd>
        </div>
        <div className="fact">
          <dt>{t("admin.remaining")}</dt>
          <dd>
            <Bone w="2rem" h="1.2rem" />
          </dd>
        </div>
      </dl>
      <div className="no-print mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-block" disabled tabIndex={-1}>
          {t("admin.openSales")}
        </button>
      </div>
    </section>
  );
}

function TombolaSkeleton() {
  const { t } = useTranslation();
  return (
    <form className="grid gap-5">
      <h1>{t("admin.tombola")}</h1>
      <div className="grid gap-4">
        <label>
          {t("admin.title")}
          <input disabled className="skeleton mt-1" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("admin.description")}
          <textarea disabled rows={3} className="skeleton mt-1" aria-hidden tabIndex={-1} />
        </label>
        <label>
          {t("admin.pay")}
          <textarea disabled rows={3} className="skeleton mt-1" aria-hidden tabIndex={-1} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            {t("admin.price")}
            <input disabled className="skeleton mt-1" aria-hidden tabIndex={-1} />
          </label>
          <label>
            {t("admin.totalTickets")}
            <input disabled className="skeleton mt-1" aria-hidden tabIndex={-1} />
          </label>
        </div>
        <fieldset className="pay-options">
          <legend>{t("admin.drawMode")}</legend>
          <label className="pay-option">
            <input type="radio" disabled tabIndex={-1} />
            <span>
              <strong>{t("admin.drawModeScratch")}</strong>
              <em>{t("admin.drawModeScratchHelp")}</em>
            </span>
          </label>
          <label className="pay-option">
            <input type="radio" disabled tabIndex={-1} />
            <span>
              <strong>{t("admin.drawModeRoulette")}</strong>
              <em>{t("admin.drawModeRouletteHelp")}</em>
            </span>
          </label>
        </fieldset>
      </div>
      <div>
        <h2>{t("admin.prizes")}</h2>
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 border-b border-line py-3 md:grid-cols-[auto_1fr_auto]">
            <span className="text-2xl font-semibold text-primary">1</span>
            <input disabled className="skeleton" placeholder={t("admin.prizeName")} aria-hidden tabIndex={-1} />
          </div>
        </div>
        <button type="button" className="btn-ghost mt-3" disabled tabIndex={-1}>
          {t("admin.addPrize")}
        </button>
      </div>
      <button type="button" className="btn-primary" disabled tabIndex={-1}>
        {t("admin.save")}
      </button>
    </form>
  );
}

function BuyersSkeleton() {
  const { t } = useTranslation();
  const { lang } = useParams();
  return (
    <section className="buyers-page">
      <div className="buyers-head">
        <div>
          <h1>{t("admin.buyers")}</h1>
        </div>
        <Link to={`/${lang}/qr`} className="btn-outline">
          {t("admin.qr")}
        </Link>
      </div>
      <p className="lede mt-3">{t("admin.waveHelp")}</p>
      <div className="buyers-cards">
        {[1, 2].map((id) => (
          <article key={id} className="buyer-card">
            <div className="buyer-card-top">
              <strong>
                <Bone w="9rem" h="1rem" />
              </strong>
              <span className="badge wait">{t("admin.reserved")}</span>
            </div>
            <p className="buyer-meta">
              <Bone w="12rem" />
            </p>
            <dl className="buyer-facts">
              <div>
                <dt>{t("confirm.yourTickets")}</dt>
                <dd>
                  <Bone w="4rem" />
                </dd>
              </div>
              <div>
                <dt>{t("admin.amount")}</dt>
                <dd>
                  <Bone w="5rem" />
                </dd>
              </div>
              <div>
                <dt>{t("admin.payment")}</dt>
                <dd>
                  <Bone w="4.5rem" />
                </dd>
              </div>
            </dl>
            <div className="buyer-actions">
              <button type="button" className="btn-primary" disabled tabIndex={-1}>
                {t("admin.markPaid")}
              </button>
              <button type="button" className="btn-outline" disabled tabIndex={-1}>
                {t("admin.cancel")}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="buyers-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("buy.name")}</th>
              <th>{t("buy.email")}</th>
              <th>{t("buy.phone")}</th>
              <th>{t("confirm.yourTickets")}</th>
              <th>{t("admin.amount")}</th>
              <th>{t("admin.payment")}</th>
              <th>{t("admin.reserved")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[1, 2].map((id) => (
              <tr key={id}>
                <td>
                  <Bone w="8rem" />
                </td>
                <td className="cell-clip">
                  <Bone w="10rem" />
                </td>
                <td>
                  <Bone w="6rem" />
                </td>
                <td>
                  <Bone w="5rem" />
                </td>
                <td>
                  <Bone w="4rem" />
                </td>
                <td>
                  <Bone w="4.5rem" />
                </td>
                <td>
                  <span className="badge wait">{t("admin.reserved")}</span>
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DrawSkeleton() {
  const { t } = useTranslation();
  return (
    <section className="grid gap-5">
      <h1>{t("admin.draw")}</h1>
      <p className="lede">{t("admin.drawShowHelpScratch")}</p>
      <div className="draw-stage">
        <p className="draw-prize">
          <Bone w="10rem" h="0.9rem" />
        </p>
        <div className="draw-window">
          <div className="draw-window-marker" />
          <div className="draw-reel">
            <div className="draw-reel-item" style={{ height: 84 }}>
              <span className="person-avatar fallback skeleton" style={{ width: 52, height: 52 }} />
              <div>
                <strong>
                  <Bone w="8rem" h="0.95rem" />
                </strong>
                <p>
                  <Bone w="3.5rem" />
                </p>
              </div>
            </div>
            <div className="draw-reel-item" style={{ height: 84 }}>
              <span className="person-avatar fallback skeleton" style={{ width: 52, height: 52 }} />
              <div>
                <strong>
                  <Bone w="7rem" h="0.95rem" />
                </strong>
                <p>
                  <Bone w="3.5rem" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button type="button" className="btn-primary no-print btn-block" disabled tabIndex={-1}>
        {t("admin.startAssign")}
      </button>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <ol className="scratch-feed-list">
      {[1, 2].map((id) => (
        <li key={id} className="scratch-feed-row">
          <span className="scratch-feed-number">
            <Bone w="3.4rem" h="0.95rem" />
          </span>
          <span>
            <strong>
              <Bone w="8rem" h="0.95rem" />
            </strong>
            <p>
              <Bone w="11rem" />
            </p>
          </span>
        </li>
      ))}
    </ol>
  );
}

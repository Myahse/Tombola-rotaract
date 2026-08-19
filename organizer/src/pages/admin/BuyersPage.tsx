import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminEvent, AdminOrder } from "../../types";
import { WaveLogo } from "../../components/WaveLogo";

export function BuyersPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tick = useLiveTick();

  async function load() {
    const [orderData, eventData] = await Promise.all([api.orders(), api.adminEvent()]);
    setOrders(orderData.orders);
    setEvent(eventData.event);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [tick]);

  const locked = event?.status === "drawn";
  const unpaid = orders.filter((order) => order.status === "reserved").length;
  const sorted = [...orders].sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === "reserved") return -1;
    if (b.status === "reserved") return 1;
    return 0;
  });

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await api.markPaid(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function cancelOrder(id: string) {
    setBusyId(id);
    try {
      await api.cancelOrder(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function amount(order: AdminOrder) {
    return event
      ? formatMoney(event.ticketPriceCents * order.quantity, event.currency, i18n.language)
      : String(order.quantity);
  }

  function payment(order: AdminOrder) {
    return order.paymentMethod === "wave" ? (
      <span className="pay-label">
        <WaveLogo />
        {t("admin.payWave")}
      </span>
    ) : (
      t("admin.payCash")
    );
  }

  function statusBadge(status: string) {
    if (status === "paid") return <span className="badge ok">{t("admin.paid")}</span>;
    if (status === "cancelled") return <span className="badge wait">{t("admin.cancel")}</span>;
    return <span className="badge wait">{t("admin.reserved")}</span>;
  }

  function actions(order: AdminOrder) {
    if (order.status !== "reserved" || locked) return null;
    const busy = busyId === order.id;
    return (
      <div className="buyer-actions">
        <button className="btn-primary" disabled={busy} onClick={() => void markPaid(order.id)}>
          {t("admin.markPaid")}
        </button>
        <button className="btn-outline" disabled={busy} onClick={() => void cancelOrder(order.id)}>
          {t("admin.cancel")}
        </button>
      </div>
    );
  }

  return (
    <section className="buyers-page">
      <div className="buyers-head">
        <div>
          <h1>{t("admin.buyers")}</h1>
          {orders.length ? (
            <p className="buyers-count">
              {t("admin.unpaidCount", { count: unpaid })} · {orders.length}
            </p>
          ) : null}
        </div>
        <Link to={`/${lang}/qr`} className="btn-outline">
          {t("admin.qr")}
        </Link>
      </div>
      <p className="lede mt-3">{t("admin.waveHelp")}</p>

      {!sorted.length ? (
        <p className="lede mt-6">{t("admin.noBuyers")}</p>
      ) : (
        <>
          <div className="buyers-cards">
            {sorted.map((order) => (
              <article key={order.id} className={`buyer-card ${order.status === "reserved" ? "is-wait" : ""}`}>
                <div className="buyer-card-top">
                  <strong>{order.buyerName}</strong>
                  {statusBadge(order.status)}
                </div>
                <p className="buyer-meta">{order.buyerEmail}</p>
                {order.buyerPhone ? (
                  <a className="buyer-meta" href={`tel:${order.buyerPhone}`}>
                    {order.buyerPhone}
                  </a>
                ) : null}
                <dl className="buyer-facts">
                  <div>
                    <dt>{t("confirm.yourTickets")}</dt>
                    <dd>{order.numbers.join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.amount")}</dt>
                    <dd>{amount(order)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.payment")}</dt>
                    <dd>{payment(order)}</dd>
                  </div>
                </dl>
                {actions(order)}
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
                {sorted.map((order) => (
                  <tr key={order.id}>
                    <td>{order.buyerName}</td>
                    <td className="cell-clip">{order.buyerEmail}</td>
                    <td>
                      {order.buyerPhone ? <a href={`tel:${order.buyerPhone}`}>{order.buyerPhone}</a> : "—"}
                    </td>
                    <td>{order.numbers.join(", ")}</td>
                    <td>{amount(order)}</td>
                    <td>{payment(order)}</td>
                    <td>{statusBadge(order.status)}</td>
                    <td>{actions(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

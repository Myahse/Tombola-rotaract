import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatMoney } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminEvent, AdminOrder } from "../../types";
import { WaveLogo } from "../../components/WaveLogo";
import { PageSkeleton } from "../../components/PageSkeleton";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ExportActions } from "../../components/ExportActions";
import { PhysicalTicketsForm } from "../../components/PhysicalTicketsForm";
import { exportOrdersExcel, exportOrdersPdf } from "../../lib/exportOrders";
import { useOrganizerEvent } from "../../eventContext";

type PendingAction = { type: "paid" | "unpaid" | "cancel"; order: AdminOrder } | null;

export function BuyersPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState("");
  const tick = useLiveTick();
  const { eventId } = useOrganizerEvent();

  async function load() {
    const [orderData, eventData] = await Promise.all([api.orders(), api.adminEvent()]);
    setOrders(orderData.orders);
    setEvent(eventData.event);
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => setReady(true));
  }, [tick, eventId]);

  const locked = event?.status === "drawn";
  const unpaid = orders.filter((order) => order.status === "reserved").length;
  const sorted = [...orders].sort((a, b) => {
    if (a.status === "reserved" && b.status !== "reserved") return -1;
    if (b.status === "reserved" && a.status !== "reserved") return 1;
    if (a.status === "reserved" && b.status === "reserved") {
      if (a.paymentRef && !b.paymentRef) return -1;
      if (b.paymentRef && !a.paymentRef) return 1;
    }
    return 0;
  });

  async function runPending() {
    if (!pending) return;
    const { type, order } = pending;
    setBusyId(order.id);
    setError("");
    try {
      if (type === "paid") await api.markPaid(order.id);
      if (type === "unpaid") await api.unmarkPaid(order.id);
      if (type === "cancel") await api.cancelOrder(order.id);
      setPending(null);
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "not_enough_tickets"
          ? t("errors.notEnough")
          : code === "already_scratched"
            ? t("errors.alreadyScratched")
            : t("errors.generic"),
      );
      setPending(null);
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
    ) : order.paymentMethod === "physical" ? (
      t("admin.payPhysical")
    ) : (
      t("admin.payCash")
    );
  }

  function statusBadge(status: string) {
    if (status === "paid") return <span className="badge ok">{t("admin.paid")}</span>;
    if (status === "cancelled") return <span className="badge wait">{t("admin.cancel")}</span>;
    return <span className="badge wait">{t("admin.reserved")}</span>;
  }

  function numbers(order: AdminOrder) {
    if (order.numbers.length) return order.numbers.join(", ");
    if (order.status === "reserved") return t("admin.ticketsAfterPaid", { count: order.quantity });
    return "—";
  }

  function actions(order: AdminOrder) {
    if (locked) return null;
    const busy = busyId === order.id;
    if (order.status === "reserved") {
      return (
        <div className="buyer-actions">
          <button className="btn-primary" disabled={busy} onClick={() => setPending({ type: "paid", order })}>
            {t("admin.markPaid")}
          </button>
          <button className="btn-outline" disabled={busy} onClick={() => setPending({ type: "cancel", order })}>
            {t("admin.cancel")}
          </button>
        </div>
      );
    }
    if (order.status === "paid") {
      return (
        <div className="buyer-actions">
          <button className="btn-outline" disabled={busy} onClick={() => setPending({ type: "unpaid", order })}>
            {t("admin.unmarkPaid")}
          </button>
        </div>
      );
    }
    return null;
  }

  if (!ready) return <PageSkeleton kind="list" />;

  const exportCtx = {
    orders: sorted,
    event,
    lang: i18n.language,
    formatAmount: amount,
    t,
  };

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
        <div className="buyers-head-actions">
          {sorted.length ? (
            <ExportActions
              onExportExcel={() => void exportOrdersExcel(exportCtx)}
              onExportPdf={() => void exportOrdersPdf(exportCtx)}
            />
          ) : null}
          <Link to={`/${lang}/qr`} className="btn-outline">
            {t("admin.qr")}
          </Link>
        </div>
      </div>
      <p className="lede mt-3">{t("admin.waveHelp")}</p>
      {error ? <p className="text-sm text-ticket mt-3">{error}</p> : null}

      {!locked && event ? <PhysicalTicketsForm className="mt-5" onSaved={load} /> : null}

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
                <p className="buyer-meta">{order.buyerEmail || t("admin.noAccount")}</p>
                {order.buyerPhone ? (
                  <a className="buyer-meta" href={`tel:${order.buyerPhone}`}>
                    {order.buyerPhone}
                  </a>
                ) : null}
                <dl className="buyer-facts">
                  <div>
                    <dt>{t("confirm.yourTickets")}</dt>
                    <dd>{numbers(order)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.amount")}</dt>
                    <dd>{amount(order)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.payment")}</dt>
                    <dd>{payment(order)}</dd>
                  </div>
                  {order.paymentMethod === "wave" ? (
                    <div>
                      <dt>{t("admin.waveId")}</dt>
                      <dd className="wave-ref">{order.paymentRef || t("admin.waveIdWaiting")}</dd>
                    </div>
                  ) : null}
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
                  <th>{t("admin.waveId")}</th>
                  <th>{t("admin.reserved")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr key={order.id}>
                    <td>{order.buyerName}</td>
                    <td className="cell-clip">{order.buyerEmail || t("admin.noAccount")}</td>
                    <td>
                      {order.buyerPhone ? <a href={`tel:${order.buyerPhone}`}>{order.buyerPhone}</a> : "—"}
                    </td>
                    <td>{numbers(order)}</td>
                    <td>{amount(order)}</td>
                    <td>{payment(order)}</td>
                    <td className="wave-ref">
                      {order.paymentMethod === "wave" ? order.paymentRef || t("admin.waveIdWaiting") : "—"}
                    </td>
                    <td>{statusBadge(order.status)}</td>
                    <td>{actions(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pending ? (
        <ConfirmModal
          title={
            pending.type === "paid"
              ? t("admin.markPaidTitle")
              : pending.type === "unpaid"
                ? t("admin.unmarkPaidTitle")
                : t("admin.cancelTitle")
          }
          body={
            pending.type === "paid"
              ? pending.order.paymentRef
                ? t("admin.markPaidBodyRef", {
                    name: pending.order.buyerName,
                    amount: amount(pending.order),
                    ref: pending.order.paymentRef,
                  })
                : t("admin.markPaidBody", { name: pending.order.buyerName, amount: amount(pending.order) })
              : pending.type === "unpaid"
                ? t("admin.unmarkPaidBody", { name: pending.order.buyerName })
                : t("admin.cancelBody", { name: pending.order.buyerName })
          }
          confirmLabel={
            pending.type === "paid"
              ? t("admin.markPaid")
              : pending.type === "unpaid"
                ? t("admin.unmarkPaid")
                : t("admin.cancel")
          }
          cancelLabel={t("admin.back")}
          busy={busyId === pending.order.id}
          danger={pending.type !== "paid"}
          onConfirm={() => void runPending()}
          onCancel={() => {
            if (!busyId) setPending(null);
          }}
        />
      ) : null}
    </section>
  );
}

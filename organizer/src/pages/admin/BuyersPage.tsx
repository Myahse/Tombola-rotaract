import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminEvent, AdminOrder } from "../../types";

export function BuyersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [event, setEvent] = useState<AdminEvent | null>(null);
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

  return (
    <section>
      <h1>{t("admin.buyers")}</h1>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("buy.name")}</th>
              <th>{t("buy.email")}</th>
              <th>{t("confirm.yourTickets")}</th>
              <th>{t("admin.reserved")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.buyerName}</td>
                <td>{order.buyerEmail}</td>
                <td>{order.numbers.join(", ")}</td>
                <td>{order.status}</td>
                <td className="space-x-3 text-right">
                  {order.status === "reserved" && !locked ? (
                    <>
                      <button className="link-ok" onClick={() => api.markPaid(order.id).then(load)}>
                        {t("admin.markPaid")}
                      </button>
                      <button className="link-err" onClick={() => api.cancelOrder(order.id).then(load)}>
                        {t("admin.cancel")}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

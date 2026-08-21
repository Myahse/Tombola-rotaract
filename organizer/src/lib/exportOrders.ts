import type { TFunction } from "i18next";
import type { AdminEvent, AdminOrder } from "../types";
import { exportFilename, exportTableExcel, exportTablePdf, formatExportDate } from "./exportTable";

type OrderExportContext = {
  orders: AdminOrder[];
  event: AdminEvent | null;
  lang: string;
  formatAmount: (order: AdminOrder) => string;
  t: TFunction;
};

function paymentLabel(order: AdminOrder, t: TFunction) {
  if (order.paymentMethod === "wave") return t("admin.payWave");
  if (order.paymentMethod === "physical") return t("admin.payPhysical");
  if (order.paymentMethod === "cash") return t("admin.payCash");
  return "—";
}

function statusLabel(status: AdminOrder["status"], t: TFunction) {
  if (status === "paid") return t("admin.paid");
  if (status === "cancelled") return t("admin.cancel");
  return t("admin.reserved");
}

function ticketLabel(order: AdminOrder, t: TFunction) {
  if (order.numbers.length) return order.numbers.join(", ");
  if (order.status === "reserved") return t("admin.ticketsAfterPaid", { count: order.quantity });
  return "—";
}

function orderHeaders(t: TFunction) {
  return [
    t("buy.name"),
    t("buy.email"),
    t("buy.phone"),
    t("confirm.yourTickets"),
    t("admin.amount"),
    t("admin.payment"),
    t("admin.waveId"),
    t("admin.reserved"),
    t("admin.exportCreatedAt"),
    t("admin.exportPaidAt"),
  ];
}

function orderRows({ orders, lang, formatAmount, t }: OrderExportContext) {
  return orders.map((order) => [
    order.buyerName,
    order.buyerEmail || t("admin.noAccount"),
    order.buyerPhone ?? "—",
    ticketLabel(order, t),
    formatAmount(order),
    paymentLabel(order, t),
    order.paymentMethod === "wave" ? order.paymentRef || t("admin.waveIdWaiting") : "—",
    statusLabel(order.status, t),
    formatExportDate(order.createdAt, lang),
    formatExportDate(order.paidAt, lang),
  ]);
}

export async function exportOrdersExcel(ctx: OrderExportContext) {
  const title =
    ctx.lang === "en"
      ? (ctx.event?.titleEn ?? ctx.t("admin.buyers"))
      : (ctx.event?.titleFr ?? ctx.t("admin.buyers"));
  await exportTableExcel(orderHeaders(ctx.t), orderRows(ctx), exportFilename("acheteurs", title, "xlsx"));
}

export async function exportOrdersPdf(ctx: OrderExportContext) {
  const title =
    ctx.lang === "en"
      ? (ctx.event?.titleEn ?? ctx.t("admin.buyers"))
      : (ctx.event?.titleFr ?? ctx.t("admin.buyers"));
  const subtitle = `${ctx.t("admin.exportGenerated")} · ${formatExportDate(new Date().toISOString(), ctx.lang)} · ${ctx.orders.length}`;
  await exportTablePdf(
    ctx.t("admin.exportBuyersTitle", { title }),
    subtitle,
    orderHeaders(ctx.t),
    orderRows(ctx),
    exportFilename("acheteurs", title, "pdf"),
  );
}

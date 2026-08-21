import type { TFunction } from "i18next";
import { formatMoney } from "../api";
import type { DrawMode, MemberOrder } from "../types";

export type ReceiptData = {
  buyerName: string;
  eventTitle: string;
  eventTitleEn: string;
  numbers: number[];
  quantity: number;
  totalFormatted: string;
  unitFormatted: string;
  qtyLine: string;
  paymentLabel: string;
  paymentRef: string | null;
  paidOnFormatted: string;
  drawHint: string;
  englishSummary: string;
  filenameBase: string;
};

export type ReceiptLabels = {
  kicker: string;
  heading: string;
  intro: string;
  tombola: string;
  confirmedOn: string;
  payment: string;
  waveId: string;
  buyer: string;
  numbers: string;
  totalPaid: string;
  english: string;
};

type PaidOrderSlice = {
  quantity: number;
  paymentMethod?: string;
  paymentRef?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  tickets: { number: number }[];
};

function formatReceiptDate(iso: string | null | undefined, lang: string) {
  const date = iso ? new Date(iso) : new Date();
  const locale = lang.startsWith("en") ? "en-US" : "fr-FR";
  return date.toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
}

function paymentLabelFr(method: string) {
  if (method === "wave") return "Wave";
  if (method === "cash") return "Espèces";
  if (method === "physical") return "Ticket physique";
  return method;
}

function paymentLabelEn(method: string) {
  if (method === "wave") return "Wave";
  if (method === "cash") return "Cash";
  if (method === "physical") return "Physical ticket";
  return method;
}

function drawHintFr(drawMode?: DrawMode) {
  if (drawMode === "roulette") {
    return "Le jour J, suivez la roulette en direct : les gagnants sont désignés ticket par ticket.";
  }
  return "Grattez vos tickets en ligne pour voir si l’un d’eux cache un lot.";
}

function drawHintEn(drawMode?: DrawMode) {
  if (drawMode === "roulette") {
    return "On draw day, follow the wheel live — winners are named ticket by ticket.";
  }
  return "Scratch your tickets online to see if one holds a prize.";
}

function slugFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function combinePaymentLabels(orders: PaidOrderSlice[], lang: string) {
  const methods = [...new Set(orders.map((order) => order.paymentMethod ?? "cash"))];
  const label = lang.startsWith("en") ? paymentLabelEn : paymentLabelFr;
  return methods.map(label).join(" · ");
}

function combineWaveRefs(orders: PaidOrderSlice[]) {
  const refs = [...new Set(orders.map((order) => order.paymentRef?.trim()).filter(Boolean) as string[])];
  return refs.length ? refs.join(", ") : null;
}

function latestPaidAt(orders: PaidOrderSlice[]) {
  const stamps = orders
    .map((order) => order.paidAt ?? order.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value!).getTime());
  if (!stamps.length) return null;
  return new Date(Math.max(...stamps)).toISOString();
}

function englishReceiptSummary(input: {
  name: string;
  eventTitleEn: string;
  quantity: number;
  totalFormatted: string;
  paymentLabel: string;
  paymentRef: string | null;
  numbers: number[];
  drawMode?: DrawMode;
}) {
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  const qty = input.quantity === 1 ? "1 ticket" : `${input.quantity} tickets`;
  let summary = `${first}, payment confirmed for ${input.eventTitleEn}. ${qty} · ${input.totalFormatted} · ${input.paymentLabel}`;
  if (input.paymentRef) summary += ` · Wave ID ${input.paymentRef}`;
  summary += `. Numbers: ${input.numbers.join(", ")}. ${drawHintEn(input.drawMode)}`;
  return summary;
}

export function buildReceiptData(input: {
  buyerName: string;
  eventTitleFr: string;
  eventTitleEn: string;
  ticketPriceCents: number;
  currency: string;
  drawMode?: DrawMode;
  lang: string;
  orders: PaidOrderSlice[];
}): ReceiptData | null {
  const paidOrders = input.orders.filter((order) => order.quantity > 0);
  if (!paidOrders.length) return null;

  const numbers = [
    ...new Set(paidOrders.flatMap((order) => order.tickets.map((ticket) => ticket.number))),
  ].sort((a, b) => a - b);
  const quantity = paidOrders.reduce((sum, order) => sum + order.quantity, 0);
  const totalFormatted = formatMoney(input.ticketPriceCents * quantity, input.currency, input.lang);
  const unitFormatted = formatMoney(input.ticketPriceCents, input.currency, input.lang);
  const qtyLine =
    quantity === 1
      ? `1 ticket · ${unitFormatted}`
      : input.lang.startsWith("en")
        ? `${quantity} tickets · ${unitFormatted} each`
        : `${quantity} tickets · ${unitFormatted} l’unité`;
  const paymentLabel = combinePaymentLabels(paidOrders, input.lang);
  const paymentRef = combineWaveRefs(paidOrders);
  const paidOnFormatted = formatReceiptDate(latestPaidAt(paidOrders), input.lang);
  const eventTitle = input.lang.startsWith("en") ? input.eventTitleEn : input.eventTitleFr;
  const firstName =
    input.buyerName.trim().split(/\s+/)[0]?.replace(/^./, (c) => c.toUpperCase()) || input.buyerName;

  return {
    buyerName: input.buyerName,
    eventTitle,
    eventTitleEn: input.eventTitleEn,
    numbers,
    quantity,
    totalFormatted,
    unitFormatted,
    qtyLine,
    paymentLabel,
    paymentRef,
    paidOnFormatted,
    drawHint: input.lang.startsWith("en") ? drawHintEn(input.drawMode) : drawHintFr(input.drawMode),
    englishSummary: englishReceiptSummary({
      name: input.buyerName,
      eventTitleEn: input.eventTitleEn,
      quantity,
      totalFormatted,
      paymentLabel: combinePaymentLabels(paidOrders, "en"),
      paymentRef,
      numbers,
      drawMode: input.drawMode,
    }),
    filenameBase: slugFilename(`${input.eventTitleFr}-${firstName}`) || "receipt",
  };
}

export function buildTombolaReceipt(
  tombola: {
    titleFr: string;
    titleEn: string;
    ticketPriceCents: number;
    currency: string;
    drawMode?: DrawMode;
    orders: MemberOrder[];
  },
  buyerName: string,
  lang: string,
) {
  return buildReceiptData({
    buyerName,
    eventTitleFr: tombola.titleFr,
    eventTitleEn: tombola.titleEn,
    ticketPriceCents: tombola.ticketPriceCents,
    currency: tombola.currency,
    drawMode: tombola.drawMode,
    lang,
    orders: tombola.orders
      .filter((order) => order.status === "paid")
      .map((order) => ({
        quantity: order.quantity,
        paymentMethod: order.paymentMethod,
        paymentRef: order.paymentRef,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        tickets: order.tickets,
      })),
  });
}

export function receiptLabels(t: TFunction): ReceiptLabels {
  return {
    kicker: t("receipt.kicker"),
    heading: t("receipt.heading"),
    intro: t("receipt.intro"),
    tombola: t("receipt.tombola"),
    confirmedOn: t("receipt.confirmedOn"),
    payment: t("receipt.payment"),
    waveId: t("receipt.waveId"),
    buyer: t("receipt.buyer"),
    numbers: t("receipt.numbers"),
    totalPaid: t("receipt.totalPaid"),
    english: t("receipt.english"),
  };
}

export function receiptFilename(base: string, ext: "png" | "pdf") {
  const stamp = new Date().toISOString().slice(0, 10);
  return `tombola-recu-${base}-${stamp}.${ext}`;
}

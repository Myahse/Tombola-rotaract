import { emailEnglishBlock, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";
import { formatMoney, ticketWord } from "../lib/money.js";

export type PurchaseEmail = {
  name: string;
  email: string;
  eventTitleFr: string;
  eventTitleEn: string;
  quantity: number;
  ticketPriceCents: number;
  currency: string;
  numbers: number[];
  paymentMethod: "cash" | "wave" | string;
  paymentRef?: string | null;
  paidAt?: string | null;
  drawMode?: "scratch" | "roulette";
  ticketsUrl: string;
};

function formatReceiptDate(iso: string | null | undefined) {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

function paymentMethodLabel(method: string) {
  if (method === "wave") return "Wave";
  if (method === "cash") return "Espèces";
  if (method === "physical") return "Ticket physique";
  return method;
}

function paymentMethodLabelEn(method: string) {
  if (method === "wave") return "Wave";
  if (method === "cash") return "Cash";
  if (method === "physical") return "Physical ticket";
  return method;
}

function receiptRow(label: string, value: string, highlight = false) {
  const bg = highlight ? "#faf0f4" : "transparent";
  const labelColor = highlight ? "#be034d" : "#a1a1a8";
  return `<tr>
    <td style="padding:11px 16px;border-bottom:1px solid #ececee;background:${bg};">
      <p style="margin:0 0 3px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:${labelColor};">${escapeHtml(label)}</p>
      <p style="margin:0;font-size:15px;line-height:1.45;font-weight:650;color:#141416;">${value}</p>
    </td>
  </tr>`;
}

function drawHintFr(drawMode?: "scratch" | "roulette") {
  if (drawMode === "roulette") {
    return "Le jour J, suivez la roulette en direct : les gagnants sont désignés ticket par ticket.";
  }
  return "Grattez vos tickets en ligne pour voir si l’un d’eux cache un lot.";
}

function drawHintEn(drawMode?: "scratch" | "roulette") {
  if (drawMode === "roulette") {
    return "On draw day, follow the wheel live — winners are named ticket by ticket.";
  }
  return "Scratch your tickets online to see if one holds a prize.";
}

function englishReceiptSummary(
  data: PurchaseEmail,
  name: string,
  total: string,
  numbers: string,
) {
  const qty = data.quantity === 1 ? "1 ticket" : `${data.quantity} tickets`;
  const paymentEn = paymentMethodLabelEn(data.paymentMethod);
  let summary = `${name}, payment confirmed for ${data.eventTitleEn}. ${qty} · ${total} · ${paymentEn}`;
  if (data.paymentMethod === "wave" && data.paymentRef) {
    summary += ` · Wave ID ${data.paymentRef}`;
  }
  summary += `. Numbers: ${numbers}. ${drawHintEn(data.drawMode)}`;
  return summary;
}

export function purchaseEmail(data: PurchaseEmail) {
  const name = firstName(data.name);
  const total = formatMoney(data.ticketPriceCents * data.quantity, data.currency);
  const unit = formatMoney(data.ticketPriceCents, data.currency);
  const tickets = ticketWord(data.quantity);
  const numbers = data.numbers.join(", ");
  const accountUrl = siteUrl("/fr/account");
  const paidOn = formatReceiptDate(data.paidAt);
  const payment = paymentMethodLabel(data.paymentMethod);
  const qtyLine =
    data.quantity === 1 ? `1 ticket · ${unit}` : `${data.quantity} tickets · ${unit} l’unité`;
  const englishSummary = englishReceiptSummary(data, name, total, numbers);

  const receiptRows = [
    receiptRow("Tombola", escapeHtml(data.eventTitleFr)),
    receiptRow("Confirmé le", escapeHtml(paidOn)),
    receiptRow("Paiement", escapeHtml(payment)),
    ...(data.paymentMethod === "wave" && data.paymentRef
      ? [receiptRow("Identifiant Wave", escapeHtml(data.paymentRef))]
      : []),
    receiptRow("Acheteur", escapeHtml(data.name)),
    receiptRow("Vos numéros", `n° ${escapeHtml(numbers)}`, true),
    receiptRow("Total payé", `${escapeHtml(qtyLine)} · ${escapeHtml(total)}`, true),
  ].join("");

  const html = wrapEmail({
    preheader: `${name}, reçu confirmé · ${data.quantity} ${tickets} · ${total} · n° ${numbers}`,
    heading: `${name}, votre paiement est confirmé`,
    ctaLabel: "Voir mes tickets",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 16px;color:#141416;">Voici votre reçu. Vos tickets sont enregistrés à votre nom et participent au tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong>. Un reçu PDF est joint à cet e-mail.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;overflow:hidden;">
        ${receiptRows}
      </table>
      <p style="margin:0 0 14px;color:#141416;">${drawHintFr(data.drawMode)}</p>
      <p style="margin:0;font-size:13px;color:#73737a;">
        <a href="${escapeHtml(accountUrl)}" style="color:#141416;font-weight:650;text-decoration:none;">Mes tombolas</a>
        · Retrouvez tous vos tickets depuis votre compte.
      </p>
      ${emailEnglishBlock(englishSummary)}
    `,
  });

  const text = [
    `${name}, votre paiement est confirmé.`,
    "",
    "REÇU",
    `Tombola : ${data.eventTitleFr}`,
    `Confirmé le : ${paidOn}`,
    `Paiement : ${payment}`,
    ...(data.paymentMethod === "wave" && data.paymentRef ? [`Identifiant Wave : ${data.paymentRef}`] : []),
    `Acheteur : ${data.name}`,
    `Numéros : ${numbers}`,
    `Total : ${total} (${qtyLine})`,
    "",
    drawHintFr(data.drawMode),
    "",
    "Un reçu PDF est joint à cet e-mail.",
    "",
    `Voir mes tickets : ${data.ticketsUrl}`,
    `Mes tombolas : ${accountUrl}`,
    "",
    `ENGLISH : ${englishSummary}`,
  ].join("\n");

  return {
    subject: `${name}, reçu · ${data.eventTitleFr}`,
    html,
    text,
    params: {
      name,
      eventTitleFr: data.eventTitleFr,
      eventTitleEn: data.eventTitleEn,
      quantity: String(data.quantity),
      total,
      unit,
      numbers,
      payment,
      paymentRef: data.paymentRef ?? "",
      paidOn,
      ticketsUrl: data.ticketsUrl,
      accountUrl,
      logoUrl: siteUrl("/logo.png"),
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

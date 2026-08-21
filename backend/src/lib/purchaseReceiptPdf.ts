import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PurchaseEmail } from "../emails/purchase.js";
import { logoUrl, siteUrl } from "../emails/layout.js";
import { firstName } from "../emails/layout.js";
import { formatMoney } from "./money.js";

const bundledLogoPath = join(dirname(fileURLToPath(import.meta.url)), "../../assets/logo.png");

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

function englishReceiptSummary(data: PurchaseEmail, name: string, total: string, numbers: string) {
  const qty = data.quantity === 1 ? "1 ticket" : `${data.quantity} tickets`;
  const paymentEn = paymentMethodLabelEn(data.paymentMethod);
  let summary = `${name}, payment confirmed for ${data.eventTitleEn}. ${qty} · ${total} · ${paymentEn}`;
  if (data.paymentMethod === "wave" && data.paymentRef) {
    summary += ` · Wave ID ${data.paymentRef}`;
  }
  summary += `. Numbers: ${numbers}. ${drawHintEn(data.drawMode)}`;
  return summary;
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

export function purchaseReceiptPdfFilename(data: PurchaseEmail) {
  const stamp = (data.paidAt ? new Date(data.paidAt) : new Date()).toISOString().slice(0, 10);
  const base = slugFilename(data.eventTitleFr) || "tombola";
  return `recu-${base}-${stamp}.pdf`;
}

async function loadLogo() {
  if (existsSync(bundledLogoPath)) {
    return readFileSync(bundledLogoPath);
  }
  const urls = ["https://tombola.rotaractiugb.com/logo.png", logoUrl()];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch {
      // try next source
    }
  }
  return null;
}

function writeRow(doc: InstanceType<typeof PDFDocument>, label: string, value: string, y: number, highlight = false) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowHeight = highlight ? 52 : 46;

  if (highlight) {
    doc.save();
    doc.roundedRect(left, y, width, rowHeight, 8).fill("#faf0f4");
    doc.restore();
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(highlight ? 8.5 : 8)
    .fillColor(highlight ? "#be034d" : "#73737a")
    .text(label.toUpperCase(), left + 14, y + 10, { width: width - 28 });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#141416")
    .text(value, left + 14, y + 24, { width: width - 28 });

  return y + rowHeight + 4;
}

export async function buildPurchaseReceiptPdf(data: PurchaseEmail): Promise<Buffer> {
  const name = firstName(data.name);
  const total = formatMoney(data.ticketPriceCents * data.quantity, data.currency);
  const unit = formatMoney(data.ticketPriceCents, data.currency);
  const numbers = data.numbers.join(", ");
  const paidOn = formatReceiptDate(data.paidAt);
  const payment = paymentMethodLabel(data.paymentMethod);
  const qtyLine =
    data.quantity === 1 ? `1 ticket · ${unit}` : `${data.quantity} tickets · ${unit} l’unité`;
  const englishSummary = englishReceiptSummary(data, name, total, numbers);
  const logo = await loadLogo();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;

    if (logo) {
      const logoWidth = 200;
      doc.image(logo, doc.page.margins.left + (contentWidth - logoWidth) / 2, y, {
        fit: [logoWidth, 72],
        align: "center",
        valign: "center",
      });
      y += 82;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#be034d")
      .text("ROTARACT IUGB CLUB · REÇU", doc.page.margins.left, y, {
        width: contentWidth,
        align: "center",
      });
    y += 22;

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#141416")
      .text(`${name}, votre paiement est confirmé`, doc.page.margins.left, y, { width: contentWidth });
    y += doc.heightOfString(`${name}, votre paiement est confirmé`, { width: contentWidth }) + 12;

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#141416")
      .text(
        `Voici votre reçu. Vos tickets sont enregistrés à votre nom et participent au tirage de ${data.eventTitleFr}.`,
        doc.page.margins.left,
        y,
        { width: contentWidth, lineGap: 3 },
      );
    y +=
      doc.heightOfString(
        `Voici votre reçu. Vos tickets sont enregistrés à votre nom et participent au tirage de ${data.eventTitleFr}.`,
        { width: contentWidth, lineGap: 3 },
      ) + 16;

    const rows: { label: string; value: string; highlight?: boolean }[] = [
      { label: "Tombola", value: data.eventTitleFr },
      { label: "Confirmé le", value: paidOn },
      { label: "Paiement", value: payment },
      ...(data.paymentMethod === "wave" && data.paymentRef
        ? [{ label: "Identifiant Wave", value: data.paymentRef }]
        : []),
      { label: "Acheteur", value: data.name },
      { label: "Vos numéros", value: `n° ${numbers}`, highlight: true },
      { label: "Total payé", value: `${qtyLine} · ${total}`, highlight: true },
    ];

    for (const row of rows) {
      y = writeRow(doc, row.label, row.value, y, row.highlight);
    }

    y += 8;
    doc.font("Helvetica").fontSize(10.5).fillColor("#141416").text(drawHintFr(data.drawMode), doc.page.margins.left, y, {
      width: contentWidth,
      lineGap: 3,
    });
    y += doc.heightOfString(drawHintFr(data.drawMode), { width: contentWidth, lineGap: 3 }) + 14;

    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor("#ececee")
      .stroke();
    y += 12;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#73737a")
      .text("ENGLISH : ", doc.page.margins.left, y, { continued: true })
      .font("Helvetica")
      .text(englishSummary, { width: contentWidth, lineGap: 2 });

    y +=
      doc.heightOfString(`ENGLISH : ${englishSummary}`, { width: contentWidth, lineGap: 2 }) + 18;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#73737a")
      .text(`Voir vos tickets : ${data.ticketsUrl}`, doc.page.margins.left, y, { width: contentWidth, link: data.ticketsUrl });
    y += 14;
    doc.text(`Mes tombolas : ${siteUrl("/fr/account")}`, doc.page.margins.left, y, {
      width: contentWidth,
      link: siteUrl("/fr/account"),
    });

    doc.end();
  });
}

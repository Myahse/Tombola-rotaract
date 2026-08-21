import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { purchaseEmail } from "../src/emails/purchase.js";
import { buildPurchaseReceiptPdf } from "../src/lib/purchaseReceiptPdf.js";

const sample = {
  name: "Aminata Koné",
  email: "aminata@example.com",
  eventTitleFr: "Tombola Gala 2026",
  eventTitleEn: "Gala Tombola 2026",
  quantity: 3,
  ticketPriceCents: 500000,
  currency: "XOF",
  numbers: [7, 42, 128],
  paymentMethod: "wave" as const,
  paymentRef: "WAVE-2026-8842",
  paidAt: new Date().toISOString(),
  drawMode: "scratch" as const,
  ticketsUrl: "https://tombola.rotaractiugb.com/fr/my-tickets/demo-event-id",
};

const message = purchaseEmail(sample);
const outHtml = resolve(process.cwd(), "preview-receipt-email.html");
writeFileSync(outHtml, message.html, "utf8");

const pdf = await buildPurchaseReceiptPdf(sample);
const outPdf = resolve(process.cwd(), "preview-receipt-email.pdf");
writeFileSync(outPdf, pdf);

console.log(`Preview written to ${outHtml}`);
console.log(`PDF written to ${outPdf}`);
console.log(`Subject: ${message.subject}`);

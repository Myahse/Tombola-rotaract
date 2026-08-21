import { welcomeEmail } from "../src/emails/welcome.js";
import { verifyEmailMessage } from "../src/emails/verify.js";
import { resetPasswordEmail } from "../src/emails/reset.js";
import { purchaseEmail } from "../src/emails/purchase.js";
import { giftTicketsEmail } from "../src/emails/gift.js";
import { drawResultsEmail } from "../src/emails/results.js";
import { siteUrl } from "../src/emails/layout.js";
import { buildPurchaseReceiptPdf } from "../src/lib/purchaseReceiptPdf.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.cwd(), "email-previews");
mkdirSync(outDir, { recursive: true });

const purchaseSample = {
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
  ticketsUrl: siteUrl("/fr/my-tickets/demo"),
};

const prizeBoard = [
  { rank: 1, prizeNameFr: "iPhone 16", prizeNameEn: "iPhone 16", ticketNumber: 42, buyerName: "Aminata Koné" },
  { rank: 2, prizeNameFr: "AirPods", prizeNameEn: "AirPods", ticketNumber: 17, buyerName: "Kofi Mensah" },
  { rank: 3, prizeNameFr: "Bon restaurant", prizeNameEn: "Restaurant voucher", ticketNumber: 128, buyerName: "Fatou Diallo" },
];

const previews = [
  {
    id: "01-welcome",
    title: "Welcome — inscription",
    ...welcomeEmail({ name: "Aminata Koné", email: "aminata@example.com" }),
  },
  {
    id: "02-verify",
    title: "Verify — confirmation e-mail",
    ...verifyEmailMessage({
      name: "Aminata Koné",
      email: "aminata@example.com",
      verifyUrl: siteUrl("/fr/verify-email?token=demo"),
    }),
  },
  {
    id: "03-reset",
    title: "Reset — mot de passe",
    ...resetPasswordEmail({
      name: "Aminata Koné",
      email: "aminata@example.com",
      resetUrl: siteUrl("/fr/reset-password?token=demo"),
    }),
  },
  {
    id: "04-purchase",
    title: "Purchase — reçu paiement (+ PDF)",
    ...purchaseEmail(purchaseSample),
  },
  {
    id: "05-gift-existing",
    title: "Gift — tickets offerts (compte existant)",
    ...giftTicketsEmail({
      name: "Kofi Mensah",
      email: "kofi@example.com",
      giverName: "Aminata Koné",
      eventTitleFr: "Tombola Gala 2026",
      eventTitleEn: "Gala Tombola 2026",
      numbers: [12, 88],
      hasAccount: true,
      ticketsUrl: siteUrl("/fr/my-tickets/demo"),
    }),
  },
  {
    id: "06-gift-register",
    title: "Gift — tickets offerts (nouveau compte)",
    ...giftTicketsEmail({
      name: "kofi@example.com",
      email: "kofi@example.com",
      giverName: "Aminata Koné",
      eventTitleFr: "Tombola Gala 2026",
      eventTitleEn: "Gala Tombola 2026",
      numbers: [12],
      hasAccount: false,
      ticketsUrl: siteUrl("/fr/register?next=%2Ffr%2Ftickets%2Fdemo"),
    }),
  },
  {
    id: "07-results-scratch",
    title: "Draw — tombola grattage (close)",
    ...drawResultsEmail({
      name: "Aminata Koné",
      email: "aminata@example.com",
      eventTitleFr: "Tombola Gala 2026",
      eventTitleEn: "Gala Tombola 2026",
      ticketsUrl: siteUrl("/fr/my-tickets/demo"),
      prizes: prizeBoard,
      wins: [],
      drawMode: "scratch",
    }),
  },
  {
    id: "08-results-won",
    title: "Draw — roulette (gagnant)",
    ...drawResultsEmail({
      name: "Aminata Koné",
      email: "aminata@example.com",
      eventTitleFr: "Tombola Gala 2026",
      eventTitleEn: "Gala Tombola 2026",
      ticketsUrl: siteUrl("/fr/my-tickets/demo"),
      prizes: prizeBoard,
      wins: [prizeBoard[0]!],
      drawMode: "roulette",
    }),
  },
  {
    id: "09-results-lost",
    title: "Draw — roulette (pas gagnant)",
    ...drawResultsEmail({
      name: "Kofi Mensah",
      email: "kofi@example.com",
      eventTitleFr: "Tombola Gala 2026",
      eventTitleEn: "Gala Tombola 2026",
      ticketsUrl: siteUrl("/fr/my-tickets/demo"),
      prizes: prizeBoard,
      wins: [],
      drawMode: "roulette",
    }),
  },
];

const cards = previews
  .map((preview) => {
    const file = `${preview.id}.html`;
    writeFileSync(resolve(outDir, file), preview.html, "utf8");
    return `<article class="card">
      <h2>${preview.title}</h2>
      <p class="subject"><strong>Objet :</strong> ${preview.subject}</p>
      <div class="actions">
        <a href="${file}" target="_blank">Ouvrir seul</a>
      </div>
      <iframe src="${file}" title="${preview.title}"></iframe>
    </article>`;
  })
  .join("\n");

writeFileSync(
  resolve(outDir, "index.html"),
  `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tombola — aperçu des e-mails</title>
  <style>
    body { margin: 0; font-family: Manrope, "Segoe UI", sans-serif; background: #f4f4f6; color: #141416; }
    header { padding: 24px 20px; background: #fff; border-bottom: 1px solid #ececee; }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    p { margin: 0; color: #73737a; }
    .grid { display: grid; gap: 20px; padding: 20px; }
    .card { background: #fff; border: 1px solid #ececee; border-radius: 16px; overflow: hidden; }
    .card h2 { margin: 0; padding: 16px 16px 8px; font-size: 1rem; }
    .subject { padding: 0 16px 12px; font-size: 0.88rem; color: #73737a; }
    .actions { padding: 0 16px 12px; }
    .actions a { color: #be034d; font-weight: 650; text-decoration: none; }
    iframe { width: 100%; height: 720px; border: 0; border-top: 1px solid #ececee; background: #fafafa; }
    @media (min-width: 1100px) { .grid { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Aperçu des e-mails transactionnels</h1>
    <p>Rotaract IUGB Club · généré localement · ${previews.length} modèles</p>
  </header>
  <main class="grid">${cards}</main>
</body>
</html>`,
  "utf8",
);

const pdf = await buildPurchaseReceiptPdf(purchaseSample);
writeFileSync(resolve(outDir, "04-purchase.pdf"), pdf);

console.log(`Wrote ${previews.length} previews to ${outDir}`);
console.log(`Open ${resolve(outDir, "index.html")}`);

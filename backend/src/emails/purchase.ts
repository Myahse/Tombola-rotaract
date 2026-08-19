import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";
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
  drawMode?: "scratch" | "roulette";
  ticketsUrl: string;
};

export function purchaseEmail(data: PurchaseEmail) {
  const name = firstName(data.name);
  const total = formatMoney(data.ticketPriceCents * data.quantity, data.currency);
  const unit = formatMoney(data.ticketPriceCents, data.currency);
  const tickets = ticketWord(data.quantity);
  const numbers = data.numbers.join(", ");
  const buyUrl = siteUrl("/fr/buy");
  const donateUrl = siteUrl("/fr/donate");
  const afterDrawFr =
    data.drawMode === "roulette"
      ? "Le jour J, tout le monde suit la roulette : ticket par ticket, les gagnants sont désignés en public."
      : "Les lots ont été attribués à des numéros à la roulette, à la création de la tombola. Grattez en ligne pour voir si le vôtre en a un.";
  const afterDrawEn =
    data.drawMode === "roulette"
      ? "On the day, everyone watches the wheel: winners are named in public, ticket by ticket."
      : "Prizes were assigned to ticket numbers on the wheel when the tombola was created. Scratch online to see if yours has one.";

  const html = wrapEmail({
    preheader: `${name}, paiement confirmé. Vos ${data.quantity} ${tickets} pour ${data.eventTitleFr} sont dans le tirage.`,
    heading: `${name}, vous êtes dans le tirage`,
    ctaLabel: "Voir mes tickets",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Ceci est votre reçu. Le club a confirmé le paiement de <strong>${escapeHtml(total)}</strong> pour <strong>${escapeHtml(data.eventTitleFr)}</strong>. Vos tickets sont à votre nom et participent au tirage.</p>
      <p style="margin:0 0 16px;">${afterDrawFr}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #ececee;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#a1a1a8;">Vos numéros</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#141416;">n° ${escapeHtml(numbers)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;background:#faf0f4;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#be034d;">Reçu</p>
            <p style="margin:0;font-size:15px;line-height:1.55;color:#141416;">${escapeHtml(data.quantity === 1 ? "1 ticket" : `${data.quantity} tickets`)} · ${escapeHtml(unit)} l’unité · ${escapeHtml(total)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px;color:#141416;">Connectez-vous pour voir vos tickets. Un ami du club n’a pas encore de ticket ? <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Offrez-lui une place</a>.</p>
      <p style="margin:0 0 14px;">Envie de soutenir autrement ? <a href="${escapeHtml(donateUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Un don Wave</a> aide aussi le club, même sans ticket.</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> ${escapeHtml(name)}, this is your receipt. Payment of ${escapeHtml(total)} is confirmed. Your numbers: ${escapeHtml(numbers)}. ${escapeHtml(afterDrawEn)}</p>
    `,
  });

  const text = [
    `${name}, vous êtes dans le tirage.`,
    "",
    `Ceci est votre reçu. Le club a confirmé le paiement de ${total} pour ${data.eventTitleFr}.`,
    `Numéros : ${numbers}`,
    `Total : ${total} (${unit} par ticket)`,
    "",
    `Vos tickets : ${data.ticketsUrl}`,
    `Offrir un ticket à un ami : ${buyUrl}`,
    `Soutenir le club : ${donateUrl}`,
    "",
    `EN: ${name}, this is your receipt. Payment of ${total} is confirmed. Your numbers: ${numbers}. ${afterDrawEn}`,
  ].join("\n");

  return {
    subject: `${name}, paiement confirmé : vos ${data.quantity} ${tickets} pour ${data.eventTitleFr}`,
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
      ticketsUrl: data.ticketsUrl,
      buyUrl,
      donateUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";
import { formatMoney, ticketWord } from "../lib/money.js";
import { wavePayUrl } from "../lib/payments.js";

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
  const wave = data.paymentMethod === "wave";
  const buyUrl = siteUrl("/fr/buy");
  const donateUrl = siteUrl("/fr/donate");
  const payUrl = wavePayUrl();

  const nextStepFr = wave
    ? `Ouvrez Wave et réglez <strong>${escapeHtml(total)}</strong> maintenant (Doaty Délice, affilié au club). Tant que le paiement n’est pas reçu, vos tickets restent hors du tirage.`
    : `Passez au club avec <strong>${escapeHtml(total)}</strong> en espèces. Un organisateur marque « payé » — et là, vous êtes vraiment dans le chapeau.`;
  const nextStepEn = wave
    ? `Pay ${total} with Wave now. Unpaid tickets stay out of the draw.`
    : `Bring ${total} in cash to the club. Once an organizer marks you paid, you are in the draw.`;
  const afterDrawFr =
    data.drawMode === "roulette"
      ? "Le jour J, tout le monde suit la roulette : ticket par ticket, les gagnants sont désignés en public."
      : "Le jour J, on attribue les lots aux tickets, puis vous grattez en ligne.";
  const afterDrawEn =
    data.drawMode === "roulette"
      ? "On the day, everyone watches the wheel: winners are named in public, ticket by ticket."
      : "On the day, prizes are assigned to tickets, then you scratch online.";

  const html = wrapEmail({
    preheader: `${name}, vos ${data.quantity} ${tickets} pour ${data.eventTitleFr} sont réservés. Un dernier geste et vous jouez.`,
    heading: `${name}, vous êtes presque dans le tirage`,
    ctaLabel: wave ? "Payer avec Wave" : "Voir mes tickets",
    ctaUrl: wave ? payUrl : data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Ce n’est pas un reçu. C’est votre place dans <strong>${escapeHtml(data.eventTitleFr)}</strong> — et chaque ticket aide le Rotaract IUGB Club à continuer ses actions.</p>
      <p style="margin:0 0 16px;">Vous avez ${data.quantity} ${tickets} à votre nom. ${afterDrawFr} Simple, vivant, et ça se passe entre nous.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #ececee;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#a1a1a8;">Vos numéros</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#141416;">n° ${escapeHtml(numbers)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;background:#faf0f4;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#be034d;">À faire maintenant</p>
            <p style="margin:0;font-size:15px;line-height:1.55;color:#141416;">${nextStepFr}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px;color:#141416;">Un ami du club n’a pas encore de ticket ? <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Offrez-lui une place</a>. Plus on est nombreux, plus le tirage a de la vie — et on se revoit à la prochaine tombola.</p>
      <p style="margin:0 0 14px;">Envie de soutenir autrement ? <a href="${escapeHtml(donateUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Un don Wave</a> aide aussi le club, même sans ticket.</p>
      ${wave ? `<p style="margin:0 0 14px;font-size:14px;"><a href="${escapeHtml(data.ticketsUrl)}" style="color:#141416;font-weight:650;">Garder mes tickets sous la main →</a></p>` : ""}
      <p style="margin:0;font-size:13px;color:#73737a;">${escapeHtml(data.quantity === 1 ? "1 ticket" : `${data.quantity} tickets`)} · ${escapeHtml(unit)} l’unité · ${escapeHtml(total)}<br /><em>EN</em> — ${escapeHtml(name)}, your tickets for ${escapeHtml(data.eventTitleEn)} are reserved. ${escapeHtml(nextStepEn)} ${escapeHtml(afterDrawEn)} We’ll want you back for the next one.</p>
    `,
  });

  const text = [
    `${name}, vous êtes presque dans le tirage.`,
    "",
    `Vos ${data.quantity} ${tickets} pour ${data.eventTitleFr} sont réservés. Ce n’est pas un reçu : c’est votre place dans le jeu du club.`,
    `Numéros : ${numbers}`,
    `Total : ${total} (${unit} par ticket)`,
    "",
    wave ? `Payez maintenant avec Wave : ${payUrl}` : `Passez au club avec ${total} en espèces. Tant que ce n’est pas payé, vos tickets restent hors du tirage.`,
    `Vos tickets : ${data.ticketsUrl}`,
    `Offrir un ticket à un ami : ${buyUrl}`,
    `Soutenir le club : ${donateUrl}`,
    "",
    `EN — Your tickets for ${data.eventTitleEn} are reserved. ${nextStepEn} See you at the next tombola.`,
  ].join("\n");

  return {
    subject: `${name}, vos ${data.quantity} ${tickets} pour ${data.eventTitleFr} vous attendent`,
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
      payUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

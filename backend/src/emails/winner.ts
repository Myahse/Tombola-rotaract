import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type WinnerEmail = {
  name: string;
  email: string;
  eventTitleFr: string;
  eventTitleEn: string;
  prizeNameFr: string;
  prizeNameEn: string;
  rank: number;
  ticketNumber: number;
  ticketsUrl: string;
};

export function winnerEmail(data: WinnerEmail) {
  const name = firstName(data.name);
  const buyUrl = siteUrl("/fr/buy");
  const html = wrapEmail({
    preheader: `${name}, votre ticket n°${data.ticketNumber} vient de gagner ${data.prizeNameFr}. Venez le chercher.`,
    heading: `${name}, c’est gagné !`,
    ctaLabel: "Voir mon ticket",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Le tirage a parlé. Votre ticket a été tiré pour <strong>${escapeHtml(data.eventTitleFr)}</strong> — et tout le club va en parler.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #ececee;background:#faf0f4;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#be034d;">Votre lot</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#141416;">${data.rank}. ${escapeHtml(data.prizeNameFr)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#a1a1a8;">Ticket gagnant</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#141416;">n° ${data.ticketNumber}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px;color:#141416;">Passez au club pour retirer votre lot. En attendant, grattez votre ticket en ligne — et dites-le autour de vous. La prochaine tombola, on veut vous revoir. Un ami n’a pas joué cette fois ? <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Qu’il prenne sa place pour la suivante</a>.</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — You won ${escapeHtml(data.prizeNameEn)} with ticket no. ${data.ticketNumber} in ${escapeHtml(data.eventTitleEn)}. Collect it at the club, scratch online, and come back for the next draw.</p>
    `,
  });

  const text = [
    `${name}, c’est gagné !`,
    data.eventTitleFr,
    `Lot ${data.rank} : ${data.prizeNameFr}`,
    `Ticket n° ${data.ticketNumber}`,
    `Voir le ticket : ${data.ticketsUrl}`,
    `Prochaine tombola : ${buyUrl}`,
    "",
    `EN — You won ${data.prizeNameEn} with ticket no. ${data.ticketNumber}. Collect it at the club — and come back next time.`,
  ].join("\n");

  return {
    subject: `${name}, vous avez gagné : ${data.prizeNameFr}`,
    html,
    text,
    params: {
      name,
      email: data.email,
      eventTitleFr: data.eventTitleFr,
      eventTitleEn: data.eventTitleEn,
      prizeNameFr: data.prizeNameFr,
      prizeNameEn: data.prizeNameEn,
      rank: String(data.rank),
      ticketNumber: String(data.ticketNumber),
      ticketsUrl: data.ticketsUrl,
      buyUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

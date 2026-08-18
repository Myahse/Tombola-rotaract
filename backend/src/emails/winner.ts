import { escapeHtml, siteUrl, wrapEmail } from "./layout.js";

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
  const name = data.name.trim() || "ami(e) du club";
  const html = wrapEmail({
    preheader: `Vous avez gagné ${data.prizeNameFr} avec le ticket n°${data.ticketNumber}.`,
    heading: "Vous avez gagné !",
    ctaLabel: "Voir mon ticket",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Bravo ${escapeHtml(name)} — votre ticket a été tiré au sort.</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(data.eventTitleFr)}</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #ececee;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#a1a1a8;">Lot</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#be034d;">${data.rank}. ${escapeHtml(data.prizeNameFr)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#a1a1a8;">Ticket gagnant</p>
            <p style="margin:0;font-size:18px;font-weight:650;color:#141416;">n° ${data.ticketNumber}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px;">Rendez-vous au club pour retirer votre lot. Vous pouvez aussi gratter votre ticket en ligne.</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — Congratulations, you won ${escapeHtml(data.prizeNameEn)} with ticket no. ${data.ticketNumber} in ${escapeHtml(data.eventTitleEn)}. Collect your prize at the club, or scratch your ticket online.</p>
    `,
  });

  const text = [
    `Bravo ${name}, vous avez gagné !`,
    data.eventTitleFr,
    `Lot ${data.rank} : ${data.prizeNameFr}`,
    `Ticket n° ${data.ticketNumber}`,
    `Voir le ticket : ${data.ticketsUrl}`,
    "",
    `EN — You won ${data.prizeNameEn} with ticket no. ${data.ticketNumber}.`,
  ].join("\n");

  return {
    subject: `Vous avez gagné : ${data.prizeNameFr}`,
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
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

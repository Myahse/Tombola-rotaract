import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type GiftTicketsEmail = {
  name: string;
  email: string;
  giverName: string;
  eventTitleFr: string;
  eventTitleEn: string;
  numbers: number[];
  hasAccount: boolean;
  ticketsUrl: string;
};

export function giftTicketsEmail(data: GiftTicketsEmail) {
  const name = firstName(data.name);
  const giver = firstName(data.giverName);
  const numbers = data.numbers.join(", ");
  const tickets = data.numbers.length === 1 ? "ticket" : "tickets";
  const html = wrapEmail({
    preheader: `${giver} vous offre ${data.numbers.length} ${tickets} pour ${data.eventTitleFr}.`,
    heading: `${name}, ${giver} vous offre des tickets`,
    ctaLabel: data.hasAccount ? "Voir mes tickets" : "Créer mon compte",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;"><strong>${escapeHtml(data.giverName)}</strong> vous a transmis ${data.numbers.length} ${tickets} pour <strong>${escapeHtml(data.eventTitleFr)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:18px;font-weight:650;color:#141416;">n° ${escapeHtml(numbers)}</p>
      <p style="margin:0 0 14px;">${data.hasAccount ? "Connectez-vous avec cet e-mail pour les retrouver." : "Créez un compte avec cet e-mail pour les voir et participer au tirage."}</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> ${escapeHtml(giver)} sent you ticket numbers ${escapeHtml(numbers)} for ${escapeHtml(data.eventTitleEn)}. ${data.hasAccount ? "Log in with this email to see them." : "Create an account with this email to claim them."}</p>
    `,
  });

  const text = [
    `${name}, ${giver} vous offre des tickets.`,
    "",
    `Tombola : ${data.eventTitleFr}`,
    `Numéros : ${numbers}`,
    data.hasAccount
      ? `Voir mes tickets : ${data.ticketsUrl}`
      : `Créer un compte pour les voir : ${data.ticketsUrl}`,
    "",
    `EN: ${giver} sent you ticket numbers ${numbers}. Open ${data.ticketsUrl}`,
  ].join("\n");

  return {
    subject: `${giver} vous offre des tickets pour ${data.eventTitleFr}`,
    html,
    text,
    params: {
      name,
      giverName: data.giverName,
      eventTitleFr: data.eventTitleFr,
      numbers,
      ticketsUrl: data.ticketsUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

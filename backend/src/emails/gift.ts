import { emailEnglishBlock, emailHighlightBox, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

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
  const ticketLabel = data.numbers.length === 1 ? "Votre numéro" : "Vos numéros";
  const englishSummary = data.hasAccount
    ? `${giver} sent you ${data.numbers.length} ${data.numbers.length === 1 ? "ticket" : "tickets"} for ${data.eventTitleEn}. Numbers: ${numbers}. Log in with this email to see them.`
    : `${giver} sent you ${data.numbers.length} ${data.numbers.length === 1 ? "ticket" : "tickets"} for ${data.eventTitleEn}. Numbers: ${numbers}. Create an account with this email to claim them.`;

  const html = wrapEmail({
    preheader: `${giver} vous offre ${data.numbers.length} ${tickets} pour ${data.eventTitleFr}.`,
    heading: `${name}, ${giver} vous offre des tickets`,
    ctaLabel: data.hasAccount ? "Voir mes tickets" : "Créer mon compte",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 16px;color:#141416;"><strong>${escapeHtml(data.giverName)}</strong> vous a transmis ${data.numbers.length} ${tickets} pour <strong>${escapeHtml(data.eventTitleFr)}</strong>.</p>
      ${emailHighlightBox(ticketLabel, `n° ${escapeHtml(numbers)}`)}
      <p style="margin:0 0 14px;color:#141416;">${data.hasAccount ? "Connectez-vous avec cet e-mail pour les retrouver dans votre compte." : "Créez un compte avec cet e-mail pour les voir et participer au tirage."}</p>
      ${emailEnglishBlock(englishSummary)}
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
    `ENGLISH : ${englishSummary}`,
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
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

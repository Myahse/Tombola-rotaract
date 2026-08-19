import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type ParticipantEmail = {
  name: string;
  email: string;
  eventTitleFr: string;
  eventTitleEn: string;
  ticketsUrl: string;
};

export function participantEmail(data: ParticipantEmail) {
  const name = firstName(data.name);
  const buyUrl = siteUrl("/fr/buy");
  const donateUrl = siteUrl("/fr/donate");
  const html = wrapEmail({
    preheader: `${name}, le tirage de ${data.eventTitleFr} est passé. On se revoit à la prochaine — et vos tickets s’attendent à être grattés.`,
    heading: `${name}, merci d’avoir joué`,
    ctaLabel: "Gratter mes tickets",
    ctaUrl: data.ticketsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Le tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong> est terminé. Cette fois, le sort n’a pas appelé vos numéros — et ce n’est pas la fin de l’histoire.</p>
      <p style="margin:0 0 14px;">Vous avez déjà fait quelque chose de concret : vos tickets ont soutenu les actions du Rotaract IUGB Club. Grattez-les quand même, gardez le rituel, et restez dans le jeu.</p>
      <p style="margin:0 0 14px;">La prochaine tombola arrive. Prenez vos tickets plus tôt, invitez un ami, et on se retrouve autour du tirage. <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Je veux être là la prochaine fois</a> · <a href="${escapeHtml(donateUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Soutenir le club</a></p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — The draw for ${escapeHtml(data.eventTitleEn)} is done. No prize this time — scratch your tickets anyway, and come back for the next tombola. The club is better when you are in it.</p>
    `,
  });

  const text = [
    `${name}, merci d’avoir joué.`,
    `Le tirage de ${data.eventTitleFr} est terminé. Cette fois, pas de lot — on se revoit à la prochaine.`,
    `Gratter vos tickets : ${data.ticketsUrl}`,
    `Prochaine tombola : ${buyUrl}`,
    `Soutenir le club : ${donateUrl}`,
    "",
    `EN — No prize this time. Scratch your tickets, and come back for the next draw.`,
  ].join("\n");

  return {
    subject: `${name}, on se revoit à la prochaine tombola`,
    html,
    text,
    params: {
      name,
      eventTitleFr: data.eventTitleFr,
      eventTitleEn: data.eventTitleEn,
      ticketsUrl: data.ticketsUrl,
      buyUrl,
      donateUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

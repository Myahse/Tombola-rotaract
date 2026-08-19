import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type WelcomeEmail = {
  name: string;
  email: string;
};

export function welcomeEmail(data: WelcomeEmail) {
  const name = firstName(data.name);
  const accountUrl = siteUrl("/fr/account");
  const buyUrl = siteUrl("/fr/buy");
  const html = wrapEmail({
    preheader: `${name}, votre place au club est prête. La tombola n’attend plus que vous.`,
    heading: `Bienvenue dans le jeu, ${name}`,
    ctaLabel: "Prendre mes tickets",
    ctaUrl: buyUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Vous faites maintenant partie de la tombola du <strong>Rotaract IUGB Club</strong>. Un compte, toutes les tombolas : cérémonie, réunion, ou la prochaine surprise du club.</p>
      <p style="margin:0 0 14px;">Le rituel est simple : vous réservez, vous payez, vous grattez. Et on recommence.</p>
      <p style="margin:0 0 14px;">N’attendez pas le dernier jour. Les meilleurs lots partent avec ceux qui sont déjà dans le chapeau.</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><a href="${escapeHtml(accountUrl)}" style="color:#141416;font-weight:650;">Mes tombolas</a> — vos tickets restent ici.<br /><em>EN</em> — Your club account is ready. Grab tickets now, pay, then scratch. We’ll want you back for the next one.</p>
    `,
  });

  const text = [
    `Bienvenue dans le jeu, ${name}.`,
    "",
    "Votre compte Rotaract IUGB Club est prêt. Un compte pour toutes les tombolas.",
    `Prendre des tickets : ${buyUrl}`,
    `Mes tombolas : ${accountUrl}`,
    "",
    "EN — Your account is ready. Grab tickets now — we’ll want you back for the next draw.",
  ].join("\n");

  return {
    subject: `${name}, votre place au club est prête`,
    html,
    text,
    params: {
      name,
      accountUrl,
      buyUrl,
      logoUrl: siteUrl("/logo.png"),
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

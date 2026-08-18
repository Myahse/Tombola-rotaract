import { siteUrl, wrapEmail } from "./layout";

export type WelcomeEmail = {
  name: string;
  email: string;
};

export function welcomeEmail(data: WelcomeEmail) {
  const name = data.name.trim() || "ami(e) du club";
  const accountUrl = siteUrl("/fr/account");
  const html = wrapEmail({
    preheader: "Votre compte Rotaract IUGB Club est prêt. Un compte pour toutes les tombolas.",
    heading: `Bienvenue, ${name}`,
    ctaLabel: "Voir mes tombolas",
    ctaUrl: accountUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Votre compte est créé. Il servira pour chaque tombola du club : cérémonie, réunion, ou autre événement.</p>
      <p style="margin:0 0 14px;">Connectez-vous, réservez vos tickets, payez au club, puis grattez après le tirage. Tout votre historique reste dans <strong>Mes tombolas</strong>.</p>
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — Your Rotaract IUGB Club account is ready. Use it for every tombola: ceremonies, meetings, and other club events. Find your tickets under My tombolas.</p>
    `,
  });

  const text = [
    `Bienvenue, ${name}`,
    "",
    "Votre compte Rotaract IUGB Club est créé. Il servira pour chaque tombola du club.",
    `Mes tombolas : ${accountUrl}`,
    "",
    "Your account is ready. Use it for every club tombola.",
  ].join("\n");

  return {
    subject: "Bienvenue au club — votre compte tombola",
    html,
    text,
    params: {
      name,
      accountUrl,
      logoUrl: siteUrl("/logo.png"),
    },
  };
}

import { emailEnglishBlock, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type VerifyEmail = {
  name: string;
  email: string;
  verifyUrl: string;
};

export function verifyEmailMessage(data: VerifyEmail) {
  const name = firstName(data.name);
  const html = wrapEmail({
    preheader: `${name}, confirmez votre e-mail pour rattacher vos tickets.`,
    heading: `${name}, confirmez votre e-mail`,
    ctaLabel: "Confirmer mon e-mail",
    ctaUrl: data.verifyUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Confirmez ${escapeHtml(data.email)} pour le compte Rotaract IUGB Club. Cela permet de rattacher les tickets offerts à cette adresse.</p>
      <p style="margin:0 0 14px;color:#141416;">Le lien expire dans 24 heures. Si vous n’avez pas créé ce compte, ignorez cet e-mail.</p>
      ${emailEnglishBlock(
        `${name}, confirm ${data.email} to attach gifted tickets. The link expires in 24 hours. Ignore this message if you did not create the account.`,
      )}
    `,
  });

  const text = [
    `${name}, confirmez votre e-mail.`,
    "",
    `Lien (valable 24 heures) : ${data.verifyUrl}`,
    "Si vous n’avez pas créé ce compte, ignorez cet e-mail.",
    "",
    `ENGLISH : ${name}, confirm ${data.email} to attach gifted tickets. The link expires in 24 hours.`,
  ].join("\n");

  return {
    subject: `${name}, confirmez votre e-mail`,
    html,
    text,
    params: {
      name,
      verifyUrl: data.verifyUrl,
      logoUrl: siteUrl("/logo.png"),
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

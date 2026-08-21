import { emailEnglishBlock, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type ResetPasswordEmail = {
  name: string;
  email: string;
  resetUrl: string;
};

export function resetPasswordEmail(data: ResetPasswordEmail) {
  const name = firstName(data.name);
  const html = wrapEmail({
    preheader: `${name}, voici le lien pour choisir un nouveau mot de passe.`,
    heading: `${name}, réinitialisez votre mot de passe`,
    ctaLabel: "Choisir un nouveau mot de passe",
    ctaUrl: data.resetUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Quelqu’un a demandé un nouveau mot de passe pour le compte Rotaract IUGB Club lié à ${escapeHtml(data.email)}.</p>
      <p style="margin:0 0 14px;color:#141416;">Le lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.</p>
      ${emailEnglishBlock(
        `${name}, use the button to choose a new password. The link expires in one hour. Ignore this message if you did not ask for it.`,
      )}
    `,
  });

  const text = [
    `${name}, réinitialisez votre mot de passe.`,
    "",
    `Lien (valable une heure) : ${data.resetUrl}`,
    "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
    "",
    `ENGLISH : ${name}, choose a new password with the link above. It expires in one hour. Ignore this message if you did not ask for it.`,
  ].join("\n");

  return {
    subject: `${name}, réinitialisez votre mot de passe`,
    html,
    text,
    params: {
      name,
      resetUrl: data.resetUrl,
      logoUrl: siteUrl("/logo.png"),
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

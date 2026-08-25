import { emailEnglishBlock, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type QcmInviteEmail = {
  name: string;
  email: string;
  titleFr: string;
  titleEn: string;
  examUrl: string;
  lang: "fr" | "en";
};

export function qcmInviteEmail(data: QcmInviteEmail) {
  const name = firstName(data.name || data.email);
  const registerUrl = siteUrl(`/${data.lang}/register`);
  const html = wrapEmail({
    preheader: `${name}, vous êtes convoqué(e) au QCM « ${data.titleFr} ».`,
    heading: `${name}, c’est votre QCM`,
    ctaLabel: "Ouvrir ce QCM",
    ctaUrl: data.examUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">La surveillance vous envoie le lien du <strong>${escapeHtml(data.titleFr)}</strong>. Ce lien n’ouvre que cet examen, pas un autre.</p>
      <p style="margin:0 0 14px;">Connectez-vous avec le compte du club, autorisez la caméra, puis restez sur cet écran jusqu’à la fin.</p>
      <p style="margin:0 0 14px;">Pas encore de compte ? <a href="${escapeHtml(registerUrl)}">Créez-en un</a>, puis revenez ouvrir ce lien.</p>
      ${emailEnglishBlock(
        ` ${name}, this link opens only « ${data.titleEn} ». Log in with your club account, allow the camera, and stay on that page until you finish. No account yet? Create one, then open this link.`,
      )}
    `,
  });
  const text = [
    `${name}, c’est votre QCM.`,
    "",
    data.titleFr,
    "Ce lien n’ouvre que cet examen.",
    data.examUrl,
    "",
    `ENGLISH : This link opens only « ${data.titleEn} ». ${data.examUrl}`,
  ].join("\n");
  return {
    subject: `${name}, QCM : ${data.titleFr}`,
    html,
    text,
  };
}

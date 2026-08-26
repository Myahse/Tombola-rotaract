import { emailEnglishBlock, emailHighlightBox, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type QcmInviteEmail = {
  name: string;
  email: string;
  titleFr: string;
  titleEn: string;
  slug: string;
  examUrl: string;
  lang: "fr" | "en";
};

export function qcmInviteEmail(data: QcmInviteEmail) {
  const name = firstName(data.name || data.email);
  const registerUrl = siteUrl(`/${data.lang}/register`);
  const title = data.lang === "en" ? data.titleEn : data.titleFr;
  const html = wrapEmail({
    preheader: `${name}, vous êtes convoqué(e) au QCM « ${data.titleFr} ».`,
    heading: `${name}, c’est votre QCM`,
    ctaLabel: "Ouvrir ce QCM",
    ctaUrl: data.examUrl,
    bodyHtml: `
      ${emailHighlightBox("QCM", escapeHtml(title))}
      <p style="margin:0 0 14px;color:#141416;">Ce lien est personnel. Il ouvre uniquement <strong>${escapeHtml(data.titleFr)}</strong> <span style="color:#73737a;">(${escapeHtml(data.slug)})</span>, pas un autre QCM.</p>
      <p style="margin:0 0 14px;">Connectez-vous avec le compte du club (le même e-mail que cette convocation : <strong>${escapeHtml(data.email)}</strong>), autorisez la caméra, partagez tout l’écran, puis restez sur cette page jusqu’à la fin.</p>
      <p style="margin:0 0 14px;">Pas encore de compte ? <a href="${escapeHtml(registerUrl)}">Créez-en un</a> avec <strong>${escapeHtml(data.email)}</strong>, puis ouvrez ce lien.</p>
      ${emailEnglishBlock(
        ` ${name}, this personal link opens only « ${data.titleEn} » (${data.slug}). Log in with ${data.email}, allow the camera, share your whole screen, and stay on that page until you finish.`,
      )}
    `,
  });
  const text = [
    `${name}, c’est votre QCM.`,
    "",
    data.titleFr,
    data.slug,
    "Ce lien n’ouvre que cet examen.",
    data.examUrl,
    "",
    `ENGLISH : This link opens only « ${data.titleEn} » (${data.slug}). ${data.examUrl}`,
  ].join("\n");
  return {
    subject: `${name}, QCM « ${data.titleFr} »`,
    html,
    text,
  };
}

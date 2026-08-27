import { emailEnglishBlock, emailHighlightBox, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";
import { examAppointmentIcs } from "../lib/ics.js";
import { convenedWord } from "../lib/gender.js";

export type QcmInviteEmail = {
  name: string;
  email: string;
  titleFr: string;
  titleEn: string;
  slug: string;
  examUrl: string;
  lang: "fr" | "en";
  scheduledAt: string;
  durationSeconds: number | null;
  inviteId: string;
  gender?: string | null;
};

const TZ = "Africa/Abidjan";

export function formatAppointment(iso: string, lang: "fr" | "en") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function qcmInviteEmail(data: QcmInviteEmail) {
  const name = firstName(data.name || data.email);
  const registerUrl = siteUrl(`/${data.lang}/register`);
  const title = data.lang === "en" ? data.titleEn : data.titleFr;
  const when = formatAppointment(data.scheduledAt, data.lang);
  const whenEn = formatAppointment(data.scheduledAt, "en");
  const convened = convenedWord(data.gender);
  const html = wrapEmail({
    preheader: `${name}, vous êtes ${convened} au QCM « ${data.titleFr} » le ${when}.`,
    heading: `${name}, c’est votre convocation`,
    ctaLabel: "Ouvrir ce QCM",
    ctaUrl: data.examUrl,
    bodyHtml: `
      ${emailHighlightBox("QCM", escapeHtml(title))}
      ${emailHighlightBox("Date de l’examen", escapeHtml(when))}
      <p style="margin:0 0 14px;color:#141416;">Ce lien est personnel. Il ouvre uniquement <strong>${escapeHtml(data.titleFr)}</strong> <span style="color:#73737a;">(${escapeHtml(data.slug)})</span>.</p>
      <p style="margin:0 0 14px;">Il reste valable jusqu’à la fin de l’examen, pas seulement à l’heure indiquée. Vous pouvez l’ouvrir dès maintenant pour voir la date, puis commencer quand la surveillance ouvre la session.</p>
      <p style="margin:0 0 14px;">Connectez-vous avec le compte du club (le même e-mail que cette convocation : <strong>${escapeHtml(data.email)}</strong>), autorisez la caméra, partagez tout l’écran, puis restez sur cette page jusqu’à la fin.</p>
      <p style="margin:0 0 14px;">Pas encore de compte ? <a href="${escapeHtml(registerUrl)}">Créez-en un</a> avec <strong>${escapeHtml(data.email)}</strong>, puis ouvrez ce lien.</p>
      ${emailEnglishBlock(
        ` ${name}, you are convened for « ${data.titleEn} » on ${whenEn} (Abidjan time). This personal link stays valid until you finish, not only at that hour. Log in with ${data.email}, allow the camera, share your whole screen, and stay on that page until you finish.`,
      )}
    `,
  });
  const text = [
    `${name}, c’est votre convocation.`,
    "",
    data.titleFr,
    `Date : ${when}`,
    data.slug,
    "Ce lien reste valable jusqu’à la fin de l’examen.",
    data.examUrl,
    "",
    `ENGLISH : Convened for « ${data.titleEn} » on ${whenEn}. This link stays valid until you finish. ${data.examUrl}`,
  ].join("\n");
  const startsAt = new Date(data.scheduledAt);
  const ics = Number.isNaN(startsAt.getTime())
    ? ""
    : examAppointmentIcs({
        uid: `${data.inviteId}@exam.rotaractiugb.com`,
        title: data.lang === "en" ? data.titleEn : data.titleFr,
        description: [
          data.lang === "en"
            ? `Personal exam link (valid until you finish): ${data.examUrl}`
            : `Lien personnel de l’examen (valable jusqu’à la fin) : ${data.examUrl}`,
        ].join("\n"),
        url: data.examUrl,
        startsAt,
        durationSeconds: data.durationSeconds && data.durationSeconds > 0 ? data.durationSeconds : 2 * 60 * 60,
      });
  return {
    subject: `${name}, convocation QCM « ${data.titleFr} » — ${when}`,
    html,
    text,
    attachments: ics
      ? [
          {
            name: "qcm-convocation.ics",
            content: Buffer.from(ics, "utf8").toString("base64"),
          },
        ]
      : [],
  };
}

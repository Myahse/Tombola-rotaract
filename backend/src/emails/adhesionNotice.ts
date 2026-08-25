import { campaignSiteUrl, emailEnglishBlock, escapeHtml, firstName, wrapEmail } from "./layout.js";

export type AdhesionNotice = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  sponsorName: string;
  sponsorEmail?: string | null;
  sponsorRole?: string | null;
  sponsorToken?: string | null;
};

export function adhesionApplicantAckEmail(row: AdhesionNotice) {
  const name = firstName(row.fullName);
  const sponsor = row.sponsorName.trim() || "votre parrain / marraine";
  const html = wrapEmail({
    preheader: `${name}, votre demande est bien partie. ${sponsor} va maintenant signer sa partie.`,
    heading: `${name}, on a bien reçu votre demande`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Merci d’avoir rempli le formulaire d’adhésion du <strong>Rotaract IUGB Club</strong>.</p>
      <p style="margin:0 0 14px;">La suite est simple : un e-mail part vers <strong>${escapeHtml(sponsor)}</strong>${row.sponsorEmail ? ` (${escapeHtml(row.sponsorEmail)})` : ""} pour qu’il ou elle confirme vous présenter au club et signe sa partie.</p>
      <p style="margin:0 0 14px;">Quand les deux signatures seront là, la Commission Effectif étudiera le dossier et vous recontactera.</p>
      ${emailEnglishBlock(
        ` ${name}, we received your membership form. We emailed ${sponsor} to confirm and sign. The membership committee reviews the file once both parts are in.`,
      )}
    `,
  });
  const text = [
    `${name}, on a bien reçu votre demande.`,
    "",
    `Un e-mail part vers ${sponsor}${row.sponsorEmail ? ` (${row.sponsorEmail})` : ""} pour qu’il ou elle signe sa partie.`,
    "La Commission Effectif vous recontactera une fois le dossier complet.",
    "",
    `ENGLISH : We received your form. We emailed ${sponsor} to sign. The committee reviews the file once both parts are in.`,
  ].join("\n");
  return {
    subject: `${name}, votre demande d’adhésion est en route`,
    html,
    text,
  };
}

export function adhesionSponsorInviteEmail(row: AdhesionNotice, lang: "fr" | "en") {
  const url = campaignSiteUrl(`/${lang}/join/sponsor/${row.sponsorToken ?? ""}`);
  const applicant = row.fullName.trim() || "un postulant";
  const sponsor = firstName(row.sponsorName);
  const html = wrapEmail({
    preheader: `${applicant} vous a choisi(e) comme parrain / marraine au Rotaract IUGB Club.`,
    heading: `${sponsor}, une adhésion vous attend`,
    ctaLabel: "Signer ma partie",
    ctaUrl: url,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;"><strong>${escapeHtml(applicant)}</strong> vient de remplir sa demande d’adhésion au <strong>Rotaract IUGB Club</strong> et vous a désigné(e) comme parrain ou marraine.</p>
      <p style="margin:0 0 8px;color:#73737a;">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</p>
      <p style="margin:0 0 14px;">On a besoin de vous pour la deuxième partie du formulaire : confirmer que vous présentez cette personne au club, indiquer votre fonction, puis signer.</p>
      <p style="margin:0 0 14px;">Cela ne prend qu’une minute. Sans votre signature, le dossier ne peut pas aller à la Commission Effectif.</p>
      ${emailEnglishBlock(
        ` ${applicant} named you as sponsor for the Rotaract IUGB Club. Open the button to confirm, add your role, and sign. The committee cannot review the file until you do.`,
      )}
    `,
  });
  const text = [
    `${sponsor}, une adhésion vous attend.`,
    "",
    `${applicant} vous a désigné(e) comme parrain / marraine au Rotaract IUGB Club.`,
    `${row.email} · ${row.phone}`,
    "",
    "Confirmez la présentation au club, indiquez votre fonction, puis signez. Sans cela, le dossier n’atteint pas la Commission Effectif.",
    url,
    "",
    `ENGLISH : ${applicant} named you as sponsor. Open the link to confirm, add your role, and sign.`,
  ].join("\n");
  return {
    subject: `${sponsor}, ${applicant} vous a choisi(e) comme parrain / marraine`,
    html,
    text,
  };
}

export function adhesionNoticeEmail(row: AdhesionNotice) {
  const reviewUrl = campaignSiteUrl(`/fr/forms/${row.id}`);
  const applicant = row.fullName.trim() || "Un postulant";
  const sponsor = row.sponsorName.trim() || "parrain / marraine";
  const role = row.sponsorRole?.trim();
  const html = wrapEmail({
    preheader: `${applicant} : les deux parties du formulaire sont signées.`,
    heading: "Un dossier d’adhésion est complet",
    ctaLabel: "Ouvrir le dossier",
    ctaUrl: reviewUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;"><strong>${escapeHtml(applicant)}</strong> a terminé sa demande. Le parrain / la marraine a signé. La Commission Effectif peut maintenant se prononcer.</p>
      <p style="margin:0 0 8px;">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</p>
      <p style="margin:0 0 14px;">Parrain / marraine : <strong>${escapeHtml(sponsor)}</strong>${role ? ` · ${escapeHtml(role)}` : ""}</p>
      ${emailEnglishBlock(
        ` ${applicant}’s membership form is complete. ${sponsor} has signed. Open the file to record the committee decision.`,
      )}
    `,
  });
  const text = [
    "Un dossier d’adhésion est complet.",
    "",
    applicant,
    `${row.email} · ${row.phone}`,
    `Parrain / marraine : ${sponsor}${role ? ` · ${role}` : ""}`,
    "",
    "Les deux parties sont signées. La Commission Effectif peut se prononcer.",
    reviewUrl,
    "",
    `ENGLISH : ${applicant}’s form is complete. ${sponsor} has signed. Open the file to record the decision.`,
  ].join("\n");
  return {
    subject: `Adhésion à étudier : ${applicant}`,
    html,
    text,
  };
}

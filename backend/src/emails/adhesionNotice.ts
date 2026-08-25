import { campaignSiteUrl, emailEnglishBlock, escapeHtml, wrapEmail } from "./layout.js";

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
  const html = wrapEmail({
    preheader: `Nous avons demandé à ${row.sponsorName} de valider votre dossier.`,
    heading: "Votre partie est enregistrée",
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Merci <strong>${escapeHtml(row.fullName)}</strong>. Votre formulaire d’adhésion est bien reçu.</p>
      <p style="margin:0 0 14px;">Nous venons d’écrire à votre parrain / marraine <strong>${escapeHtml(row.sponsorName)}</strong> (${escapeHtml(row.sponsorEmail ?? "")}) pour qu’il ou elle complète sa partie.</p>
      ${emailEnglishBlock("Your part is saved. We emailed your sponsor to complete their section.")}
    `,
  });
  const text = [
    "Votre partie est enregistrée",
    "",
    `Nous avons demandé à ${row.sponsorName} (${row.sponsorEmail ?? ""}) de valider votre dossier.`,
  ].join("\n");
  return {
    subject: "Adhésion : votre partie est envoyée",
    html,
    text,
  };
}

export function adhesionSponsorInviteEmail(row: AdhesionNotice, lang: "fr" | "en") {
  const url = campaignSiteUrl(`/${lang}/join/sponsor/${row.sponsorToken ?? ""}`);
  const html = wrapEmail({
    preheader: `${row.fullName} vous a désigné(e) comme parrain / marraine.`,
    heading: "Validation d’une adhésion",
    ctaLabel: "Compléter ma partie",
    ctaUrl: url,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;"><strong>${escapeHtml(row.fullName)}</strong> a rempli sa demande d’adhésion au Rotaract IUGB Club et vous a désigné(e) comme parrain / marraine.</p>
      <p style="margin:0 0 14px;">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</p>
      <p style="margin:0 0 14px;">Ouvrez le lien pour confirmer la présentation au club et signer votre partie du formulaire.</p>
      ${emailEnglishBlock(`${row.fullName} named you as sponsor. Open the link to complete your part of the form.`)}
    `,
  });
  const text = [
    "Validation d’une adhésion",
    "",
    `${row.fullName} vous a désigné(e) comme parrain / marraine.`,
    `${row.email} · ${row.phone}`,
    url,
  ].join("\n");
  return {
    subject: `Adhésion : ${row.fullName} vous attend`,
    html,
    text,
  };
}

export function adhesionNoticeEmail(row: AdhesionNotice) {
  const reviewUrl = campaignSiteUrl(`/fr/forms/${row.id}`);
  const html = wrapEmail({
    preheader: `${row.fullName} : le parrain / la marraine a validé le dossier.`,
    heading: "Dossier d’adhésion complet",
    ctaLabel: "Ouvrir le dossier",
    ctaUrl: reviewUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;"><strong>${escapeHtml(row.fullName)}</strong> a une demande d’adhésion complète. Le parrain / la marraine a validé sa partie.</p>
      <p style="margin:0 0 8px;">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</p>
      <p style="margin:0 0 14px;">Parrain / marraine : ${escapeHtml(row.sponsorName)}${row.sponsorRole ? ` (${escapeHtml(row.sponsorRole)})` : ""}</p>
      ${emailEnglishBlock(`${row.fullName}’s membership form is complete. The sponsor has signed. Open it in the campaign app.`)}
    `,
  });
  const text = [
    "Dossier d’adhésion complet",
    "",
    row.fullName,
    `${row.email} · ${row.phone}`,
    `Parrain / marraine : ${row.sponsorName}${row.sponsorRole ? ` (${row.sponsorRole})` : ""}`,
    reviewUrl,
  ].join("\n");
  return {
    subject: `Adhésion complète : ${row.fullName}`,
    html,
    text,
  };
}

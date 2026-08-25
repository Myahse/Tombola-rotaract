import type { CampaignDraft } from "./types";

export function adhesionFormUrl(lang: string) {
  return `${window.location.origin}/${lang}/join`;
}

export function adhesionCampaignDraft(lang: string, t: (key: string) => string): CampaignDraft {
  const url = adhesionFormUrl(lang);
  return {
    name: t("form.campaignName"),
    subject: t("form.campaignSubject"),
    preheader: t("form.campaignPreheader"),
    heading: t("form.campaignHeading"),
    body: t("form.campaignBody"),
    ctaLabel: t("form.campaignCta"),
    ctaUrl: url,
    includeMembers: false,
    includeBuyers: false,
    optedInOnly: false,
    extraEmails: "",
  };
}

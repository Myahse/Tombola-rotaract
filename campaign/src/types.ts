export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  includeMembers: boolean;
  includeBuyers: boolean;
  optedInOnly: boolean;
  extraEmails: string;
  status: CampaignStatus;
  sentCount: number;
  failedCount: number;
  recipientCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type CampaignAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  inline: boolean;
  bytes: number;
};

export type CampaignRecipient = {
  email: string;
  name: string;
  source: "member" | "buyer" | "custom";
  status: string;
  error: string | null;
  sentAt: string | null;
};

export type CampaignMeta = {
  brevo: boolean;
  audience: { members: number; optedIn: number; buyers: number };
};

export type CampaignPerson = {
  email: string;
  name: string;
  member: boolean;
  buyer: boolean;
  optedIn: boolean;
};

export type AudiencePreview = {
  total: number;
  invalid: number;
  truncated: boolean;
  recipients: { email: string; name: string; source: string }[];
};

export type CampaignDraft = {
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  includeMembers: boolean;
  includeBuyers: boolean;
  optedInOnly: boolean;
  extraEmails: string;
};

export type AdhesionStatus = "awaiting_sponsor" | "awaiting_review";

export type AdhesionApplication = {
  id: string;
  fullName: string;
  birthDate: string;
  sex: "female" | "male" | "other";
  address: string;
  phone: string;
  email: string;
  profession: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorRole: string | null;
  pledgeName: string;
  pledgeRules: boolean;
  pledgeParticipate: boolean;
  pledgeDues: boolean;
  pledgeObservation: boolean;
  applicantSignature: string;
  sponsorConfirmName: string | null;
  sponsorSignature: string | null;
  sponsorDate: string | null;
  status: AdhesionStatus;
  depositDate: string | null;
  commissionOpinion: string | null;
  finalDecision: "pending" | "accepted" | "rejected";
  presidentSignature: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdhesionApplicantSubmit = {
  fullName: string;
  birthDate: string;
  sex: "female" | "male" | "other";
  address: string;
  phone: string;
  email: string;
  profession: string;
  sponsorName: string;
  sponsorEmail: string;
  pledgeName: string;
  pledgeRules: boolean;
  pledgeParticipate: boolean;
  pledgeDues: boolean;
  pledgeObservation: boolean;
  applicantSignature: string;
  lang?: "fr" | "en";
};

export type AdhesionSponsorPreview = {
  fullName: string;
  email: string;
  profession: string;
  sponsorName: string;
  status: AdhesionStatus;
};

export type AdhesionSponsorSubmit = {
  sponsorName: string;
  sponsorRole: string;
  sponsorConfirmName: string;
  sponsorSignature: string;
  sponsorDate: string;
};

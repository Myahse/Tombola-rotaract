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

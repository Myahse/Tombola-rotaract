import { apiUrl } from "./config";
import type {
  AudiencePreview,
  Campaign,
  CampaignAttachment,
  CampaignDraft,
  CampaignMeta,
  CampaignPerson,
  CampaignRecipient,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data;
}

export const api = {
  login: (body: { email: string; password: string }) =>
    request<{ ok: boolean }>("/api/admin/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  me: () => request<{ ok: boolean }>("/api/admin/me"),
  meta: () => request<CampaignMeta>("/api/admin/campaigns/meta"),
  people: () => request<{ people: CampaignPerson[] }>("/api/admin/campaigns/people"),
  previewAudience: (body: Partial<CampaignDraft>) =>
    request<AudiencePreview>("/api/admin/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  previewHtml: (body: Partial<CampaignDraft> & { campaignId?: string }) =>
    request<{ subject: string; html: string }>("/api/admin/campaigns/preview-html", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: () => request<{ campaigns: Campaign[] }>("/api/admin/campaigns"),
  create: (body: CampaignDraft) =>
    request<{ campaign: Campaign }>("/api/admin/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  get: (id: string) =>
    request<{ campaign: Campaign; attachments: CampaignAttachment[]; recipients: CampaignRecipient[] }>(
      `/api/admin/campaigns/${encodeURIComponent(id)}`,
    ),
  save: (id: string, body: CampaignDraft) =>
    request<{ campaign: Campaign }>(`/api/admin/campaigns/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" }),
  duplicate: (id: string) =>
    request<{ campaign: Campaign }>(`/api/admin/campaigns/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
    }),
  addImage: (id: string, body: { filename: string; mimeType: string; content: string; inline: boolean }) =>
    request<{ attachment: CampaignAttachment }>(`/api/admin/campaigns/${encodeURIComponent(id)}/attachments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteImage: (id: string, attachmentId: string) =>
    request<{ ok: boolean }>(
      `/api/admin/campaigns/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: "DELETE" },
    ),
  test: (id: string, email: string) =>
    request<{ ok: boolean }>(`/api/admin/campaigns/${encodeURIComponent(id)}/test`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  send: (id: string) =>
    request<{ ok: boolean; status: string; recipientCount: number }>(
      `/api/admin/campaigns/${encodeURIComponent(id)}/send`,
      { method: "POST" },
    ),
};

export function attachmentUrl(campaignId: string, attachmentId: string) {
  return apiUrl(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/attachments/${encodeURIComponent(attachmentId)}`);
}

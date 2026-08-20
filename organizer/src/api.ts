import { apiUrl } from "./config";
import { inferredClubSlug } from "./clubSlug";
import type {
  AdminEvent,
  AdminEventSummary,
  AdminOrder,
  AdminStats,
  Contestant,
  OrderView,
  Prize,
  ScratchedTicket,
  Winner,
} from "./types";
import { withEventId } from "./organizerEvent";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Club-Slug": inferredClubSlug(),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data;
}

export const api = {
  publicClub: () =>
    request<{
      club: {
        id: string;
        slug: string;
        name: string;
        logoUrl: string | null;
        logoDarkUrl: string | null;
        primaryColor: string;
        publicUrl: string;
      };
    }>("/api/club"),
  results: () =>
    request<{ event: { titleFr: string; titleEn: string; status: string } | null; winners: Winner[] }>(
      "/api/event/current/results",
    ),
  buy: (body: { name: string; email: string; phone?: string; quantity: number }) =>
    request<OrderView>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  order: (token: string) => request<OrderView>(`/api/orders/${encodeURIComponent(token)}`),
  login: (body: { email: string; password: string; clubSlug?: string }) =>
    request<{ ok: boolean; club?: { id: string; slug: string; name: string } }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  me: () => request<{ ok: boolean; club?: { id: string; slug: string; name: string } }>("/api/admin/me"),
  clubSettings: () =>
    request<{
      club: {
        id: string;
        slug: string;
        name: string;
        logoUrl: string | null;
        logoDarkUrl: string | null;
        primaryColor: string;
        wavePayUrl: string;
        senderName: string;
        organizerEmails: string;
        publicUrl: string;
        organizerUrl: string;
        campaignUrl: string;
        customDomain: string | null;
      };
    }>("/api/admin/club"),
  saveClub: (body: Record<string, unknown>) =>
    request<{ club: { id: string; name: string } }>("/api/admin/club", { method: "PUT", body: JSON.stringify(body) }),
  adminEvents: () => request<{ events: AdminEventSummary[] }>("/api/admin/events"),
  adminEvent: () =>
    request<{ event: AdminEvent | null; prizes: Prize[]; stats: AdminStats | null }>(withEventId("/api/admin/event")),
  saveEvent: (body: Record<string, unknown>) =>
    request<{ event: AdminEvent }>(withEventId("/api/admin/event"), { method: "PUT", body: JSON.stringify(body) }),
  createEvent: (body: Record<string, unknown>) =>
    request<{ event: AdminEvent }>("/api/admin/event", { method: "POST", body: JSON.stringify(body) }),
  setStatus: (status: string) =>
    request<{ event: AdminEvent }>(withEventId("/api/admin/event/status"), {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  deleteEvent: () => request<{ ok: boolean }>(withEventId("/api/admin/event"), { method: "DELETE" }),
  orders: () => request<{ orders: AdminOrder[] }>(withEventId("/api/admin/orders")),
  addPhysical: (body: { name: string; quantity: number; phone?: string }) =>
    request<{ order: AdminOrder }>(withEventId("/api/admin/orders/physical"), {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markPaid: (id: string) =>
    request<{ order: AdminOrder }>(withEventId(`/api/admin/orders/${encodeURIComponent(id)}/paid`), { method: "POST" }),
  unmarkPaid: (id: string) =>
    request<{ order: AdminOrder }>(withEventId(`/api/admin/orders/${encodeURIComponent(id)}/unpaid`), { method: "POST" }),
  cancelOrder: (id: string) =>
    request<{ order: AdminOrder }>(withEventId(`/api/admin/orders/${encodeURIComponent(id)}/cancel`), { method: "POST" }),
  draw: () =>
    request<{ awarded: number; prizes: number; unpaidOrders: number; winners: Winner[] }>(withEventId("/api/admin/draw"), {
      method: "POST",
    }),
  contestants: () => request<{ contestants: Contestant[] }>(withEventId("/api/admin/contestants")),
  winners: () => request<{ event: AdminEvent | null; winners: Winner[] }>(withEventId("/api/admin/winners")),
  assignments: () =>
    request<{ sealed: boolean; totalTickets: number; assignments: Winner[] }>(withEventId("/api/admin/assignments")),
  sealPrizes: () =>
    request<{ sealed: boolean; totalTickets: number; assignments: Winner[] }>(withEventId("/api/admin/seal"), {
      method: "POST",
    }),
  scratches: () => request<{ scratches: ScratchedTicket[] }>(withEventId("/api/admin/scratches")),
};

export function formatMoney(amount: number, currency: string, lang: string) {
  const locale = lang === "fr" ? "fr-CI" : "en-US";
  const digits =
    new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount / 10 ** digits);
}

export function localized<T extends Record<string, unknown>>(item: T, lang: string, field: string) {
  const key = `${field}${lang === "en" ? "En" : "Fr"}` as keyof T;
  return String(item[key] ?? "");
}

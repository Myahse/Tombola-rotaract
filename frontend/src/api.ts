import { apiUrl } from "./config";
import type {
  AdminEvent,
  AdminOrder,
  AdminStats,
  Member,
  MemberTombola,
  OrderView,
  Prize,
  PublicEvent,
  Winner,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  currentEvent: () => request<{ event: PublicEvent | null }>("/api/event/current"),
  payments: () => request<{ wavePayUrl: string }>("/api/payments"),
  results: () =>
    request<{
      event: { titleFr: string; titleEn: string; status: string; drawMode?: "scratch" | "roulette" } | null;
      winners: Winner[];
    }>(
      "/api/event/current/results",
    ),
  buy: (body: { quantity: number; phone?: string; paymentMethod: "cash" | "wave" }) =>
    request<OrderView>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  order: (token: string) => request<OrderView>(`/api/orders/${encodeURIComponent(token)}`),
  sendPaymentRef: (token: string, paymentRef: string) =>
    request<{ paymentRef: string }>(`/api/orders/${encodeURIComponent(token)}/payment-ref`, {
      method: "POST",
      body: JSON.stringify({ paymentRef }),
    }),
  cancelMyOrder: (token: string) =>
    request<{ ok: boolean }>(`/api/orders/${encodeURIComponent(token)}/cancel`, { method: "POST" }),
  scratch: (token: string, number: number) =>
    request<{
      ok: boolean;
      scratchedAt: string;
      prizeRank: number | null;
      prizeNameFr: string | null;
      prizeNameEn: string | null;
    }>(
      `/api/orders/${encodeURIComponent(token)}/tickets/${number}/scratch`,
      { method: "POST" },
    ),
  register: (body: {
    name: string;
    email: string;
    phone: string;
    password: string;
    avatarUrl?: string;
    clubName: string;
    clubRole: string;
    acceptTerms: true;
    acceptEmails: true;
  }) => request<{ member: Member }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  memberLogin: (body: { email: string; password: string }) =>
    request<{ member: Member }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  memberLogout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  memberMe: () => request<{ member: Member }>("/api/auth/me"),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (body: { token: string; password: string }) =>
    request<{ member: Member }>("/api/auth/reset", { method: "POST", body: JSON.stringify(body) }),
  updateProfile: (body: {
    name: string;
    phone: string;
    avatarUrl?: string;
    clubName?: string;
    clubRole?: string;
    currentPassword?: string;
    password?: string;
  }) => request<{ member: Member }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  shareTickets: (token: string, body: { email: string; numbers?: number[] }) =>
    request<{ ok: boolean; remaining: boolean; token: string | null }>(
      `/api/orders/${encodeURIComponent(token)}/share`,
      { method: "POST", body: JSON.stringify(body) },
    ),
    myTombolas: () => request<{ tombolas: MemberTombola[] }>("/api/me/tombolas"),
  pushKey: () => request<{ publicKey: string | null }>("/api/push/key"),
  pushStatus: () => request<{ configured: boolean; subscribed: boolean }>("/api/push/status"),
  pushSubscribe: (body: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ ok: boolean }>("/api/push/subscribe", { method: "POST", body: JSON.stringify(body) }),
  pushUnsubscribe: (endpoint?: string) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    }),
  pushTest: () => request<{ ok: boolean }>("/api/push/test", { method: "POST", body: JSON.stringify({}) }),
  login: (password: string) =>
    request<{ ok: boolean }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  me: () => request<{ ok: boolean }>("/api/admin/me"),
  adminEvent: () =>
    request<{ event: AdminEvent | null; prizes: Prize[]; stats: AdminStats | null }>("/api/admin/event"),
  saveEvent: (body: Record<string, unknown>) =>
    request<{ event: AdminEvent }>("/api/admin/event", { method: "PUT", body: JSON.stringify(body) }),
  createEvent: (body: Record<string, unknown>) =>
    request<{ event: AdminEvent }>("/api/admin/event", { method: "POST", body: JSON.stringify(body) }),
  setStatus: (status: string) =>
    request<{ event: AdminEvent }>("/api/admin/event/status", {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  orders: () => request<{ orders: AdminOrder[] }>("/api/admin/orders"),
  markPaid: (id: string) =>
    request<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(id)}/paid`, { method: "POST" }),
  cancelOrder: (id: string) =>
    request<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  draw: () => request<{ awarded: number; prizes: number; unpaidOrders: number }>("/api/admin/draw", { method: "POST" }),
  winners: () => request<{ event: AdminEvent | null; winners: Winner[] }>("/api/admin/winners"),
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

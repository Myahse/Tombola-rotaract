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
  const response = await fetch(path, {
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
  results: () =>
    request<{ event: { titleFr: string; titleEn: string; status: string } | null; winners: Winner[] }>(
      "/api/event/current/results",
    ),
  buy: (body: { quantity: number; phone?: string }) =>
    request<OrderView>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  order: (token: string) => request<OrderView>(`/api/orders/${token}`),
  register: (body: { name: string; email: string; phone?: string; password: string }) =>
    request<{ member: Member }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  memberLogin: (body: { email: string; password: string }) =>
    request<{ member: Member }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  memberLogout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  memberMe: () => request<{ member: Member }>("/api/auth/me"),
  myTombolas: () => request<{ tombolas: MemberTombola[] }>("/api/me/tombolas"),
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
    request<{ order: AdminOrder }>(`/api/admin/orders/${id}/paid`, { method: "POST" }),
  cancelOrder: (id: string) =>
    request<{ order: AdminOrder }>(`/api/admin/orders/${id}/cancel`, { method: "POST" }),
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

import { apiUrl } from "./config";
import { ApiError, withRetry } from "./apiError";
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

export { ApiError, withRetry } from "./apiError";
export { errorCopy, isApiError, isRetryableApiError } from "./apiError";

const COLD_START_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithWakeRetry(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < COLD_START_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(apiUrl(path), {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        ...init,
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      return response;
    } catch (err) {
      window.clearTimeout(timer);
      lastError = err;
      if (attempt >= COLD_START_ATTEMPTS - 1) {
        break;
      }
      await sleep(5000 + attempt * 4000);
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError("network_error", 503);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithWakeRetry(path, init);
  } catch {
    throw new ApiError("network_error", 503);
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; retryAfter?: number };
  if (!response.ok) {
    throw new ApiError(data.error ?? "request_failed", response.status, data.retryAfter);
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
    withRetry(() => request<OrderView>("/api/orders", { method: "POST", body: JSON.stringify(body) })),
  order: (token: string) => request<OrderView>(`/api/orders/${encodeURIComponent(token)}`),
  sendPaymentRef: (token: string, paymentRef: string) =>
    request<{ paymentRef: string }>(`/api/orders/${encodeURIComponent(token)}/payment-ref`, {
      method: "POST",
      body: JSON.stringify({ paymentRef }),
    }),
  cancelMyOrder: (token: string) =>
    request<{ ok: boolean }>(`/api/orders/${encodeURIComponent(token)}/cancel`, { method: "POST" }),
  donate: (body: { name: string; email?: string; phone?: string; amount: number; paymentRef: string }) =>
    request<{ id: string; paymentRef: string; status: string }>("/api/donations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
    gender: "female" | "male" | "other";
    acceptTerms: true;
    acceptEmails: true;
  }) =>
    withRetry(() =>
      request<{ member: Member }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    ),
  memberLogin: (body: { email: string; password: string }) =>
    withRetry(() =>
      request<{ member: Member }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    ),
  memberLogout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  memberMe: () => request<{ member: Member }>("/api/auth/me"),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (body: { token: string; password: string }) =>
    request<{ member: Member }>("/api/auth/reset", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (token: string) =>
    request<{ member: Member }>("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerifyEmail: () => request<{ ok: boolean; already?: boolean }>("/api/auth/verify/resend", { method: "POST" }),
  updateProfile: (body: {
    name: string;
    phone: string;
    avatarUrl?: string;
    clubName?: string;
    clubRole?: string;
    gender?: "female" | "male" | "other";
    currentPassword?: string;
    password?: string;
  }) => request<{ member: Member }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  shareTickets: (token: string, body: { email: string; numbers?: number[] }) =>
    request<{ ok: boolean; remaining: boolean; token: string | null }>(
      `/api/orders/${encodeURIComponent(token)}/share`,
      { method: "POST", body: JSON.stringify(body) },
    ),
    myTombolas: () => request<{ tombolas: MemberTombola[] }>("/api/me/tombolas"),
  cancelReserved: (eventId: string, quantity: number) =>
    request<{ ok: boolean; cancelled: number }>(`/api/me/events/${encodeURIComponent(eventId)}/cancel-reserved`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }),
  pushKey: () => request<{ publicKey: string | null }>("/api/push/key"),
  pushStatus: (endpoint?: string) =>
    request<{ configured: boolean; subscribed: boolean }>(
      endpoint ? `/api/push/status?endpoint=${encodeURIComponent(endpoint)}` : "/api/push/status",
    ),
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

export function eventCanBuy(event: PublicEvent | null | undefined) {
  return Boolean(event && event.status === "on_sale" && event.salesOpen !== false && event.remainingTickets > 0);
}

export function eventPreRegister(event: PublicEvent | null | undefined) {
  return Boolean(event && event.status === "on_sale" && event.salesOpen === false && event.salesOpensAt);
}

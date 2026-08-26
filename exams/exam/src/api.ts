import { apiUrl } from "./config";
import type { Member, QcmState } from "./types";

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
  memberLogin: (body: { email: string; password: string }) =>
    request<{ member: Member }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  memberLogout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  memberMe: () => request<{ member: Member }>("/api/auth/me"),
  qcm: (slug: string, invite?: string) => {
    const query = invite ? `?invite=${encodeURIComponent(invite)}` : "";
    return request<QcmState>(`/api/qcm/${encodeURIComponent(slug)}${query}`);
  },
  startQcm: (slug: string, invite?: string) =>
    request<QcmState>(`/api/qcm/${encodeURIComponent(slug)}/start`, {
      method: "POST",
      body: JSON.stringify(invite ? { invite } : {}),
    }),
  answerQcm: (slug: string, body: { choiceId?: string; timedOut?: boolean }) =>
    request<QcmState>(`/api/qcm/${encodeURIComponent(slug)}/answer`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function localized<T extends Record<string, unknown>>(item: T, lang: string, field: string) {
  const key = `${field}${lang === "en" ? "En" : "Fr"}` as keyof T;
  return String(item[key] ?? "");
}

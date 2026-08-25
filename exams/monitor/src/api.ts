import { apiUrl } from "./config";
import type { QcmAdminState } from "./types";

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
  login: (body: { email: string; password: string }) =>
    request<{ ok: boolean }>("/api/admin/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  me: () => request<{ ok: boolean }>("/api/admin/me"),
  qcm: () => request<QcmAdminState>("/api/admin/qcm"),
  saveQcm: (body: {
    titleFr: string;
    titleEn?: string;
    passScore: number;
    questions: Array<{
      promptFr: string;
      promptEn?: string;
      choices: Array<{ textFr: string; textEn?: string }>;
      correctIndex: number;
    }>;
  }) => request<QcmAdminState>("/api/admin/qcm", { method: "PUT", body: JSON.stringify(body) }),
  setQcmStatus: (status: "open" | "closed") =>
    request<QcmAdminState>("/api/admin/qcm/status", { method: "POST", body: JSON.stringify({ status }) }),
  sendQcmScores: () => request<QcmAdminState>("/api/admin/qcm/send-scores", { method: "POST", body: JSON.stringify({}) }),
};

export function localized<T extends Record<string, unknown>>(item: T, lang: string, field: string) {
  const key = `${field}${lang === "en" ? "En" : "Fr"}` as keyof T;
  return String(item[key] ?? "");
}

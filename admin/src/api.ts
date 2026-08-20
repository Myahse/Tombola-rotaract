import { apiUrl } from "./config";

export type ClubRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  publicUrl: string;
  organizerUrl: string;
  organizerEmails: string;
};

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
    throw new Error(data.error ?? (response.status === 502 ? "api_down" : "request_failed"));
  }
  return data;
}

export const api = {
  login: (password: string) =>
    request<{ ok: boolean }>("/api/platform/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/api/platform/logout", { method: "POST" }),
  me: () => request<{ ok: boolean }>("/api/platform/me"),
  clubs: () => request<{ clubs: ClubRow[] }>("/api/platform/clubs"),
  createClub: (body: {
    slug: string;
    name: string;
    organizerEmail: string;
    organizerPassword: string;
  }) => request<{ club: ClubRow }>("/api/platform/clubs", { method: "POST", body: JSON.stringify(body) }),
  patchClub: (id: string, body: { status?: string; organizerPassword?: string }) =>
    request<{ club: ClubRow }>(`/api/platform/clubs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

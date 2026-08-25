export function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

export function memberSiteUrl(path = "") {
  const base = (import.meta.env.VITE_PUBLIC_SITE ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path}`;
}

export function websocketUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

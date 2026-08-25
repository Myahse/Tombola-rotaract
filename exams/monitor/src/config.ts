export function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

export function websocketUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

export function examSiteUrl() {
  const fromEnv = (import.meta.env.VITE_EXAM_SITE ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:5177";
  return "https://examen.rotaractiugb.com";
}


const isProd = process.env.NODE_ENV === "production";

const origins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const extraHosts = new Set([
  "rotaract-tombola.vercel.app",
  "rotaract-organisateurs.vercel.app",
  "rotaract-campagnes.vercel.app",
  "rotaract-examen.vercel.app",
  "rotaract-surveillance.vercel.app",
]);

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (origins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (extraHosts.has(url.hostname)) return true;
    if (!isProd && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
  } catch {
    return false;
  }
  return false;
}

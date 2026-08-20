import { clubHostSet, platformDomain } from "./club.js";

const isProd = process.env.NODE_ENV === "production";

const origins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const vercelPreviewHosts = new Set([
  "rotaract-tombola.vercel.app",
  "rotaract-organisateurs.vercel.app",
  "rotaract-campagnes.vercel.app",
]);

let extraHosts = new Set<string>();

export async function refreshAllowedHosts() {
  extraHosts = await clubHostSet();
}

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (origins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.hostname === "rotaractiugb.com" || url.hostname.endsWith(".rotaractiugb.com")) return true;
    if (vercelPreviewHosts.has(url.hostname)) return true;
    const platform = platformDomain();
    if (platform && (url.hostname === platform || url.hostname.endsWith(`.${platform}`))) return true;
    if (extraHosts.has(url.hostname)) return true;
    if (!isProd && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
  } catch {
    return false;
  }
  return false;
}

const INK = "#141416";
const MUTED = "#73737a";
const LINE = "#ececee";
const BG = "#fafafa";

export function logoUrl() {
  return siteUrl("/logo.png");
}

export function campaignImageUrl(id: string) {
  return apiPublicUrl(`/api/campaign-images/${encodeURIComponent(id)}`);
}

export function wrapEmail(options: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta = options.ctaLabel && options.ctaUrl
    ? `<tr>
        <td style="padding:0 32px 8px;">
          <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:8px;">${escapeHtml(options.ctaLabel)}</a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${INK};font-family:Manrope,'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 32px 18px;border-bottom:1px solid ${LINE};">
              <img src="${escapeHtml(logoUrl())}" alt="Rotaract IUGB Club" width="220" style="display:block;margin:0 auto;width:220px;max-width:86%;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;font-weight:650;color:#be034d;">Rotaract IUGB Club</p>
              <h1 style="margin:0;font-size:24px;line-height:1.25;letter-spacing:-0.02em;font-weight:650;">${escapeHtml(options.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 24px;color:${MUTED};font-size:15px;line-height:1.6;">
              ${options.bodyHtml}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:20px 32px 28px;color:#a1a1a8;font-size:12px;line-height:1.5;border-top:1px solid ${LINE};">
              Rotaract IUGB Club · Côte d’Ivoire<br />
              On se retrouve au club, et à la prochaine tombola.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function firstName(full: string) {
  const part = full.trim().split(/\s+/)[0] ?? "";
  if (!part) return "ami(e) du club";
  return part
    .split("-")
    .map((piece) => (piece ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece))
    .join("-");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function siteUrl(path = "") {
  return publicOrigin(path, {
    env: process.env.PUBLIC_SITE_URL,
    production: "https://tombola.rotaractiugb.com",
    local: "http://localhost:5173",
    allowed: (host) =>
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "rotaractiugb.com" ||
      host.endsWith(".rotaractiugb.com"),
  });
}

export function apiPublicUrl(path = "") {
  return publicOrigin(path, {
    env: process.env.PUBLIC_API_URL,
    production: "https://api.rotaractiugb.com",
    local: "http://localhost:3001",
    allowed: (host) =>
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "api.rotaractiugb.com" ||
      host === "tombola-rotaract.onrender.com",
  });
}

function publicOrigin(
  path: string,
  options: {
    env: string | undefined;
    production: string;
    local: string;
    allowed: (host: string) => boolean;
  },
) {
  const fallback = process.env.NODE_ENV === "production" ? options.production : options.local;
  let base = (options.env ?? fallback).trim().replace(/\/$/, "");
  try {
    const parsed = new URL(base);
    if (!options.allowed(parsed.hostname) || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) {
      base = fallback;
    } else {
      base = parsed.origin;
    }
  } catch {
    base = fallback;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

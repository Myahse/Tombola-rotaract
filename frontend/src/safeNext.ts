const LANG = /^(fr|en)$/;

export function safeNextPath(raw: string | null | undefined, lang: string | undefined) {
  const fallback = `/${lang && LANG.test(lang) ? lang : "fr"}/account`;
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    const url = new URL(raw, "https://tombola.local");
    if (url.username || url.password || url.host !== "tombola.local") return fallback;
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (!first || !LANG.test(first)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

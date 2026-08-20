export function inferredClubSlug() {
  try {
    const stored = sessionStorage.getItem("tombola_club_slug");
    if (stored?.trim()) return stored.trim().toLowerCase();
  } catch {
    // ignore
  }
  const env = (import.meta.env.VITE_CLUB_SLUG as string | undefined)?.trim().toLowerCase();
  if (env) return env;
  const host = window.location.hostname.toLowerCase();
  const platform = (import.meta.env.VITE_PLATFORM_DOMAIN as string | undefined)?.trim().toLowerCase();
  if (platform && host.endsWith(`.${platform}`)) {
    const slug = host.slice(0, -(platform.length + 1));
    if (slug && !["org", "mail", "api", "www", "app"].includes(slug)) return slug;
  }
  return "rotaract-iugb";
}

export function rememberClubSlug(slug: string) {
  try {
    sessionStorage.setItem("tombola_club_slug", slug.trim().toLowerCase());
  } catch {
    // ignore
  }
}

export function inferredClubSlug() {
  try {
    const stored = sessionStorage.getItem("tombola_club_slug");
    if (stored?.trim()) return stored.trim().toLowerCase();
  } catch {
    // ignore
  }
  const env = (import.meta.env.VITE_CLUB_SLUG as string | undefined)?.trim().toLowerCase();
  if (env) return env;
  return "rotaract-iugb";
}

export function rememberClubSlug(slug: string) {
  try {
    sessionStorage.setItem("tombola_club_slug", slug.trim().toLowerCase());
  } catch {
    // ignore
  }
}

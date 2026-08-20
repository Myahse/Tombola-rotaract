const STORAGE_KEY = "tombola.organizer.eventId";

let currentEventId: string | null = null;

export function getOrganizerEventId() {
  if (currentEventId) return currentEventId;
  if (typeof sessionStorage === "undefined") return null;
  currentEventId = sessionStorage.getItem(STORAGE_KEY);
  return currentEventId;
}

export function setOrganizerEventId(id: string | null) {
  currentEventId = id;
  if (typeof sessionStorage === "undefined") return;
  if (id) sessionStorage.setItem(STORAGE_KEY, id);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function withEventId(path: string) {
  const id = getOrganizerEventId();
  if (!id) return path;
  return `${path}${path.includes("?") ? "&" : "?"}eventId=${encodeURIComponent(id)}`;
}

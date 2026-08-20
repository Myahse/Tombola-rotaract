import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { getOrganizerEventId, setOrganizerEventId } from "./organizerEvent";
import type { AdminEventSummary } from "./types";

type EventContextValue = {
  eventId: string | null;
  events: AdminEventSummary[];
  setEventId: (id: string | null) => void;
  refreshEvents: () => Promise<void>;
};

const EventContext = createContext<EventContextValue | null>(null);

export function OrganizerEventProvider({ children }: { children: ReactNode }) {
  const [eventId, setEventIdState] = useState<string | null>(() => getOrganizerEventId());
  const [events, setEvents] = useState<AdminEventSummary[]>([]);

  const setEventId = useCallback((id: string | null) => {
    setOrganizerEventId(id);
    setEventIdState(id);
  }, []);

  const refreshEvents = useCallback(async () => {
    const data = await api.adminEvents();
    setEvents(data.events);
    const stored = getOrganizerEventId();
    if (stored && data.events.some((item) => item.id === stored)) return;
    const preferred =
      data.events.find((item) => item.status === "on_sale") ??
      data.events.find((item) => item.status === "closed" || item.status === "draft") ??
      data.events[0];
    setEventId(preferred?.id ?? null);
  }, [setEventId]);

  useEffect(() => {
    void refreshEvents().catch(() => undefined);
  }, [refreshEvents]);

  const value = useMemo(
    () => ({ eventId, events, setEventId, refreshEvents }),
    [eventId, events, setEventId, refreshEvents],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useOrganizerEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useOrganizerEvent must be used within OrganizerEventProvider");
  return ctx;
}

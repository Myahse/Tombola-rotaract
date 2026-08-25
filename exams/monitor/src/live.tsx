import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimeMessage } from "./protocol";
import { useRealtime } from "./useRealtime";
import { MonitorCallProvider, RealtimeBusProvider } from "./call";

const LiveTick = createContext(0);
const LiveStatus = createContext(false);
const AwayIds = createContext<Set<string>>(new Set());

export function LiveProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const [awayIds, setAwayIds] = useState<Set<string>>(() => new Set());
  const listeners = useRef(new Set<(message: RealtimeMessage) => void>());
  const { connected, send } = useRealtime("monitor", (message) => {
    if (message.type === "qcm.changed") setTick((value) => value + 1);
    if (message.type === "qcm.presence" && message.memberId) {
      const id = message.memberId;
      const away = message.away;
      setAwayIds((current) => {
        const next = new Set(current);
        if (away) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    if (message.type.startsWith("qcm.call.")) {
      listeners.current.forEach((fn) => fn(message));
    }
  });
  const bus = useMemo(
    () => ({
      connected,
      send,
      subscribe(fn: (message: RealtimeMessage) => void) {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
    }),
    [connected, send],
  );

  return (
    <LiveStatus.Provider value={connected}>
      <LiveTick.Provider value={tick}>
        <AwayIds.Provider value={awayIds}>
          <RealtimeBusProvider value={bus}>
            <MonitorCallProvider>{children}</MonitorCallProvider>
          </RealtimeBusProvider>
        </AwayIds.Provider>
      </LiveTick.Provider>
    </LiveStatus.Provider>
  );
}

export function useLiveTick() {
  return useContext(LiveTick);
}

export function useLiveStatus() {
  return useContext(LiveStatus);
}

export function useAwayIds() {
  return useContext(AwayIds);
}

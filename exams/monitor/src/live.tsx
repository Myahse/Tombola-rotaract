import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimeMessage } from "./protocol";
import { useRealtime } from "./useRealtime";
import { MonitorCallProvider, RealtimeBusProvider } from "./call";

const LiveTick = createContext(0);
const LiveStatus = createContext(false);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const listeners = useRef(new Set<(message: RealtimeMessage) => void>());
  const { connected, send } = useRealtime("monitor", (message) => {
    if (message.type === "qcm.changed") setTick((value) => value + 1);
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
        <RealtimeBusProvider value={bus}>
          <MonitorCallProvider>{children}</MonitorCallProvider>
        </RealtimeBusProvider>
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

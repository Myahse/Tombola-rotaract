import { createContext, useContext, useState, type ReactNode } from "react";
import { useRealtime } from "./useRealtime";

const LiveTick = createContext(0);
const LiveStatus = createContext(false);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const connected = useRealtime("organizer", (message) => {
    if (
      message.type === "organizer.changed" ||
      message.type === "public.snapshot" ||
      message.type === "draw.done"
    ) {
      setTick((value) => value + 1);
    }
  });
  return (
    <LiveStatus.Provider value={connected}>
      <LiveTick.Provider value={tick}>{children}</LiveTick.Provider>
    </LiveStatus.Provider>
  );
}

export function useLiveTick() {
  return useContext(LiveTick);
}

export function useLiveStatus() {
  return useContext(LiveStatus);
}

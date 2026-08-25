import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type StayState = {
  locked: boolean;
  setLocked: (locked: boolean) => void;
};

const StayCtx = createContext<StayState | null>(null);

export function StayProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const value = useMemo(() => ({ locked, setLocked }), [locked]);
  return <StayCtx.Provider value={value}>{children}</StayCtx.Provider>;
}

export function useStay() {
  const ctx = useContext(StayCtx);
  if (!ctx) throw new Error("useStay must be used within StayProvider");
  return ctx;
}

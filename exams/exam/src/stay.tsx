import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type AwayReporter = (away: boolean) => void;

type StayState = {
  locked: boolean;
  setLocked: (locked: boolean) => void;
  reportAway: AwayReporter;
  setAwayReporter: (fn: AwayReporter | null) => void;
};

const StayCtx = createContext<StayState | null>(null);

export function enterExamFullscreen() {
  const node = document.documentElement;
  if (document.fullscreenElement) return;
  void node.requestFullscreen?.().catch(() => undefined);
}

export function StayProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const reporter = useRef<AwayReporter>(() => undefined);
  const reportAway = useCallback<AwayReporter>((away) => {
    reporter.current(away);
  }, []);
  const setAwayReporter = useCallback((fn: AwayReporter | null) => {
    reporter.current = fn ?? (() => undefined);
  }, []);
  const value = useMemo(
    () => ({ locked, setLocked, reportAway, setAwayReporter }),
    [locked, reportAway, setAwayReporter],
  );
  return <StayCtx.Provider value={value}>{children}</StayCtx.Provider>;
}

export function useStay() {
  const ctx = useContext(StayCtx);
  if (!ctx) throw new Error("useStay must be used within StayProvider");
  return ctx;
}

export function ExamGuard() {
  const { locked, reportAway } = useStay();
  const { t } = useTranslation();
  const [away, setAway] = useState(false);

  useEffect(() => {
    if (!locked) {
      setAway(false);
      reportAway(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }

    enterExamFullscreen();
    let timer: number | undefined;
    const setHidden = (hidden: boolean) => {
      window.clearTimeout(timer);
      if (!hidden) {
        setAway(false);
        reportAway(false);
        return;
      }
      timer = window.setTimeout(() => {
        setAway(true);
        reportAway(true);
      }, 350);
    };
    const sync = () => {
      setHidden(document.hidden || !document.hasFocus() || !document.fullscreenElement);
    };
    const blockMenu = (event: Event) => event.preventDefault();
    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" || (event.altKey && event.key === "Tab") || (event.ctrlKey && event.key === "w")) {
        event.preventDefault();
      }
    };

    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("contextmenu", blockMenu);
    window.addEventListener("keydown", blockKeys);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("contextmenu", blockMenu);
      window.removeEventListener("keydown", blockKeys);
    };
  }, [locked, reportAway]);

  if (!locked || !away) return null;
  return (
    <div className="exam-lockout" role="alertdialog">
      <p className="exam-lockout-title">{t("qcm.awayTitle")}</p>
      <p>{t("qcm.awayLead")}</p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          enterExamFullscreen();
          window.focus();
          setAway(false);
          reportAway(false);
        }}
      >
        {t("qcm.awayBack")}
      </button>
    </div>
  );
}

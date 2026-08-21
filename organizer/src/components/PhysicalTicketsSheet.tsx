import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ModalPortal } from "./ModalPortal";

const CLOSE_MS = 320;

export function PhysicalTicketsSheet({
  title,
  help,
  children,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  help: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"open" | "closing">("open");

  const requestClose = useCallback(() => {
    if (busy || phase === "closing") return;
    setPhase("closing");
  }, [busy, phase]);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(onClose, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    try {
      await onConfirm();
      requestClose();
    } catch {
      // Parent keeps sheet open on error.
    }
  }

  return (
    <ModalPortal>
      <div
        className={`modal-backdrop sheet-backdrop ${phase === "open" ? "is-open" : "is-closing"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="physical-tickets-title"
        onClick={requestClose}
      >
        <div
          className={`modal-card cancel-sheet ${phase === "open" ? "is-open" : "is-closing"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-handle" aria-hidden />
          <h1 id="physical-tickets-title">{title}</h1>
          <p className="modal-lead">{help}</p>
          <form className="sheet-form" onSubmit={(e) => void handleSubmit(e)}>
            {children}
            <div className="modal-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={requestClose}>
                {cancelLabel}
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? <span className="btn-spinner" aria-hidden /> : null}
                {confirmLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

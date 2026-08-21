import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ModalPortal } from "./ModalPortal";

const CLOSE_MS = 320;

export function WaveRefSheet({
  title,
  help,
  value,
  placeholder,
  confirmLabel,
  cancelLabel,
  busy = false,
  error = "",
  onChange,
  onConfirm,
  onClose,
}: {
  title: string;
  help: string;
  value: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  error?: string;
  onChange: (value: string) => void;
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
    if (busy || !value.trim()) return;
    try {
      await onConfirm();
      requestClose();
    } catch {
      // Parent sets error; keep sheet open.
    }
  }

  return (
    <ModalPortal>
      <div
        className={`modal-backdrop sheet-backdrop ${phase === "open" ? "is-open" : "is-closing"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wave-ref-title"
        onClick={requestClose}
      >
        <div
          className={`modal-card cancel-sheet ${phase === "open" ? "is-open" : "is-closing"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-handle" aria-hidden />
          <h1 id="wave-ref-title">{title}</h1>
          <p className="modal-lead">{help}</p>
          <form className="sheet-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="sheet-input-field">
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                autoFocus
                required
                minLength={4}
                maxLength={80}
                disabled={busy}
                aria-labelledby="wave-ref-title"
              />
            </label>
            {error ? (
              <p key={error} className="text-sm text-ticket modal-error">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={requestClose}>
                {cancelLabel}
              </button>
              <button type="submit" className="btn-primary" disabled={busy || value.trim().length < 4}>
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

import { useCallback, useEffect, useState } from "react";
import { ModalPortal } from "./ModalPortal";

const CLOSE_MS = 320;

export function CancelReservedModal({
  title,
  body,
  quantity,
  max,
  confirmLabel,
  cancelLabel,
  quantityLabel,
  busy = false,
  error = "",
  onQuantityChange,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  quantity: number;
  max: number;
  confirmLabel: string;
  cancelLabel: string;
  quantityLabel: string;
  busy?: boolean;
  error?: string;
  onQuantityChange: (value: number) => void;
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

  function setQuantity(next: number) {
    onQuantityChange(Math.min(max, Math.max(1, next)));
  }

  async function handleConfirm() {
    if (busy) return;
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
        aria-labelledby="cancel-reserved-title"
        onClick={requestClose}
      >
        <div
          className={`modal-card cancel-sheet ${phase === "open" ? "is-open" : "is-closing"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-handle" aria-hidden />
          <h1 id="cancel-reserved-title">{title}</h1>
          <p className="modal-lead">{body}</p>
          <label className="cancel-qty-field">
            {quantityLabel}
            <div className="cancel-qty-row">
              <button
                type="button"
                className="btn-outline cancel-qty-btn"
                disabled={busy || quantity <= 1}
                aria-label="-"
                onClick={() => setQuantity(quantity - 1)}
              >
                −
              </button>
              <output className="cancel-qty-value-wrap" aria-live="polite">
                <span key={quantity} className="cancel-qty-value">
                  {quantity}
                </span>
                <span className="cancel-qty-max">/ {max}</span>
              </output>
              <button
                type="button"
                className="btn-outline cancel-qty-btn"
                disabled={busy || quantity >= max}
                aria-label="+"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
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
            <button type="button" className="btn-danger" disabled={busy} onClick={() => void handleConfirm()}>
              {busy ? <span className="btn-spinner" aria-hidden /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ModalPortal } from "./ModalPortal";

const CLOSE_MS = 320;

export function DonateRefSheet({
  title,
  help,
  name,
  email,
  amount,
  paymentRef,
  nameLabel,
  emailLabel,
  amountLabel,
  refLabel,
  refPlaceholder,
  confirmLabel,
  cancelLabel,
  busy = false,
  error = "",
  onNameChange,
  onEmailChange,
  onAmountChange,
  onPaymentRefChange,
  onConfirm,
  onClose,
}: {
  title: string;
  help: string;
  name: string;
  email: string;
  amount: string;
  paymentRef: string;
  nameLabel: string;
  emailLabel: string;
  amountLabel: string;
  refLabel: string;
  refPlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  error?: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentRefChange: (value: string) => void;
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
      // Parent sets error; keep sheet open.
    }
  }

  return (
    <ModalPortal>
      <div
        className={`modal-backdrop sheet-backdrop ${phase === "open" ? "is-open" : "is-closing"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-ref-title"
        onClick={requestClose}
      >
        <div
          className={`modal-card cancel-sheet ${phase === "open" ? "is-open" : "is-closing"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-handle" aria-hidden />
          <h1 id="donate-ref-title">{title}</h1>
          <p className="modal-lead">{help}</p>
          <form className="sheet-form" onSubmit={(e) => void handleSubmit(e)}>
            <label>
              {nameLabel}
              <input value={name} onChange={(e) => onNameChange(e.target.value)} required minLength={2} disabled={busy} />
            </label>
            <label>
              {emailLabel}
              <input
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                type="email"
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <label>
              {amountLabel}
              <input
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                type="number"
                min={100}
                step={100}
                required
                disabled={busy}
              />
            </label>
            <label>
              {refLabel}
              <input
                value={paymentRef}
                onChange={(e) => onPaymentRefChange(e.target.value)}
                placeholder={refPlaceholder}
                required
                minLength={4}
                maxLength={80}
                autoComplete="off"
                disabled={busy}
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

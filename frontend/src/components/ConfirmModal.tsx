import { useEffect } from "react";

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="modal-backdrop is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h1 id="confirm-title">{title}</h1>
        <p className="modal-lead">{body}</p>
        <div className="modal-actions">
          <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

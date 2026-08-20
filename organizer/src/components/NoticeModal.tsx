import { useEffect } from "react";

export function NoticeModal({
  title,
  body,
  okLabel,
  onClose,
}: {
  title: string;
  body: string;
  okLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="notice-title" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h1 id="notice-title">{title}</h1>
        <p className="modal-lead">{body}</p>
        <div className="modal-actions single">
          <button type="button" className="btn-primary" onClick={onClose}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

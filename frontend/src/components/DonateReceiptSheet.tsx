import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ModalPortal } from "./ModalPortal";
import { prepareReceiptFile } from "../lib/receiptUpload";

const CLOSE_MS = 320;

export function DonateReceiptSheet({
  title,
  help,
  name,
  email,
  amount,
  nameLabel,
  emailLabel,
  amountLabel,
  confirmLabel,
  cancelLabel,
  busy = false,
  error = "",
  onNameChange,
  onEmailChange,
  onAmountChange,
  onConfirm,
  onClose,
}: {
  title: string;
  help: string;
  name: string;
  email: string;
  amount: string;
  nameLabel: string;
  emailLabel: string;
  amountLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  error?: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onConfirm: (file: File) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"open" | "closing">("open");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [localError, setLocalError] = useState("");

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

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl("");
  }, [file]);

  async function onPick(next: File | undefined) {
    if (!next) {
      setFile(null);
      setLocalError("");
      return;
    }
    try {
      await prepareReceiptFile(next);
      setFile(next);
      setLocalError("");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setFile(null);
      setLocalError(
        code === "too_large"
          ? t("receiptUpload.tooLarge")
          : t("receiptUpload.invalidType"),
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file) return;
    try {
      await onConfirm(file);
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
        aria-labelledby="donate-receipt-title"
        onClick={requestClose}
      >
        <div
          className={`modal-card cancel-sheet ${phase === "open" ? "is-open" : "is-closing"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-handle" aria-hidden />
          <h1 id="donate-receipt-title">{title}</h1>
          <p className="modal-lead">{help}</p>
          <form className="sheet-form" onSubmit={(event) => void handleSubmit(event)}>
            <label>
              {nameLabel}
              <input value={name} onChange={(event) => onNameChange(event.target.value)} required minLength={2} disabled={busy} />
            </label>
            <label>
              {emailLabel}
              <input
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                type="email"
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <label>
              {amountLabel}
              <input
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                type="number"
                min={100}
                step={100}
                required
                disabled={busy}
              />
            </label>
            <label className="receipt-picker">
              <span>{t("receiptUpload.fileLabel")}</span>
              <span className="receipt-picker-box">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                  capture="environment"
                  disabled={busy}
                  onChange={(event) => void onPick(event.target.files?.[0])}
                />
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="receipt-preview" />
                ) : file ? (
                  <span className="receipt-file-name">{file.name}</span>
                ) : (
                  <span className="receipt-picker-hint">{t("receiptUpload.pickHint")}</span>
                )}
              </span>
            </label>
            {localError || error ? (
              <p className="text-sm text-ticket modal-error">{localError || error}</p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={requestClose}>
                {cancelLabel}
              </button>
              <button type="submit" className="btn-primary" disabled={busy || !file}>
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

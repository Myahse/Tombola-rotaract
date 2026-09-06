import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export function ReceiptLink({ receiptKey }: { receiptKey: string | null | undefined }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  if (!receiptKey) {
    return <span>{t("admin.receiptWaiting")}</span>;
  }

  async function openReceipt() {
    setBusy(true);
    try {
      const { url } = await api.receiptUrl(receiptKey!);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-ghost receipt-link" disabled={busy} onClick={() => void openReceipt()}>
      {busy ? t("admin.receiptOpening") : t("admin.receiptView")}
    </button>
  );
}

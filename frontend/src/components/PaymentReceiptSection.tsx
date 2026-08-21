import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReceiptData, ReceiptLabels } from "../lib/receipt";
import { receiptFilename } from "../lib/receipt";
import { exportReceiptPdf, exportReceiptPng } from "../lib/exportReceipt";
import { PaymentReceiptCard } from "./PaymentReceiptCard";

type PaymentReceiptSectionProps = {
  data: ReceiptData;
  labels: ReceiptLabels;
  buyerHeading: string;
};

export function PaymentReceiptSection({ data, labels, buyerHeading }: PaymentReceiptSectionProps) {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState("");

  async function onExport(kind: "png" | "pdf") {
    const node = receiptRef.current;
    if (!node) return;
    setBusy(kind);
    setError("");
    try {
      const filename = receiptFilename(data.filenameBase, kind);
      if (kind === "png") await exportReceiptPng(node, filename);
      else await exportReceiptPdf(node, filename);
    } catch {
      setError(t("receipt.exportFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="section receipt-section">
      <div className="receipt-section-head">
        <div>
          <h2>{t("receipt.title")}</h2>
          <p className="lede">{t("receipt.lead")}</p>
        </div>
        <div className="export-actions">
          <button type="button" className="btn-outline" disabled={Boolean(busy)} onClick={() => void onExport("png")}>
            {busy === "png" ? t("receipt.exporting") : t("receipt.exportPng")}
          </button>
          <button type="button" className="btn-outline" disabled={Boolean(busy)} onClick={() => void onExport("pdf")}>
            {busy === "pdf" ? t("receipt.exporting") : t("receipt.exportPdf")}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-ticket">{error}</p> : null}
      <PaymentReceiptCard ref={receiptRef} data={data} labels={labels} buyerHeading={buyerHeading} />
    </section>
  );
}

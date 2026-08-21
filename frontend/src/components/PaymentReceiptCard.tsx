import { forwardRef } from "react";
import type { ReceiptData, ReceiptLabels } from "../lib/receipt";

type PaymentReceiptCardProps = {
  data: ReceiptData;
  labels: ReceiptLabels;
  buyerHeading: string;
};

export const PaymentReceiptCard = forwardRef<HTMLElement, PaymentReceiptCardProps>(function PaymentReceiptCard(
  { data, labels, buyerHeading },
  ref,
) {
  const rows = [
    { label: labels.tombola, value: data.eventTitle },
    { label: labels.confirmedOn, value: data.paidOnFormatted },
    { label: labels.payment, value: data.paymentLabel },
    ...(data.paymentRef ? [{ label: labels.waveId, value: data.paymentRef, highlight: false }] : []),
    { label: labels.buyer, value: data.buyerName, highlight: false },
    { label: labels.numbers, value: `n° ${data.numbers.join(", ")}`, highlight: true },
    { label: labels.totalPaid, value: `${data.qtyLine} · ${data.totalFormatted}`, highlight: true },
  ];

  return (
    <article ref={ref} className="payment-receipt" aria-label={labels.heading}>
      <div className="payment-receipt-brand">
        <img src="/logo.png" alt="Rotaract IUGB Club" width={220} height={84} />
      </div>
      <p className="payment-receipt-kicker">{labels.kicker}</p>
      <h2 className="payment-receipt-title">{buyerHeading}</h2>
      <p className="payment-receipt-intro">{labels.intro.replace("{{event}}", data.eventTitle)}</p>
      <dl className="payment-receipt-rows">
        {rows.map((row) => (
          <div key={row.label} className={row.highlight ? "is-highlight" : undefined}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="payment-receipt-hint">{data.drawHint}</p>
      <p className="payment-receipt-en">
        <strong>{labels.english} :</strong>
        {data.englishSummary}
      </p>
    </article>
  );
});

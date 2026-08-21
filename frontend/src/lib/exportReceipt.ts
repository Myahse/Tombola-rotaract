async function captureReceipt(element: HTMLElement) {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportReceiptPng(element: HTMLElement, filename: string) {
  const canvas = await captureReceipt(element);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("export_failed");
  downloadBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
}

export async function exportReceiptPdf(element: HTMLElement, filename: string) {
  const canvas = await captureReceipt(element);
  const { jsPDF } = await import("jspdf");
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const maxWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * maxWidth) / canvas.width;
  const y = imgHeight > pageHeight - margin * 2 ? margin : Math.max(margin, (pageHeight - imgHeight) / 2);
  pdf.addImage(img, "PNG", margin, y, maxWidth, imgHeight);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function slugFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function exportTableExcel(headers: string[], rows: string[][], filename: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Export");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

export async function exportTablePdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: string[][],
  filename: string,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 22);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: [190, 3, 77], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function formatExportDate(iso: string | null | undefined, lang: string) {
  if (!iso) return "—";
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function exportFilename(kind: string, title: string, ext: "pdf" | "xlsx") {
  const stamp = new Date().toISOString().slice(0, 10);
  return `tombola-${kind}-${slugFilename(title) || kind}-${stamp}.${ext}`;
}

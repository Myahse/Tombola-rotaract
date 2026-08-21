const MAX_PDF_BYTES = 3 * 1024 * 1024;

export async function readPdfAttachment(file: File) {
  const pdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!pdf || file.size > MAX_PDF_BYTES) return null;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match?.[1]) return null;

  return {
    filename: file.name,
    mimeType: "application/pdf",
    content: match[1],
    inline: false,
  };
}

import { api } from "../api";

export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.pdf";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PreparedReceipt = {
  blob: Blob;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  filename: string;
  size: number;
};

function extensionForMime(mimeType: PreparedReceipt["mimeType"]) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "jpg";
}

async function compressImage(file: File): Promise<PreparedReceipt> {
  const image = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalid_type");
  ctx.drawImage(image, 0, 0, width, height);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("invalid_type");
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("too_large");
  const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
  return {
    blob,
    mimeType: "image/jpeg",
    filename: `${base}.jpg`,
    size: blob.size,
  };
}

export async function prepareReceiptFile(file: File): Promise<PreparedReceipt> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    if (file.size > MAX_PDF_BYTES) throw new Error("too_large");
    return {
      blob: file,
      mimeType: "application/pdf",
      filename: file.name || "receipt.pdf",
      size: file.size,
    };
  }
  if (!file.type.startsWith("image/")) throw new Error("invalid_type");
  if (file.size > MAX_IMAGE_BYTES && file.type !== "image/jpeg") {
    return compressImage(file);
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error("too_large");
  const mimeType =
    file.type === "image/png" || file.type === "image/webp" || file.type === "image/jpeg"
      ? file.type
      : "image/jpeg";
  const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
  return {
    blob: file,
    mimeType,
    filename: `${base}.${extensionForMime(mimeType)}`,
    size: file.size,
  };
}

export async function uploadReceipt(purpose: "orders" | "donations", file: File) {
  const prepared = await prepareReceiptFile(file);
  const { key, uploadUrl } = await api.presignReceipt({
    purpose,
    mimeType: prepared.mimeType,
    size: prepared.size,
    filename: prepared.filename,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: prepared.blob,
    headers: { "Content-Type": prepared.mimeType },
  });
  if (!response.ok) throw new Error("upload_failed");
  return { key, mimeType: prepared.mimeType, filename: prepared.filename };
}

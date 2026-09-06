import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const RECEIPT_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type ReceiptMime = (typeof RECEIPT_MIMES)[number];

export const RECEIPT_KEY_RE = /^receipts\/(orders|donations)\/[0-9a-f-]{36}\/\d{13}-[a-zA-Z0-9._-]+$/;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim(),
  );
}

export function maxReceiptBytes(mimeType: ReceiptMime) {
  return mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

export function isReceiptMime(value: string): value is ReceiptMime {
  return (RECEIPT_MIMES as readonly string[]).includes(value);
}

export function receiptPurposeFromKey(key: string): "orders" | "donations" | null {
  if (key.startsWith("receipts/orders/")) return "orders";
  if (key.startsWith("receipts/donations/")) return "donations";
  return null;
}

export function isValidReceiptKey(key: string, purpose?: "orders" | "donations") {
  if (!RECEIPT_KEY_RE.test(key)) return false;
  if (!purpose) return true;
  return key.startsWith(`receipts/${purpose}/`);
}

export function createReceiptKey(purpose: "orders" | "donations", filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "receipt";
  return `receipts/${purpose}/${randomUUID()}/${Date.now()}-${safe}`;
}

function client() {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

function bucket() {
  return process.env.R2_BUCKET_NAME!.trim();
}

export async function presignReceiptUpload(key: string, mimeType: ReceiptMime, sizeBytes: number) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });
  return getSignedUrl(client(), command, { expiresIn: 900 });
}

export async function presignReceiptDownload(key: string) {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  });
  return getSignedUrl(client(), command, { expiresIn: 3600 });
}

export async function receiptObjectExists(key: string) {
  try {
    await client().send(
      new HeadObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

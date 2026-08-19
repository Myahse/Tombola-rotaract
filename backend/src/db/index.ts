import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export const client = postgres(url, {
  max: process.env.VERCEL ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });

export async function ensureSchema() {
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url text`);
  await client.unsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'`);
}

export function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

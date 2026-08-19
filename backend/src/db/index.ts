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
  await client.unsafe(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scratched_at timestamptz`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN IF NOT EXISTS draw_mode text NOT NULL DEFAULT 'scratch'`);
  await client.unsafe(`ALTER TABLE prizes ADD COLUMN IF NOT EXISTS ticket_number integer`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS prizes_event_ticket_number_idx ON prizes (event_id, ticket_number) WHERE ticket_number IS NOT NULL`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS emails_accepted_at timestamptz`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS club_name text`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS club_role text`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS password_resets_member_idx ON password_resets (member_id)`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      subject text NOT NULL,
      preheader text NOT NULL DEFAULT '',
      heading text NOT NULL DEFAULT '',
      body text NOT NULL DEFAULT '',
      cta_label text NOT NULL DEFAULT '',
      cta_url text NOT NULL DEFAULT '',
      include_members boolean NOT NULL DEFAULT true,
      include_buyers boolean NOT NULL DEFAULT false,
      opted_in_only boolean NOT NULL DEFAULT true,
      extra_emails text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft',
      sent_count integer NOT NULL DEFAULT 0,
      failed_count integer NOT NULL DEFAULT 0,
      recipient_count integer NOT NULL DEFAULT 0,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS campaign_attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      filename text NOT NULL,
      mime_type text NOT NULL,
      content text NOT NULL,
      inline boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      email text NOT NULL,
      name text NOT NULL DEFAULT '',
      source text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      error text,
      sent_at timestamptz
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx ON campaign_recipients (campaign_id)`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS push_subscriptions_member_idx ON push_subscriptions (member_id)`);
}

export function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

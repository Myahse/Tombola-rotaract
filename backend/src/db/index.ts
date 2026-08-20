import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../lib/passwords.js";
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
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS events_one_on_sale_idx ON events (status) WHERE status = 'on_sale'`);
  await ensureClubs();
}

async function ensureClubs() {
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS clubs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      logo_url text,
      logo_dark_url text,
      primary_color text NOT NULL DEFAULT '#be034d',
      wave_pay_url text NOT NULL DEFAULT '',
      sender_name text NOT NULL DEFAULT '',
      sender_email text,
      public_url text NOT NULL DEFAULT '',
      organizer_url text NOT NULL DEFAULT '',
      campaign_url text NOT NULL DEFAULT '',
      custom_domain text,
      status text NOT NULL DEFAULT 'active',
      organizer_password_hash text NOT NULL DEFAULT '',
      organizer_emails text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.unsafe(`
    INSERT INTO clubs (
      slug, name, wave_pay_url, sender_name,
      public_url, organizer_url, campaign_url, custom_domain
    )
    SELECT
      'rotaract-iugb',
      'Rotaract IUGB Club',
      '',
      'Rotaract IUGB Club',
      'https://tombola.rotaractiugb.com',
      'https://organisateurs.rotaractiugb.com',
      'https://campagnes.rotaractiugb.com',
      'rotaractiugb.com'
    WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE slug = 'rotaract-iugb')
  `);

  const [iugb] = await client<{ id: string }[]>`SELECT id FROM clubs WHERE slug = 'rotaract-iugb' LIMIT 1`;
  if (!iugb?.id) {
    throw new Error("Could not bootstrap default club");
  }
  const clubId = iugb.id;

  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE`);
  await client.unsafe(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE`);
  await client.unsafe(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE`);

  await client`UPDATE members SET club_id = ${clubId} WHERE club_id IS NULL`;
  await client`UPDATE events SET club_id = ${clubId} WHERE club_id IS NULL`;
  await client`UPDATE campaigns SET club_id = ${clubId} WHERE club_id IS NULL`;
  await client.unsafe(`
    UPDATE push_subscriptions AS p
    SET club_id = m.club_id
    FROM members AS m
    WHERE p.member_id = m.id AND p.club_id IS NULL
  `);
  await client`UPDATE push_subscriptions SET club_id = ${clubId} WHERE club_id IS NULL`;

  await client.unsafe(`ALTER TABLE members ALTER COLUMN club_id SET NOT NULL`);
  await client.unsafe(`ALTER TABLE events ALTER COLUMN club_id SET NOT NULL`);
  await client.unsafe(`ALTER TABLE campaigns ALTER COLUMN club_id SET NOT NULL`);
  await client.unsafe(`ALTER TABLE push_subscriptions ALTER COLUMN club_id SET NOT NULL`);

  await client.unsafe(`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_key`);
  await client.unsafe(`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_unique`);
  await client.unsafe(`DROP INDEX IF EXISTS members_email_unique`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS members_club_email_idx ON members (club_id, email)`);

  await client.unsafe(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_slug_key`);
  await client.unsafe(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_slug_unique`);
  await client.unsafe(`DROP INDEX IF EXISTS events_slug_unique`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS events_club_slug_idx ON events (club_id, slug)`);

  await client.unsafe(`ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key`);
  await client.unsafe(`ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_unique`);
  await client.unsafe(`DROP INDEX IF EXISTS push_subscriptions_endpoint_key`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_club_endpoint_idx ON push_subscriptions (club_id, endpoint)`);

  await client.unsafe(`DROP INDEX IF EXISTS events_one_on_sale_idx`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS events_one_on_sale_idx ON events (club_id) WHERE status = 'on_sale'`);

  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const emails = (process.env.ADMIN_EMAIL ?? "").trim();
  const wave = (process.env.WAVE_PAY_URL ?? "").trim();
  const sender = (process.env.BREVO_SENDER_NAME ?? "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL ?? "").trim();
  const [club] = await client<{ organizer_password_hash: string; organizer_emails: string }[]>`
    SELECT organizer_password_hash, organizer_emails FROM clubs WHERE id = ${clubId}
  `;
  if (club && !club.organizer_password_hash && password) {
    const hash = await hashPassword(password);
    await client`UPDATE clubs SET organizer_password_hash = ${hash}, updated_at = now() WHERE id = ${clubId}`;
  }
  if (club && !club.organizer_emails && emails) {
    await client`UPDATE clubs SET organizer_emails = ${emails}, updated_at = now() WHERE id = ${clubId}`;
  }
  if (wave) {
    await client`UPDATE clubs SET wave_pay_url = ${wave}, updated_at = now() WHERE id = ${clubId} AND (wave_pay_url = '' OR wave_pay_url IS NULL)`;
  }
  if (sender) {
    await client`UPDATE clubs SET sender_name = ${sender}, updated_at = now() WHERE id = ${clubId} AND sender_name IN ('', 'Rotaract IUGB Club')`;
  }
  if (senderEmail) {
    await client`UPDATE clubs SET sender_email = ${senderEmail}, updated_at = now() WHERE id = ${clubId} AND (sender_email IS NULL OR sender_email = '')`;
  }
}

export function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

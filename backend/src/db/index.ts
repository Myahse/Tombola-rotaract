import "../loadEnv.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const pooled = /[-.]pooler\./i.test(url);

export const client = postgres(url, {
  max: process.env.VERCEL ? 1 : pooled ? 3 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: !pooled,
});
export const db = drizzle(client, { schema });

export async function ensureSchema() {
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url text`);
  await client.unsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'`);
  await client.unsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref text`);
  await client.unsafe(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scratched_at timestamptz`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN IF NOT EXISTS draw_mode text NOT NULL DEFAULT 'scratch'`);
  await client.unsafe(`ALTER TABLE prizes ADD COLUMN IF NOT EXISTS ticket_number integer`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS prizes_event_ticket_number_idx ON prizes (event_id, ticket_number) WHERE ticket_number IS NOT NULL`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS emails_accepted_at timestamptz`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS club_name text`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS club_role text`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS gender text`);
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
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS events_one_on_sale_idx ON events (status) WHERE status = 'on_sale'`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS donations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id uuid REFERENCES members(id) ON DELETE SET NULL,
      donor_name text NOT NULL,
      donor_email text NOT NULL DEFAULT '',
      donor_phone text,
      amount_cents integer NOT NULL,
      payment_method text NOT NULL DEFAULT 'wave',
      payment_ref text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      received_at timestamptz
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS donations_created_idx ON donations (created_at DESC)`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified_at timestamptz`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0`);
  await client.unsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0`);
  await client.unsafe(`UPDATE members SET email_verified_at = created_at WHERE email_verified_at IS NULL`);
  await client.unsafe(`UPDATE members SET token_version = session_version WHERE token_version = 0 AND session_version > 0`);
  await client.unsafe(`ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'reset'`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL,
      reset_at timestamptz NOT NULL
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id uuid REFERENCES members(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      token_hash text NOT NULL UNIQUE,
      family_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS refresh_tokens_member_idx ON refresh_tokens (member_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens (family_id)`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN IF NOT EXISTS sales_opens_at timestamptz`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS qcm_exams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      title_fr text NOT NULL,
      title_en text NOT NULL,
      question_count integer NOT NULL DEFAULT 20,
      pass_score integer NOT NULL DEFAULT 14,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS qcm_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id uuid NOT NULL REFERENCES qcm_exams(id) ON DELETE CASCADE,
      position integer NOT NULL,
      prompt_fr text NOT NULL,
      prompt_en text NOT NULL,
      choices text NOT NULL,
      correct_choice_id text NOT NULL,
      UNIQUE (exam_id, position)
    )
  `);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS qcm_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id uuid NOT NULL REFERENCES qcm_exams(id) ON DELETE CASCADE,
      member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'in_progress',
      current_index integer NOT NULL DEFAULT 0,
      score integer,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      last_answered_at timestamptz,
      UNIQUE (exam_id, member_id)
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS qcm_attempts_exam_idx ON qcm_attempts (exam_id, status)`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS qcm_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id uuid NOT NULL REFERENCES qcm_attempts(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES qcm_questions(id) ON DELETE CASCADE,
      choice_id text NOT NULL,
      correct boolean NOT NULL,
      answered_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (attempt_id, question_id)
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS qcm_answers_attempt_idx ON qcm_answers (attempt_id)`);
  await client.unsafe(`ALTER TABLE qcm_exams ADD COLUMN IF NOT EXISTS scores_sent_at timestamptz`);
  await client.unsafe(`ALTER TABLE qcm_exams ADD COLUMN IF NOT EXISTS exam_duration_seconds integer`);
  await client.unsafe(`ALTER TABLE qcm_exams ADD COLUMN IF NOT EXISTS question_duration_seconds integer`);
  await client.unsafe(`ALTER TABLE qcm_exams ADD COLUMN IF NOT EXISTS scheduled_at timestamptz`);
  await client.unsafe(`ALTER TABLE qcm_attempts ADD COLUMN IF NOT EXISTS question_started_at timestamptz`);
  await client.unsafe(`ALTER TABLE qcm_attempts ADD COLUMN IF NOT EXISTS archived_at timestamptz`);
  await client.unsafe(`ALTER TABLE qcm_attempts ADD COLUMN IF NOT EXISTS invite_id uuid`);
  await client.unsafe(`ALTER TABLE qcm_attempts DROP CONSTRAINT IF EXISTS qcm_attempts_exam_id_member_id_key`);
  await client.unsafe(`ALTER TABLE qcm_attempts DROP CONSTRAINT IF EXISTS qcm_attempts_exam_id_member_id_unique`);
  await client.unsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS qcm_attempts_live_member ON qcm_attempts (exam_id, member_id) WHERE archived_at IS NULL`,
  );
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS qcm_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id uuid NOT NULL REFERENCES qcm_exams(id) ON DELETE CASCADE,
      email text NOT NULL,
      member_id uuid REFERENCES members(id) ON DELETE SET NULL,
      token text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending',
      sent_at timestamptz,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS qcm_invites_exam_idx ON qcm_invites (exam_id, status)`);
  await client.unsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS qcm_invites_live_email ON qcm_invites (exam_id, email) WHERE archived_at IS NULL`,
  );
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS adhesion_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name text NOT NULL,
      birth_date text NOT NULL,
      sex text NOT NULL,
      address text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      profession text NOT NULL,
      sponsor_name text NOT NULL,
      sponsor_email text NOT NULL DEFAULT '',
      sponsor_role text,
      pledge_name text NOT NULL,
      pledge_rules boolean NOT NULL,
      pledge_participate boolean NOT NULL,
      pledge_dues boolean NOT NULL,
      pledge_observation boolean NOT NULL,
      applicant_signature text NOT NULL,
      sponsor_confirm_name text,
      sponsor_signature text,
      sponsor_date text,
      sponsor_token text UNIQUE,
      status text NOT NULL DEFAULT 'awaiting_sponsor',
      deposit_date text,
      commission_opinion text,
      final_decision text NOT NULL DEFAULT 'pending',
      president_signature text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.unsafe(`ALTER TABLE adhesion_applications ALTER COLUMN sponsor_role DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE adhesion_applications ALTER COLUMN sponsor_confirm_name DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE adhesion_applications ALTER COLUMN sponsor_signature DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE adhesion_applications ALTER COLUMN sponsor_date DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE adhesion_applications ADD COLUMN IF NOT EXISTS sponsor_email text NOT NULL DEFAULT ''`);
  await client.unsafe(`ALTER TABLE adhesion_applications ADD COLUMN IF NOT EXISTS sponsor_token text`);
  await client.unsafe(`ALTER TABLE adhesion_applications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'awaiting_review'`);
  await client.unsafe(`UPDATE adhesion_applications SET sponsor_token = gen_random_uuid()::text WHERE sponsor_token IS NULL`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS adhesion_sponsor_token_idx ON adhesion_applications (sponsor_token)`);
  const { seedInductionQcm } = await import("../lib/qcm.js");
  await seedInductionQcm();
}

export function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

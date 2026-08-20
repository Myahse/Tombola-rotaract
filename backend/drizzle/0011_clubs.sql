-- Applied by ensureSchema() on API boot. Kept here for reference.
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
);

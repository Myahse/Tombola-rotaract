ALTER TABLE members ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS emails_accepted_at timestamptz;

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_member_id_idx ON orders (member_id);

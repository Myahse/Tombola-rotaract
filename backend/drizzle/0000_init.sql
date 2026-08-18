CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_fr text NOT NULL,
  title_en text NOT NULL,
  description_fr text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  ticket_price_cents integer NOT NULL CHECK (ticket_price_cents >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  total_tickets integer NOT NULL CHECK (total_tickets > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'on_sale', 'closed', 'drawn')),
  payment_instructions_fr text NOT NULL DEFAULT '',
  payment_instructions_en text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  name_fr text NOT NULL,
  name_en text NOT NULL,
  description_fr text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  UNIQUE (event_id, rank)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'paid', 'cancelled')),
  access_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS orders_member_id_idx ON orders (member_id);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number > 0),
  prize_id uuid REFERENCES prizes(id) ON DELETE SET NULL,
  UNIQUE (event_id, number)
);

CREATE TABLE IF NOT EXISTS draw_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prize_id uuid NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, prize_id)
);

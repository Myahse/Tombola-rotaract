CREATE UNIQUE INDEX IF NOT EXISTS events_one_on_sale_idx ON events (status) WHERE status = 'on_sale';

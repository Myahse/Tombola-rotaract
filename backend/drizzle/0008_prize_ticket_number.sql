ALTER TABLE prizes ADD COLUMN IF NOT EXISTS ticket_number integer;
CREATE UNIQUE INDEX IF NOT EXISTS prizes_event_ticket_number_idx ON prizes (event_id, ticket_number) WHERE ticket_number IS NOT NULL;

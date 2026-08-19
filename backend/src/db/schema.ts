import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleFr: text("title_fr").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionFr: text("description_fr").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  ticketPriceCents: integer("ticket_price_cents").notNull(),
  currency: text("currency").notNull().default("XOF"),
  totalTickets: integer("total_tickets").notNull(),
  status: text("status").notNull().default("draft"),
  paymentInstructionsFr: text("payment_instructions_fr").notNull().default(""),
  paymentInstructionsEn: text("payment_instructions_en").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prizes = pgTable(
  "prizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    nameFr: text("name_fr").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionFr: text("description_fr").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
  },
  (table) => [unique().on(table.eventId, table.rank)],
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone"),
  quantity: integer("quantity").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  status: text("status").notNull().default("reserved"),
  accessToken: text("access_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    prizeId: uuid("prize_id").references(() => prizes.id, { onDelete: "set null" }),
    scratchedAt: timestamp("scratched_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.eventId, table.number)],
);

export const drawResults = pgTable(
  "draw_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    prizeId: uuid("prize_id")
      .notNull()
      .references(() => prizes.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    drawnAt: timestamp("drawn_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.eventId, table.prizeId)],
);

export type MemberRow = typeof members.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type PrizeRow = typeof prizes.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;

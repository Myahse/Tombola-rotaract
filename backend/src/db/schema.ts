import {
  boolean,
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
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  emailsAcceptedAt: timestamp("emails_accepted_at", { withTimezone: true }),
  clubName: text("club_name"),
  clubRole: text("club_role"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull().default("reset"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  tokenHash: text("token_hash").notNull().unique(),
  familyId: uuid("family_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
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
  drawMode: text("draw_mode").notNull().default("scratch"),
  salesOpensAt: timestamp("sales_opens_at", { withTimezone: true }),
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
    ticketNumber: integer("ticket_number"),
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
  paymentRef: text("payment_ref"),
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

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  preheader: text("preheader").notNull().default(""),
  heading: text("heading").notNull().default(""),
  body: text("body").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default(""),
  ctaUrl: text("cta_url").notNull().default(""),
  includeMembers: boolean("include_members").notNull().default(true),
  includeBuyers: boolean("include_buyers").notNull().default(false),
  optedInOnly: boolean("opted_in_only").notNull().default(true),
  extraEmails: text("extra_emails").notNull().default(""),
  status: text("status").notNull().default("draft"),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  recipientCount: integer("recipient_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const campaignAttachments = pgTable("campaign_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  content: text("content").notNull(),
  inline: boolean("inline").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  source: text("source").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const adhesionApplications = pgTable("adhesion_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull(),
  sex: text("sex").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  profession: text("profession").notNull(),
  sponsorName: text("sponsor_name").notNull(),
  sponsorEmail: text("sponsor_email").notNull().default(""),
  sponsorRole: text("sponsor_role"),
  pledgeName: text("pledge_name").notNull(),
  pledgeRules: boolean("pledge_rules").notNull(),
  pledgeParticipate: boolean("pledge_participate").notNull(),
  pledgeDues: boolean("pledge_dues").notNull(),
  pledgeObservation: boolean("pledge_observation").notNull(),
  applicantSignature: text("applicant_signature").notNull(),
  sponsorConfirmName: text("sponsor_confirm_name"),
  sponsorSignature: text("sponsor_signature"),
  sponsorDate: text("sponsor_date"),
  sponsorToken: text("sponsor_token").unique(),
  status: text("status").notNull().default("awaiting_sponsor"),
  depositDate: text("deposit_date"),
  commissionOpinion: text("commission_opinion"),
  finalDecision: text("final_decision").notNull().default("pending"),
  presidentSignature: text("president_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminPushSubscriptions = pgTable("admin_push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const donations = pgTable("donations", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
  donorName: text("donor_name").notNull(),
  donorEmail: text("donor_email").notNull().default(""),
  donorPhone: text("donor_phone"),
  amountCents: integer("amount_cents").notNull(),
  paymentMethod: text("payment_method").notNull().default("wave"),
  paymentRef: text("payment_ref").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
});
export const qcmExams = pgTable("qcm_exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleFr: text("title_fr").notNull(),
  titleEn: text("title_en").notNull(),
  questionCount: integer("question_count").notNull().default(20),
  passScore: integer("pass_score").notNull().default(14),
  examDurationSeconds: integer("exam_duration_seconds"),
  questionDurationSeconds: integer("question_duration_seconds"),
  status: text("status").notNull().default("draft"),
  scoresSentAt: timestamp("scores_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qcmQuestions = pgTable(
  "qcm_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => qcmExams.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    promptFr: text("prompt_fr").notNull(),
    promptEn: text("prompt_en").notNull(),
    choices: text("choices").notNull(),
    correctChoiceId: text("correct_choice_id").notNull(),
  },
  (table) => [unique().on(table.examId, table.position)],
);

export const qcmAttempts = pgTable(
  "qcm_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => qcmExams.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"),
    currentIndex: integer("current_index").notNull().default(0),
    score: integer("score"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    questionStartedAt: timestamp("question_started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastAnsweredAt: timestamp("last_answered_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.examId, table.memberId)],
);

export const qcmAnswers = pgTable(
  "qcm_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => qcmAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => qcmQuestions.id, { onDelete: "cascade" }),
    choiceId: text("choice_id").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.attemptId, table.questionId)],
);

export type MemberRow = typeof members.$inferSelect;
export type DonationRow = typeof donations.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type PrizeRow = typeof prizes.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type QcmExamRow = typeof qcmExams.$inferSelect;
export type QcmQuestionRow = typeof qcmQuestions.$inferSelect;
export type QcmAttemptRow = typeof qcmAttempts.$inferSelect;

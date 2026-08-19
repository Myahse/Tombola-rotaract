import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { events, members, orders, passwordResets, prizes, tickets } from "../db/schema.js";
import {
  clearMemberSession,
  hashToken,
  newAccessToken,
  optionalMemberId,
  requireMember,
  setMemberSession,
  type MemberRequest,
} from "../lib/auth.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { notifyMemberRegistered, notifyPasswordReset } from "../lib/mail.js";
import { parseAvatar } from "../lib/avatar.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";
import { drawModeOf, maskScratchPrizes } from "../lib/tickets.js";
import { siteUrl } from "../emails/layout.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^[0-9+().\s-]{8,40}$/),
  password: z.string().min(8).max(100),
  avatarUrl: z.string().max(120_000).optional().or(z.literal("")),
  acceptTerms: z.literal(true),
  acceptEmails: z.literal(true),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(100),
});

const forgotSchema = z.object({
  email: z.string().trim().email().max(120),
});

const resetSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{16,64}$/),
  password: z.string().min(8).max(100),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^[0-9+().\s-]{8,40}$/)
    .optional(),
  avatarUrl: z.string().max(120_000).optional(),
  currentPassword: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
});

function publicMember(row: typeof members.$inferSelect) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, avatarUrl: row.avatarUrl };
}

async function claimGuestOrders(memberId: string, email: string) {
  await db
    .update(orders)
    .set({ memberId })
    .where(and(eq(orders.buyerEmail, email), isNull(orders.memberId)));
}

authRouter.post("/auth/register", async (req, res) => {
  if (!allowRequest(`register:${clientKey(req)}`, 8, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    res.status(400).json({
      error: fields.acceptTerms || fields.acceptEmails ? "terms_required" : "invalid_form",
    });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: members.id }).from(members).where(eq(members.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "email_taken" });
    return;
  }

  let member;
  try {
    [member] = await db
      .insert(members)
      .values({
        name: parsed.data.name,
        email,
        phone: parsed.data.phone,
        avatarUrl: parseAvatar(parsed.data.avatarUrl),
        passwordHash: await hashPassword(parsed.data.password),
        termsAcceptedAt: new Date(),
        emailsAcceptedAt: new Date(),
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "email_taken" });
      return;
    }
    console.error("Register insert failed", error);
    res.status(500).json({ error: "server_error" });
    return;
  }

  if (!member) {
    res.status(500).json({ error: "server_error" });
    return;
  }

  await claimGuestOrders(member.id, email);
  setMemberSession(res, member.id);
  res.status(201).json({ member: publicMember(member) });
  void notifyMemberRegistered({ name: member.name, email: member.email });
});

authRouter.post("/auth/login", async (req, res) => {
  if (!allowRequest(`login:${clientKey(req)}`, 15, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const [member] = await db.select().from(members).where(eq(members.email, email)).limit(1);
  if (!member || !(await verifyPassword(parsed.data.password, member.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  await claimGuestOrders(member.id, email);
  setMemberSession(res, member.id);
  res.json({ member: publicMember(member) });
});

authRouter.post("/auth/forgot", async (req, res) => {
  if (
    !allowRequest(`forgot:${clientKey(req)}`, 8, 15 * 60 * 1000) ||
    !allowRequest(`forgot-email:${String(req.body?.email ?? "").toLowerCase()}`, 3, 60 * 60 * 1000)
  ) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const [member] = await db.select().from(members).where(eq(members.email, email)).limit(1);
  if (member) {
    const token = newAccessToken();
    await db.delete(passwordResets).where(eq(passwordResets.memberId, member.id));
    await db.insert(passwordResets).values({
      memberId: member.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    void notifyPasswordReset({
      name: member.name,
      email: member.email,
      resetUrl: siteUrl(`/fr/reset?token=${encodeURIComponent(token)}`),
    });
  }
  res.json({ ok: true });
});

authRouter.post("/auth/reset", async (req, res) => {
  if (!allowRequest(`reset:${clientKey(req)}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hashToken(parsed.data.token)))
    .limit(1);
  if (!reset || reset.expiresAt.getTime() <= Date.now()) {
    if (reset) await db.delete(passwordResets).where(eq(passwordResets.id, reset.id));
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  const [member] = await db
    .update(members)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(members.id, reset.memberId))
    .returning();
  await db.delete(passwordResets).where(eq(passwordResets.memberId, reset.memberId));
  if (!member) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  setMemberSession(res, member.id);
  res.json({ member: publicMember(member) });
});

authRouter.patch("/auth/me", requireMember, async (req, res) => {
  if (!allowRequest(`profile:${clientKey(req)}`, 20, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  if (parsed.data.password && !parsed.data.currentPassword) {
    res.status(400).json({ error: "current_required" });
    return;
  }

  const memberId = (req as MemberRequest).memberId;
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) {
    clearMemberSession(res);
    res.status(401).json({ error: "login_required" });
    return;
  }

  if (parsed.data.password) {
    if (!(await verifyPassword(parsed.data.currentPassword ?? "", member.passwordHash))) {
      res.status(400).json({ error: "invalid_password" });
      return;
    }
  }

  const next = {
    name: parsed.data.name ?? member.name,
    phone: parsed.data.phone ?? member.phone,
    avatarUrl: parsed.data.avatarUrl === undefined ? member.avatarUrl : parseAvatar(parsed.data.avatarUrl),
    passwordHash: parsed.data.password ? await hashPassword(parsed.data.password) : member.passwordHash,
  };

  const [updated] = await db.update(members).set(next).where(eq(members.id, member.id)).returning();
  if (!updated) {
    res.status(500).json({ error: "server_error" });
    return;
  }
  res.json({ member: publicMember(updated) });
});

authRouter.post("/auth/logout", (_req, res) => {
  clearMemberSession(res);
  res.json({ ok: true });
});

authRouter.get("/auth/me", async (req, res) => {
  const memberId = optionalMemberId(req);
  if (!memberId) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) {
    clearMemberSession(res);
    res.status(401).json({ error: "login_required" });
    return;
  }
  res.json({ member: publicMember(member) });
});

authRouter.get("/me/tombolas", requireMember, async (req, res) => {
  const memberId = (req as MemberRequest).memberId;
  const rows = await db
    .select({
      token: orders.accessToken,
      status: orders.status,
      quantity: orders.quantity,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
      eventId: events.id,
      titleFr: events.titleFr,
      titleEn: events.titleEn,
      eventStatus: events.status,
      drawMode: events.drawMode,
      ticketPriceCents: events.ticketPriceCents,
      currency: events.currency,
      ticketNumber: tickets.number,
      prizeId: tickets.prizeId,
      prizeRank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      scratchedAt: tickets.scratchedAt,
    })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .leftJoin(tickets, eq(tickets.orderId, orders.id))
    .leftJoin(prizes, eq(tickets.prizeId, prizes.id))
    .where(and(eq(orders.memberId, memberId), ne(orders.status, "cancelled")))
    .orderBy(desc(orders.createdAt), asc(tickets.number));

  const byEvent = new Map<
    string,
    {
      eventId: string;
      titleFr: string;
      titleEn: string;
      status: string;
      drawMode: string;
      ticketPriceCents: number;
      currency: string;
      orders: Map<
        string,
        {
          token: string;
          status: string;
          quantity: number;
          paymentMethod: string;
          createdAt: Date;
          tickets: {
            number: number;
            prizeId: string | null;
            prizeRank: number | null;
            prizeNameFr: string | null;
            prizeNameEn: string | null;
            scratchedAt: Date | null;
          }[];
        }
      >;
    }
  >();

  for (const row of rows) {
    let event = byEvent.get(row.eventId);
    if (!event) {
      event = {
        eventId: row.eventId,
        titleFr: row.titleFr,
        titleEn: row.titleEn,
        status: row.eventStatus,
        drawMode: row.drawMode,
        ticketPriceCents: row.ticketPriceCents,
        currency: row.currency,
        orders: new Map(),
      };
      byEvent.set(row.eventId, event);
    }
    let order = event.orders.get(row.token);
    if (!order) {
      order = {
        token: row.token,
        status: row.status,
        quantity: row.quantity,
        paymentMethod: row.paymentMethod,
        createdAt: row.createdAt,
        tickets: [],
      };
      event.orders.set(row.token, order);
    }
    if (row.ticketNumber != null) {
      order.tickets.push({
        number: row.ticketNumber,
        prizeId: row.prizeId,
        prizeRank: row.prizeRank,
        prizeNameFr: row.prizeNameFr,
        prizeNameEn: row.prizeNameEn,
        scratchedAt: row.scratchedAt,
      });
    }
  }

  res.json({
    tombolas: [...byEvent.values()].map((event) => ({
      eventId: event.eventId,
      titleFr: event.titleFr,
      titleEn: event.titleEn,
      status: event.status,
      drawMode: drawModeOf(event.drawMode),
      ticketPriceCents: event.ticketPriceCents,
      currency: event.currency,
      orders: [...event.orders.values()].map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        tickets: maskScratchPrizes(
          order.tickets.map((ticket) => ({
            ...ticket,
            scratchedAt: ticket.scratchedAt?.toISOString() ?? null,
          })),
          drawModeOf(event.drawMode),
        ),
      })),
    })),
  });
});

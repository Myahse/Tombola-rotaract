import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { events, members, orders, passwordResets, prizes, tickets } from "../db/schema.js";
import {
  bumpMemberTokenVersion,
  clearMemberSession,
  hashToken,
  issueMemberAuth,
  newAccessToken,
  requireMember,
  resolveMemberId,
  revokeAllRefresh,
  revokeMemberAuth,
  type MemberRequest,
} from "../lib/auth.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { notifyEmailVerify, notifyMemberRegistered, notifyPasswordReset } from "../lib/mail.js";
import { parseAvatar } from "../lib/avatar.js";
import { allowRequest, clientKey, enforceRateLimit, rateLimits, salesAreOpen } from "../lib/rateLimit.js";
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
  clubName: z.string().trim().min(2).max(120),
  clubRole: z.string().trim().min(2).max(80),
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
  clubName: z.string().trim().max(120).optional(),
  clubRole: z.string().trim().max(80).optional(),
  currentPassword: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
});

function publicMember(row: typeof members.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    clubName: row.clubName,
    clubRole: row.clubRole,
    emailVerified: Boolean(row.emailVerifiedAt),
  };
}

async function claimGuestOrders(member: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
}) {
  if (!member.emailVerifiedAt) return;
  await db
    .update(orders)
    .set({ memberId: member.id, buyerName: member.name, buyerPhone: member.phone })
    .where(and(eq(orders.buyerEmail, member.email), isNull(orders.memberId)));
}

async function sendVerifyLink(member: { id: string; name: string; email: string }) {
  const token = newAccessToken();
  await db
    .delete(passwordResets)
    .where(and(eq(passwordResets.memberId, member.id), eq(passwordResets.purpose, "verify")));
  await db.insert(passwordResets).values({
    memberId: member.id,
    tokenHash: hashToken(token),
    purpose: "verify",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  void notifyEmailVerify({
    name: member.name,
    email: member.email,
    verifyUrl: siteUrl(`/fr/verify?token=${encodeURIComponent(token)}`),
  });
}

authRouter.post("/auth/register", async (req, res) => {
  const ip = clientKey(req);
  if (!(await enforceRateLimit(res, `register:ip:${ip}`, rateLimits.registerIp, rateLimits.windowMs))) {
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
  if (
    !(await enforceRateLimit(
      res,
      `register:email:${email}`,
      rateLimits.registerEmail,
      rateLimits.registerEmailWindowMs,
    ))
  ) {
    return;
  }
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
        clubName: parsed.data.clubName,
        clubRole: parsed.data.clubRole,
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

  await sendVerifyLink(member);
  await issueMemberAuth(res, member.id, member.tokenVersion);
  res.status(201).json({ member: publicMember(member) });
  void notifyMemberRegistered({ name: member.name, email: member.email });
});

authRouter.post("/auth/login", async (req, res) => {
  if (!(await enforceRateLimit(res, `login:${clientKey(req)}`, rateLimits.loginIp, rateLimits.windowMs))) {
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

  await claimGuestOrders(member);
  await issueMemberAuth(res, member.id, member.tokenVersion);
  res.json({ member: publicMember(member) });
});

authRouter.post("/auth/forgot", async (req, res) => {
  if (
    !(await allowRequest(`forgot:${clientKey(req)}`, 8, 15 * 60 * 1000)) ||
    !(await allowRequest(`forgot-email:${String(req.body?.email ?? "").toLowerCase()}`, 3, 60 * 60 * 1000))
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
    await db
      .delete(passwordResets)
      .where(and(eq(passwordResets.memberId, member.id), eq(passwordResets.purpose, "reset")));
    await db.insert(passwordResets).values({
      memberId: member.id,
      tokenHash: hashToken(token),
      purpose: "reset",
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
  if (!(await allowRequest(`reset:${clientKey(req)}`, 10, 15 * 60 * 1000))) {
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
    .where(and(eq(passwordResets.tokenHash, hashToken(parsed.data.token)), eq(passwordResets.purpose, "reset")))
    .limit(1);
  if (!reset || reset.expiresAt.getTime() <= Date.now()) {
    if (reset) await db.delete(passwordResets).where(eq(passwordResets.id, reset.id));
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  const [member] = await db
    .update(members)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      emailVerifiedAt: new Date(),
      tokenVersion: sql`${members.tokenVersion} + 1`,
    })
    .where(eq(members.id, reset.memberId))
    .returning();
  await db.delete(passwordResets).where(eq(passwordResets.memberId, reset.memberId));
  if (!member) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  await claimGuestOrders(member);
  await revokeAllRefresh({ memberId: member.id });
  await issueMemberAuth(res, member.id, member.tokenVersion);
  res.json({ member: publicMember(member) });
});

authRouter.patch("/auth/me", requireMember, async (req, res) => {
  if (!(await allowRequest(`profile:${clientKey(req)}`, 20, 15 * 60 * 1000))) {
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
    clubName: parsed.data.clubName === undefined ? member.clubName : parsed.data.clubName || null,
    clubRole: parsed.data.clubRole === undefined ? member.clubRole : parsed.data.clubRole || null,
    passwordHash: parsed.data.password ? await hashPassword(parsed.data.password) : member.passwordHash,
  };

  const [updated] = await db.update(members).set(next).where(eq(members.id, member.id)).returning();
  if (!updated) {
    res.status(500).json({ error: "server_error" });
    return;
  }
  if (parsed.data.password) {
    const tokenVersion = await bumpMemberTokenVersion(updated.id);
    await issueMemberAuth(res, updated.id, tokenVersion);
    const [fresh] = await db.select().from(members).where(eq(members.id, updated.id)).limit(1);
    res.json({ member: publicMember(fresh ?? updated) });
    return;
  }
  res.json({ member: publicMember(updated) });
});

authRouter.post("/auth/logout", async (req, res) => {
  await revokeMemberAuth(req, res);
  res.json({ ok: true });
});

authRouter.post("/auth/refresh", async (req, res) => {
  const memberId = await resolveMemberId(req, res);
  if (!memberId) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  res.json({ ok: true });
});

authRouter.get("/auth/me", async (req, res) => {
  const memberId = await resolveMemberId(req, res);
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

const verifySchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

authRouter.post("/auth/verify", async (req, res) => {
  if (!(await allowRequest(`verify:${clientKey(req)}`, 20, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashToken(parsed.data.token)), eq(passwordResets.purpose, "verify")))
    .limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) await db.delete(passwordResets).where(eq(passwordResets.id, row.id));
    res.status(400).json({ error: "invalid_token" });
    return;
  }
  const [member] = await db
    .update(members)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(members.id, row.memberId))
    .returning();
  await db.delete(passwordResets).where(eq(passwordResets.id, row.id));
  if (!member) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }
  await claimGuestOrders(member);
  await issueMemberAuth(res, member.id, member.tokenVersion);
  res.json({ member: publicMember(member) });
});

authRouter.post("/auth/verify/resend", requireMember, async (req, res) => {
  if (!(await allowRequest(`verify-resend:${clientKey(req)}`, 5, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const memberId = (req as MemberRequest).memberId;
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  if (member.emailVerifiedAt) {
    res.json({ ok: true, already: true });
    return;
  }
  await sendVerifyLink(member);
  res.json({ ok: true });
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

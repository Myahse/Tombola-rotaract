import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { campaignAttachments, donations, drawResults, events, members, orders, prizes, tickets } from "../db/schema.js";
import { newAccessToken, requireMember, resolveMemberId, type MemberRequest } from "../lib/auth.js";
import { getCurrentPublicEvent, publicSnapshot, publishChange } from "../lib/publicSnapshot.js";
import { broadcast } from "../lib/realtime.js";
import { wavePayUrl } from "../lib/payments.js";
import { drawModeOf, heldSeatCount, maskScratchPrizes } from "../lib/tickets.js";
import { allowRequest, clientKey, enforceRateLimit, rateLimits, salesAreOpen } from "../lib/rateLimit.js";
import { notifyGiftTickets } from "../lib/mail.js";
import { siteUrl } from "../emails/layout.js";
import {
  notifyOrganizerDonation,
  notifyOrganizerNewOrder,
  notifyOrganizerOrderCancelled,
  notifyOrganizerPaymentRef,
} from "../lib/organizerNotify.js";
import { optionalE164Phone } from "../lib/phone.js";

export const publicRouter = Router();

type QueryDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ownedOrder(token: string, memberId: string, exec: QueryDb = db) {
  const [order] = await exec.select().from(orders).where(eq(orders.accessToken, token)).limit(1);
  if (!order || order.status === "cancelled") return { error: "not_found" as const };
  if (order.memberId === memberId) return { order };
  if (order.memberId) return { error: "forbidden" as const };
  const [member] = await exec.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member || member.email !== order.buyerEmail.trim().toLowerCase()) {
    return { error: "forbidden" as const };
  }
  const [updated] = await exec
    .update(orders)
    .set({ memberId: member.id, buyerName: member.name, buyerPhone: member.phone })
    .where(and(eq(orders.id, order.id), isNull(orders.memberId)))
    .returning();
  return { order: updated ?? { ...order, memberId: member.id } };
}

const buySchema = z.object({
  quantity: z.number().int().min(1).max(20),
  phone: optionalE164Phone,
  paymentMethod: z.enum(["cash", "wave"]).default("cash"),
});

publicRouter.get("/event/current", async (_req, res) => {
  res.json({ event: await publicSnapshot() });
});

publicRouter.get("/payments", (_req, res) => {
  res.json({ wavePayUrl: wavePayUrl() });
});

publicRouter.get("/campaign-images/:id", async (req, res) => {
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const [file] = await db
    .select({
      content: campaignAttachments.content,
      mimeType: campaignAttachments.mimeType,
      filename: campaignAttachments.filename,
    })
    .from(campaignAttachments)
    .where(eq(campaignAttachments.id, parsed.data))
    .limit(1);
  if (!file) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const buffer = Buffer.from(file.content, "base64");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buffer);
});

publicRouter.get("/event/current/results", async (_req, res) => {
  const event = await getCurrentPublicEvent();
  if (!event) {
    res.json({ event: null, winners: [] });
    return;
  }
  const publicEvent = {
    titleFr: event.titleFr,
    titleEn: event.titleEn,
    status: event.status,
    drawMode: drawModeOf(event.drawMode),
  };
  if (event.status !== "drawn" || publicEvent.drawMode === "scratch") {
    res.json({ event: publicEvent, winners: [] });
    return;
  }
  const winners = await db
    .select({
      rank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
      avatarUrl: members.avatarUrl,
    })
    .from(drawResults)
    .innerJoin(prizes, eq(drawResults.prizeId, prizes.id))
    .innerJoin(tickets, eq(drawResults.ticketId, tickets.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .leftJoin(members, eq(orders.memberId, members.id))
    .where(eq(drawResults.eventId, event.id))
    .orderBy(asc(prizes.rank));
  res.json({ event: publicEvent, winners });
});

publicRouter.post("/orders", requireMember, async (req, res) => {
  if (!(await enforceRateLimit(res, `buy:${clientKey(req)}`, rateLimits.buyIp, rateLimits.windowMs))) {
    return;
  }
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const memberId = (req as MemberRequest).memberId;
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) {
    res.status(401).json({ error: "login_required" });
    return;
  }

  const phone = parsed.data.phone || member.phone;
  if (parsed.data.phone) {
    await db.update(members).set({ phone: parsed.data.phone }).where(eq(members.id, member.id));
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.status, "on_sale"))
        .orderBy(desc(events.createdAt))
        .limit(1);

      if (!event) {
        throw Object.assign(new Error("not_on_sale"), { status: 409 });
      }
      if (!salesAreOpen(event.salesOpensAt)) {
        throw Object.assign(new Error("sales_not_open"), { status: 409 });
      }

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}::text))`);

      const held = await heldSeatCount(tx, event.id);
      const remaining = event.totalTickets - held;
      if (parsed.data.quantity > remaining) {
        throw Object.assign(new Error("not_enough_tickets"), { status: 409, remaining: Math.max(0, remaining) });
      }

      const token = newAccessToken();

      const [order] = await tx
        .insert(orders)
        .values({
          eventId: event.id,
          memberId: member.id,
          buyerName: member.name,
          buyerEmail: member.email,
          buyerPhone: phone || null,
          quantity: parsed.data.quantity,
          paymentMethod: parsed.data.paymentMethod,
          status: "reserved",
          accessToken: token,
        })
        .returning();

      if (!order) throw new Error("order_failed");

      return { event, order };
    });

    res.status(201).json({
      eventId: created.event.id,
      token: created.order.accessToken,
      buyerName: created.order.buyerName,
      buyerEmail: created.order.buyerEmail,
      quantity: created.order.quantity,
      paymentMethod: created.order.paymentMethod,
      paymentRef: created.order.paymentRef,
      wavePayUrl: wavePayUrl(),
      status: created.order.status,
      ticketPriceCents: created.event.ticketPriceCents,
      currency: created.event.currency,
      paymentInstructionsFr: created.event.paymentInstructionsFr,
      paymentInstructionsEn: created.event.paymentInstructionsEn,
      eventStatus: created.event.status,
      drawMode: drawModeOf(created.event.drawMode),
      numbers: [],
      tickets: [],
    });
    void publishChange("order");
    notifyOrganizerNewOrder(
      created.order.buyerName,
      created.order.quantity,
      created.order.paymentMethod,
    );
  } catch (error) {
    const err = error as Error & { status?: number; remaining?: number };
    if (err.message === "not_on_sale") {
      res.status(409).json({ error: "not_on_sale" });
      return;
    }
    if (err.message === "sales_not_open") {
      res.status(409).json({ error: "sales_not_open" });
      return;
    }
    if (err.message === "not_enough_tickets") {
      res.status(409).json({ error: "not_enough_tickets", remaining: err.remaining ?? 0 });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

publicRouter.get("/orders/:token", requireMember, async (req, res) => {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  const loaded = await ownedOrder(token, (req as MemberRequest).memberId);
  if ("error" in loaded) {
    res.status(loaded.error === "not_found" ? 404 : 403).json({ error: loaded.error });
    return;
  }
  const order = loaded.order;

  const [event] = await db.select().from(events).where(eq(events.id, order.eventId)).limit(1);
  const orderTickets = await db
    .select({
      number: tickets.number,
      prizeId: tickets.prizeId,
      prizeRank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      scratchedAt: tickets.scratchedAt,
    })
    .from(tickets)
    .leftJoin(prizes, eq(tickets.prizeId, prizes.id))
    .where(eq(tickets.orderId, order.id))
    .orderBy(asc(tickets.number));

  res.json({
    token: order.accessToken,
    eventId: order.eventId,
    buyerName: order.buyerName,
    quantity: order.quantity,
    paymentMethod: order.paymentMethod,
    paymentRef: order.paymentRef,
    wavePayUrl: wavePayUrl(),
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    ticketPriceCents: event?.ticketPriceCents ?? 0,
    currency: event?.currency ?? "XOF",
    eventStatus: event?.status ?? "draft",
    titleFr: event?.titleFr ?? "",
    titleEn: event?.titleEn ?? "",
    paymentInstructionsFr: event?.paymentInstructionsFr ?? "",
    paymentInstructionsEn: event?.paymentInstructionsEn ?? "",
    drawMode: drawModeOf(event?.drawMode),
    tickets: maskScratchPrizes(orderTickets, drawModeOf(event?.drawMode)),
  });
});

const paymentRefSchema = z.object({
  paymentRef: z
    .string()
    .trim()
    .min(4)
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .#/_-]*$/),
});

publicRouter.post("/orders/:token/payment-ref", requireMember, async (req, res) => {
  if (!(await allowRequest(`payref:${clientKey(req)}`, 20, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    res.status(400).json({ error: "missing_token" });
    return;
  }
  const parsed = paymentRefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const loaded = await ownedOrder(token, (req as MemberRequest).memberId);
  if ("error" in loaded) {
    res.status(loaded.error === "not_found" ? 404 : 403).json({ error: loaded.error });
    return;
  }
  const order = loaded.order;
  if (order.paymentMethod !== "wave") {
    res.status(409).json({ error: "not_wave" });
    return;
  }
  if (order.status !== "reserved") {
    res.status(409).json({ error: "already_paid" });
    return;
  }

  const [event] = await db.select({ status: events.status }).from(events).where(eq(events.id, order.eventId)).limit(1);
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }

  const [updated] = await db
    .update(orders)
    .set({ paymentRef: parsed.data.paymentRef.trim() })
    .where(eq(orders.id, order.id))
    .returning();
  res.json({ paymentRef: updated?.paymentRef ?? parsed.data.paymentRef });
  void publishChange("order");
  notifyOrganizerPaymentRef(order.buyerName, parsed.data.paymentRef.trim());
});

publicRouter.post("/orders/:token/cancel", requireMember, async (req, res) => {
  if (!(await enforceRateLimit(res, `cancel:${clientKey(req)}`, rateLimits.cancelIp, rateLimits.windowMs))) {
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  try {
    const cancelled = await db.transaction(async (tx) => {
      const loaded = await ownedOrder(token, (req as MemberRequest).memberId, tx);
      if ("error" in loaded) {
        throw Object.assign(new Error(loaded.error), { status: loaded.error === "not_found" ? 404 : 403 });
      }
      const order = loaded.order;
      if (order.status !== "reserved") {
        throw Object.assign(new Error("already_paid"), { status: 409 });
      }
      const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, order.eventId)).limit(1);
      if (!event || event.status === "drawn") {
        throw Object.assign(new Error("event_locked"), { status: 409 });
      }
      await tx.delete(tickets).where(eq(tickets.orderId, order.id));
      await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
      return { buyerName: order.buyerName, quantity: order.quantity };
    });
    res.json({ ok: true });
    void publishChange("order");
    notifyOrganizerOrderCancelled(cancelled.buyerName, cancelled.quantity);
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.message === "not_found") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (err.message === "forbidden") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (err.message === "already_paid" || err.message === "event_locked") {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

const shareSchema = z.object({
  email: z.string().trim().email().max(120),
  numbers: z.array(z.number().int().min(1)).max(20).optional(),
});

publicRouter.post("/orders/:token/share", requireMember, async (req, res) => {
  if (!(await allowRequest(`share:${clientKey(req)}`, 10, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    res.status(400).json({ error: "missing_token" });
    return;
  }
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const memberId = (req as MemberRequest).memberId;
  const email = parsed.data.email.trim().toLowerCase();

  try {
    const gifted = await db.transaction(async (tx) => {
      const loaded = await ownedOrder(token, memberId, tx);
      if ("error" in loaded) {
        throw Object.assign(new Error(loaded.error), { status: loaded.error === "not_found" ? 404 : 403 });
      }
      const order = loaded.order;
      if (order.status !== "paid") {
        throw Object.assign(new Error("not_paid"), { status: 409 });
      }

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${order.eventId}::text))`);

      const [event] = await tx.select().from(events).where(eq(events.id, order.eventId)).limit(1);
      if (!event || event.status === "drawn") {
        throw Object.assign(new Error("event_locked"), { status: 409 });
      }

      const [giver] = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
      if (!giver) {
        throw Object.assign(new Error("login_required"), { status: 401 });
      }
      if (giver.email === email) {
        throw Object.assign(new Error("self"), { status: 400 });
      }

      const orderTickets = await tx
        .select({ id: tickets.id, number: tickets.number })
        .from(tickets)
        .where(eq(tickets.orderId, order.id));
      if (!orderTickets.length) {
        throw Object.assign(new Error("not_paid"), { status: 409 });
      }

      const wanted = parsed.data.numbers?.length
        ? [...new Set(parsed.data.numbers)]
        : orderTickets.map((row) => row.number);
      const owned = new Set(orderTickets.map((row) => row.number));
      if (!wanted.length || wanted.some((number) => !owned.has(number))) {
        throw Object.assign(new Error("invalid_tickets"), { status: 400 });
      }

      const [recipient] = await tx.select().from(members).where(eq(members.email, email)).limit(1);
      const recipientId = recipient?.emailVerifiedAt ? recipient.id : null;
      const moving = orderTickets.filter((row) => wanted.includes(row.number));
      const all = moving.length === orderTickets.length;
      const giftToken = newAccessToken();

      let giftOrder = order;
      if (all) {
        const [updated] = await tx
          .update(orders)
          .set({
            memberId: recipientId,
            buyerName: recipient?.name ?? email,
            buyerEmail: email,
            buyerPhone: recipientId ? recipient?.phone ?? null : null,
            accessToken: giftToken,
          })
          .where(eq(orders.id, order.id))
          .returning();
        if (!updated) throw Object.assign(new Error("not_found"), { status: 404 });
        giftOrder = updated;
      } else {
        const [created] = await tx
          .insert(orders)
          .values({
            eventId: order.eventId,
            memberId: recipientId,
            buyerName: recipient?.name ?? email,
            buyerEmail: email,
            buyerPhone: recipientId ? recipient?.phone ?? null : null,
            quantity: moving.length,
            paymentMethod: order.paymentMethod,
            status: "paid",
            paidAt: order.paidAt ?? new Date(),
            accessToken: giftToken,
          })
          .returning();
        if (!created) throw new Error("order_failed");
        await tx
          .update(tickets)
          .set({ orderId: created.id })
          .where(
            and(
              eq(tickets.orderId, order.id),
              inArray(
                tickets.number,
                moving.map((row) => row.number),
              ),
            ),
          );
        await tx
          .update(orders)
          .set({ quantity: order.quantity - moving.length })
          .where(eq(orders.id, order.id));
        giftOrder = created;
      }

      return {
        remaining: !all,
        token: all ? null : order.accessToken,
        giftToken: giftOrder.accessToken,
        numbers: moving.map((row) => row.number).sort((a, b) => a - b),
        giverName: giver.name,
        recipientName: recipient?.name ?? email,
        recipientEmail: email,
        recipientMemberId: recipientId,
        hasAccount: Boolean(recipient),
        eventId: order.eventId,
        eventTitleFr: event.titleFr,
        eventTitleEn: event.titleEn,
      };
    });

    res.json({ ok: true, remaining: gifted.remaining, token: gifted.token });
    void publishChange("order");
    void notifyGiftTickets({
      name: gifted.recipientName,
      email: gifted.recipientEmail,
      memberId: gifted.recipientMemberId,
      giverName: gifted.giverName,
      eventTitleFr: gifted.eventTitleFr,
      eventTitleEn: gifted.eventTitleEn,
      numbers: gifted.numbers,
      hasAccount: gifted.hasAccount,
      ticketsUrl: siteUrl(
        gifted.hasAccount && gifted.recipientMemberId
          ? `/fr/my-tickets/${gifted.eventId}`
          : gifted.hasAccount
            ? `/fr/login?next=${encodeURIComponent(`/fr/tickets/${gifted.giftToken}`)}`
            : `/fr/register?next=${encodeURIComponent(`/fr/tickets/${gifted.giftToken}`)}`,
      ),
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

publicRouter.post("/orders/:token/tickets/:number/scratch", requireMember, async (req, res) => {
  if (!(await allowRequest(`scratch:${clientKey(req)}`, 40, 60_000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const number = Number(req.params.number);
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token) || !Number.isInteger(number) || number < 1) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const loaded = await ownedOrder(token, (req as MemberRequest).memberId);
  if ("error" in loaded) {
    res.status(loaded.error === "not_found" ? 404 : 403).json({ error: loaded.error });
    return;
  }
  const order = loaded.order;
  if (order.status !== "paid") {
    res.status(409).json({ error: "not_paid" });
    return;
  }

  const [event] = await db.select().from(events).where(eq(events.id, order.eventId)).limit(1);
  if (!event || drawModeOf(event.drawMode) !== "scratch") {
    res.status(409).json({ error: "not_drawn" });
    return;
  }

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.orderId, order.id), eq(tickets.number, number)))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const scratchedAt = ticket.scratchedAt ?? new Date();
  const [prize] = ticket.prizeId
    ? await db.select().from(prizes).where(eq(prizes.id, ticket.prizeId)).limit(1)
    : [];
  if (!ticket.scratchedAt) {
    await db.update(tickets).set({ scratchedAt }).where(eq(tickets.id, ticket.id));
    broadcast(
      {
        type: "ticket.scratched",
        ticket: {
          ticketNumber: ticket.number,
          buyerName: order.buyerName,
          scratchedAt: scratchedAt.toISOString(),
          prizeRank: prize?.rank ?? null,
          prizeNameFr: prize?.nameFr ?? null,
          prizeNameEn: prize?.nameEn ?? null,
        },
      },
      "organizer",
    );
  }

  res.json({
    ok: true,
    scratchedAt: scratchedAt.toISOString(),
    prizeRank: prize?.rank ?? null,
    prizeNameFr: prize?.nameFr ?? null,
    prizeNameEn: prize?.nameEn ?? null,
  });
});

const donateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: optionalE164Phone,
  amount: z.number().int().min(100).max(10_000_000),
  paymentRef: z
    .string()
    .trim()
    .min(4)
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .#/_-]*$/),
});

publicRouter.post("/donations", async (req, res) => {
  if (!(await allowRequest(`donate:${clientKey(req)}`, 10, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = donateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const memberId = await resolveMemberId(req, res);
  let name = parsed.data.name;
  let email = parsed.data.email?.trim() ?? "";
  let phone = parsed.data.phone?.trim() || null;
  if (memberId) {
    const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (member) {
      if (!email) email = member.email;
      if (!phone) phone = member.phone;
    }
  }

  const [created] = await db
    .insert(donations)
    .values({
      memberId: memberId || null,
      donorName: name,
      donorEmail: email,
      donorPhone: phone,
      amountCents: parsed.data.amount,
      paymentMethod: "wave",
      paymentRef: parsed.data.paymentRef.trim(),
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: created?.id,
    donorName: created?.donorName,
    amountCents: created?.amountCents,
    paymentRef: created?.paymentRef,
    status: created?.status,
  });
  void publishChange("order");
  if (created) notifyOrganizerDonation(created.donorName, created.amountCents);
});

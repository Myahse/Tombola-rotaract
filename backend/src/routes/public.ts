import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { drawResults, events, members, orders, prizes, tickets } from "../db/schema.js";
import { newAccessToken, requireMember, type MemberRequest } from "../lib/auth.js";
import { getCurrentPublicEvent, publicSnapshot, publishChange } from "../lib/publicSnapshot.js";
import { broadcast } from "../lib/realtime.js";
import { wavePayUrl } from "../lib/payments.js";
import { drawModeOf, maskScratchPrizes } from "../lib/tickets.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";

export const publicRouter = Router();

const buySchema = z.object({
  quantity: z.number().int().min(1).max(20),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  paymentMethod: z.enum(["cash", "wave"]).default("cash"),
});

publicRouter.get("/event/current", async (_req, res) => {
  res.json({ event: await publicSnapshot() });
});

publicRouter.get("/payments", (_req, res) => {
  res.json({ wavePayUrl: wavePayUrl() });
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
  if (!allowRequest(`buy:${clientKey(req)}`, 20, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
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

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}::text))`);

      const usedRows = await tx
        .select({ number: tickets.number })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(eq(tickets.eventId, event.id), ne(orders.status, "cancelled")));

      const remaining = event.totalTickets - usedRows.length;
      if (parsed.data.quantity > remaining) {
        throw Object.assign(new Error("not_enough_tickets"), { status: 409, remaining });
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
      token: created.order.accessToken,
      buyerName: created.order.buyerName,
      buyerEmail: created.order.buyerEmail,
      quantity: created.order.quantity,
      paymentMethod: created.order.paymentMethod,
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
  } catch (error) {
    const err = error as Error & { status?: number; remaining?: number };
    if (err.message === "not_on_sale") {
      res.status(409).json({ error: "not_on_sale" });
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

  const [order] = await db.select().from(orders).where(eq(orders.accessToken, token)).limit(1);
  if (!order || order.status === "cancelled") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (order.memberId !== (req as MemberRequest).memberId) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

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
    buyerName: order.buyerName,
    quantity: order.quantity,
    paymentMethod: order.paymentMethod,
    wavePayUrl: wavePayUrl(),
    status: order.status,
    createdAt: order.createdAt,
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

publicRouter.post("/orders/:token/tickets/:number/scratch", requireMember, async (req, res) => {
  if (!allowRequest(`scratch:${clientKey(req)}`, 40, 60_000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const number = Number(req.params.number);
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token) || !Number.isInteger(number) || number < 1) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.accessToken, token)).limit(1);
  if (!order || order.status === "cancelled") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (order.memberId !== (req as MemberRequest).memberId) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (order.status !== "paid") {
    res.status(409).json({ error: "not_paid" });
    return;
  }

  const [event] = await db.select().from(events).where(eq(events.id, order.eventId)).limit(1);
  if (!event || event.status !== "drawn" || drawModeOf(event.drawMode) !== "scratch") {
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

import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { drawResults, events, members, orders, prizes, tickets } from "../db/schema.js";
import { newAccessToken, requireMember, type MemberRequest } from "../lib/auth.js";
import { getCurrentPublicEvent, publicSnapshot, publishChange } from "../lib/publicSnapshot.js";
import { nextTicketNumbers } from "../lib/tickets.js";

export const publicRouter = Router();

const buySchema = z.object({
  quantity: z.number().int().min(1).max(20),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

publicRouter.get("/event/current", async (_req, res) => {
  res.json({ event: await publicSnapshot() });
});

publicRouter.get("/event/current/results", async (_req, res) => {
  const event = await getCurrentPublicEvent();
  if (!event || event.status !== "drawn") {
    res.json({ winners: [] });
    return;
  }
  const winners = await db
    .select({
      rank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
    })
    .from(drawResults)
    .innerJoin(prizes, eq(drawResults.prizeId, prizes.id))
    .innerJoin(tickets, eq(drawResults.ticketId, tickets.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(eq(drawResults.eventId, event.id))
    .orderBy(asc(prizes.rank));
  res.json({
    event: {
      titleFr: event.titleFr,
      titleEn: event.titleEn,
      status: event.status,
    },
    winners,
  });
});

publicRouter.post("/orders", requireMember, async (req, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form", details: parsed.error.flatten() });
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

      const used = usedRows.map((row) => row.number);
      const remaining = event.totalTickets - used.length;
      if (parsed.data.quantity > remaining) {
        throw Object.assign(new Error("not_enough_tickets"), { status: 409, remaining });
      }

      const numbers = nextTicketNumbers(used, event.totalTickets, parsed.data.quantity);
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
          status: "reserved",
          accessToken: token,
        })
        .returning();

      if (!order) throw new Error("order_failed");

      const insertedTickets = await tx
        .insert(tickets)
        .values(
          numbers.map((number) => ({
            eventId: event.id,
            orderId: order.id,
            number,
          })),
        )
        .returning();

      if (used.length + numbers.length >= event.totalTickets) {
        await tx
          .update(events)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(events.id, event.id));
      }

      return { event, order, tickets: insertedTickets };
    });

    res.status(201).json({
      token: created.order.accessToken,
      buyerName: created.order.buyerName,
      buyerEmail: created.order.buyerEmail,
      quantity: created.order.quantity,
      status: created.order.status,
      ticketPriceCents: created.event.ticketPriceCents,
      currency: created.event.currency,
      paymentInstructionsFr: created.event.paymentInstructionsFr,
      paymentInstructionsEn: created.event.paymentInstructionsEn,
      numbers: created.tickets.map((ticket) => ticket.number).sort((a, b) => a - b),
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

publicRouter.get("/orders/:token", async (req, res) => {
  const token = req.params.token;
  if (!token) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.accessToken, token)).limit(1);
  if (!order || order.status === "cancelled") {
    res.status(404).json({ error: "not_found" });
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
    })
    .from(tickets)
    .leftJoin(prizes, eq(tickets.prizeId, prizes.id))
    .where(eq(tickets.orderId, order.id))
    .orderBy(asc(tickets.number));

  res.json({
    token: order.accessToken,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    quantity: order.quantity,
    status: order.status,
    createdAt: order.createdAt,
    ticketPriceCents: event?.ticketPriceCents ?? 0,
    currency: event?.currency ?? "XOF",
    eventStatus: event?.status ?? "draft",
    titleFr: event?.titleFr ?? "",
    titleEn: event?.titleEn ?? "",
    paymentInstructionsFr: event?.paymentInstructionsFr ?? "",
    paymentInstructionsEn: event?.paymentInstructionsEn ?? "",
    tickets: orderTickets,
  });
});

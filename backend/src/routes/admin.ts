import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index";
import { drawResults, events, orders, prizes, tickets } from "../db/schema";
import { adminEmailMatches, clearSession, passwordMatches, requireAdmin, setSession } from "../lib/auth";
import { shuffle } from "../lib/tickets";
import { publishChange } from "../lib/publicSnapshot";
import { notifyTombolaWinners } from "../lib/mail";
import { siteUrl } from "../emails/layout";

export const adminRouter = Router();

const eventSchema = z.object({
  titleFr: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().min(2).max(120),
  descriptionFr: z.string().trim().max(2000).default(""),
  descriptionEn: z.string().trim().max(2000).default(""),
  paymentInstructionsFr: z.string().trim().max(2000).default(""),
  paymentInstructionsEn: z.string().trim().max(2000).default(""),
  ticketPriceCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(8).default("XOF"),
  totalTickets: z.number().int().min(1).max(10000),
  prizes: z
    .array(
      z.object({
        rank: z.number().int().min(1),
        nameFr: z.string().trim().min(1).max(120),
        nameEn: z.string().trim().min(1).max(120),
        descriptionFr: z.string().trim().max(500).default(""),
        descriptionEn: z.string().trim().max(500).default(""),
      }),
    )
    .max(200),
});

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return `${base || "tombola"}-${Date.now().toString(36)}`;
}

async function latestEvent() {
  const [event] = await db.select().from(events).orderBy(desc(events.createdAt)).limit(1);
  return event ?? null;
}

async function statsFor(eventId: string, totalTickets: number) {
  const orderRows = await db
    .select({
      status: orders.status,
      count: count(),
      tickets: sql<number>`coalesce(sum(${orders.quantity}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), ne(orders.status, "cancelled")))
    .groupBy(orders.status);

  let paidOrders = 0;
  let reservedOrders = 0;
  let paidTickets = 0;
  let reservedTickets = 0;
  for (const row of orderRows) {
    const ticketCount = Number(row.tickets);
    const orderCount = Number(row.count);
    if (row.status === "paid") {
      paidOrders = orderCount;
      paidTickets = ticketCount;
    }
    if (row.status === "reserved") {
      reservedOrders = orderCount;
      reservedTickets = ticketCount;
    }
  }

  return {
    paidOrders,
    reservedOrders,
    paidTickets,
    reservedTickets,
    remainingTickets: Math.max(0, totalTickets - paidTickets - reservedTickets),
  };
}

adminRouter.post("/login", (req, res) => {
  const parsed = z
    .object({
      email: z.string().trim().email(),
      password: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success || !adminEmailMatches(parsed.data.email) || !passwordMatches(parsed.data.password)) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  setSession(res);
  res.json({ ok: true });
});

adminRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

adminRouter.get("/me", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get("/event", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
    res.json({ event: null, prizes: [], stats: null });
    return;
  }
  const eventPrizes = await db
    .select()
    .from(prizes)
    .where(eq(prizes.eventId, event.id))
    .orderBy(asc(prizes.rank));
  const stats = await statsFor(event.id, event.totalTickets);
  res.json({ event, prizes: eventPrizes, stats });
});

adminRouter.post("/event", requireAdmin, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form", details: parsed.error.flatten() });
    return;
  }
  const current = await latestEvent();
  if (current && current.status !== "drawn") {
    res.status(409).json({ error: "active_event_exists" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        slug: slugify(parsed.data.titleEn || parsed.data.titleFr),
        titleFr: parsed.data.titleFr,
        titleEn: parsed.data.titleEn,
        descriptionFr: parsed.data.descriptionFr,
        descriptionEn: parsed.data.descriptionEn,
        paymentInstructionsFr: parsed.data.paymentInstructionsFr,
        paymentInstructionsEn: parsed.data.paymentInstructionsEn,
        ticketPriceCents: parsed.data.ticketPriceCents,
        currency: parsed.data.currency,
        totalTickets: parsed.data.totalTickets,
        status: "draft",
      })
      .returning();
    if (!event) throw new Error("create_failed");
    if (parsed.data.prizes.length) {
      await tx.insert(prizes).values(
        parsed.data.prizes.map((prize) => ({
          eventId: event.id,
          rank: prize.rank,
          nameFr: prize.nameFr,
          nameEn: prize.nameEn,
          descriptionFr: prize.descriptionFr,
          descriptionEn: prize.descriptionEn,
        })),
      );
    }
    return event;
  });

  res.status(201).json({ event: created });
  void publishChange("event");
});

adminRouter.put("/event", requireAdmin, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form", details: parsed.error.flatten() });
    return;
  }
  const event = await latestEvent();
  if (!event) {
    res.status(404).json({ error: "no_event" });
    return;
  }
  if (event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }

  const heldRows = await db
    .select({ n: count() })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(and(eq(tickets.eventId, event.id), ne(orders.status, "cancelled")));
  const held = Number(heldRows[0]?.n ?? 0);
  if (parsed.data.totalTickets < held) {
    res.status(409).json({ error: "total_too_low", held });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(events)
      .set({
        titleFr: parsed.data.titleFr,
        titleEn: parsed.data.titleEn,
        descriptionFr: parsed.data.descriptionFr,
        descriptionEn: parsed.data.descriptionEn,
        paymentInstructionsFr: parsed.data.paymentInstructionsFr,
        paymentInstructionsEn: parsed.data.paymentInstructionsEn,
        ticketPriceCents: parsed.data.ticketPriceCents,
        currency: parsed.data.currency,
        totalTickets: parsed.data.totalTickets,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    await tx.delete(prizes).where(eq(prizes.eventId, event.id));
    if (parsed.data.prizes.length) {
      await tx.insert(prizes).values(
        parsed.data.prizes.map((prize) => ({
          eventId: event.id,
          rank: prize.rank,
          nameFr: prize.nameFr,
          nameEn: prize.nameEn,
          descriptionFr: prize.descriptionFr,
          descriptionEn: prize.descriptionEn,
        })),
      );
    }
    return next;
  });

  res.json({ event: updated });
  void publishChange("event");
});

adminRouter.post("/event/status", requireAdmin, async (req, res) => {
  const status = z.enum(["draft", "on_sale", "closed"]).safeParse(req.body?.status);
  if (!status.success) {
    res.status(400).json({ error: "invalid_status" });
    return;
  }
  const event = await latestEvent();
  if (!event) {
    res.status(404).json({ error: "no_event" });
    return;
  }
  if (event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }
  if (status.data === "on_sale") {
    const prizeCount = await db
      .select({ n: count() })
      .from(prizes)
      .where(eq(prizes.eventId, event.id));
    if (Number(prizeCount[0]?.n ?? 0) < 1) {
      res.status(409).json({ error: "need_prizes" });
      return;
    }
  }
  const [updated] = await db
    .update(events)
    .set({ status: status.data, updatedAt: new Date() })
    .where(eq(events.id, event.id))
    .returning();
  res.json({ event: updated });
  void publishChange("event");
});

adminRouter.get("/orders", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
    res.json({ orders: [] });
    return;
  }
  const rows = await db
    .select({
      id: orders.id,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      buyerPhone: orders.buyerPhone,
      quantity: orders.quantity,
      status: orders.status,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      numbers: sql<number[]>`coalesce(array_agg(${tickets.number} order by ${tickets.number}) filter (where ${tickets.id} is not null), '{}')`,
    })
    .from(orders)
    .leftJoin(tickets, eq(tickets.orderId, orders.id))
    .where(eq(orders.eventId, event.id))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  res.json({ orders: rows });
});

adminRouter.post("/orders/:id/paid", requireAdmin, async (req, res) => {
  const event = await latestEvent();
  const orderId = String(req.params.id ?? "");
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }
  const [order] = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.eventId, event.id),
        eq(orders.status, "reserved"),
      ),
    )
    .returning();
  if (!order) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ order });
  void publishChange("order");
});

adminRouter.post("/orders/:id/cancel", requireAdmin, async (req, res) => {
  const event = await latestEvent();
  const orderId = String(req.params.id ?? "");
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }
  const cancelled = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.eventId, event.id),
          eq(orders.status, "reserved"),
        ),
      )
      .limit(1);
    if (!order) return null;
    await tx.delete(tickets).where(eq(tickets.orderId, order.id));
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
  if (!cancelled) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ order: cancelled });
  void publishChange("order");
});

adminRouter.post("/draw", requireAdmin, async (_req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      const [event] = await tx.select().from(events).orderBy(desc(events.createdAt)).limit(1);
      if (!event) throw Object.assign(new Error("no_event"), { status: 404 });
      if (event.status === "drawn") throw Object.assign(new Error("already_drawn"), { status: 409 });

      const eventPrizes = await tx
        .select()
        .from(prizes)
        .where(eq(prizes.eventId, event.id))
        .orderBy(asc(prizes.rank));
      if (!eventPrizes.length) throw Object.assign(new Error("need_prizes"), { status: 409 });

      const paidTickets = await tx
        .select({
          id: tickets.id,
          number: tickets.number,
        })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(eq(tickets.eventId, event.id), eq(orders.status, "paid")));

      if (!paidTickets.length) throw Object.assign(new Error("no_paid_tickets"), { status: 409 });

      const unpaid = await tx
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.eventId, event.id), eq(orders.status, "reserved")));

      const picked = shuffle(paidTickets);
      const awarded = eventPrizes.slice(0, picked.length);
      const drawnAt = new Date();

      for (let i = 0; i < awarded.length; i += 1) {
        const prize = awarded[i]!;
        const ticket = picked[i]!;
        await tx.update(tickets).set({ prizeId: prize.id }).where(eq(tickets.id, ticket.id));
        await tx.insert(drawResults).values({
          eventId: event.id,
          prizeId: prize.id,
          ticketId: ticket.id,
          drawnAt,
        });
      }

      await tx
        .update(events)
        .set({ status: "drawn", updatedAt: drawnAt })
        .where(eq(events.id, event.id));

      return {
        unpaidOrders: Number(unpaid[0]?.n ?? 0),
        awarded: awarded.length,
        prizes: eventPrizes.length,
      };
    });
    res.json(result);
    void publishChange("draw");
    void emailDrawWinners();
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

async function emailDrawWinners() {
  const event = await latestEvent();
  if (!event || event.status !== "drawn") return;

  const winners = await db
    .select({
      rank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      accessToken: orders.accessToken,
    })
    .from(drawResults)
    .innerJoin(prizes, eq(drawResults.prizeId, prizes.id))
    .innerJoin(tickets, eq(drawResults.ticketId, tickets.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(eq(drawResults.eventId, event.id))
    .orderBy(asc(prizes.rank));

  await notifyTombolaWinners(
    winners.map((winner) => ({
      name: winner.buyerName,
      email: winner.buyerEmail,
      eventTitleFr: event.titleFr,
      eventTitleEn: event.titleEn,
      prizeNameFr: winner.prizeNameFr,
      prizeNameEn: winner.prizeNameEn,
      rank: winner.rank,
      ticketNumber: winner.ticketNumber,
      ticketsUrl: siteUrl(`/fr/tickets/${winner.accessToken}`),
    })),
  );
}

adminRouter.get("/winners", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
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
      buyerEmail: orders.buyerEmail,
    })
    .from(drawResults)
    .innerJoin(prizes, eq(drawResults.prizeId, prizes.id))
    .innerJoin(tickets, eq(drawResults.ticketId, tickets.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(eq(drawResults.eventId, event.id))
    .orderBy(asc(prizes.rank));
  res.json({ event, winners });
});

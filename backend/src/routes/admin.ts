import { and, asc, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { drawResults, events, members, orders, prizes, tickets } from "../db/schema.js";
import { adminEmailMatches, clearSession, passwordMatches, requireAdmin, setSession } from "../lib/auth.js";
import { shuffle } from "../lib/tickets.js";
import { publishChange } from "../lib/publicSnapshot.js";
import { notifyDrawResults } from "../lib/mail.js";
import { siteUrl } from "../emails/layout.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";

export const adminRouter = Router();

const eventSchema = z.object({
  titleFr: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().max(120).optional().or(z.literal("")),
  descriptionFr: z.string().trim().max(2000).default(""),
  descriptionEn: z.string().trim().max(2000).optional().or(z.literal("")),
  paymentInstructionsFr: z.string().trim().max(2000).default(""),
  paymentInstructionsEn: z.string().trim().max(2000).optional().or(z.literal("")),
  ticketPriceCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(8).default("XOF"),
  totalTickets: z.number().int().min(1).max(10000),
  prizes: z
    .array(
      z.object({
        rank: z.number().int().min(1),
        nameFr: z.string().trim().max(120).default(""),
        nameEn: z.string().trim().max(120).optional().or(z.literal("")),
        descriptionFr: z.string().trim().max(500).default(""),
        descriptionEn: z.string().trim().max(500).optional().or(z.literal("")),
      }),
    )
    .max(200),
});

function withFallbackLang(data: z.infer<typeof eventSchema>) {
  return {
    ...data,
    titleEn: data.titleEn?.trim() || data.titleFr,
    descriptionEn: data.descriptionEn?.trim() || data.descriptionFr,
    paymentInstructionsEn: data.paymentInstructionsEn?.trim() || data.paymentInstructionsFr,
    prizes: data.prizes
      .filter((prize) => prize.nameFr.trim())
      .map((prize, index) => ({
        ...prize,
        rank: index + 1,
        nameEn: prize.nameEn?.trim() || prize.nameFr,
        descriptionEn: prize.descriptionEn?.trim() || prize.descriptionFr,
      })),
  };
}

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

async function contestantsFor(eventId: string) {
  return db
    .select({
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
      avatarUrl: members.avatarUrl,
    })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .leftJoin(members, eq(orders.memberId, members.id))
    .where(and(eq(tickets.eventId, eventId), eq(orders.status, "paid")))
    .orderBy(asc(tickets.number));
}

async function winnersFor(eventId: string) {
  return db
    .select({
      rank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      avatarUrl: members.avatarUrl,
    })
    .from(drawResults)
    .innerJoin(prizes, eq(drawResults.prizeId, prizes.id))
    .innerJoin(tickets, eq(drawResults.ticketId, tickets.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .leftJoin(members, eq(orders.memberId, members.id))
    .where(eq(drawResults.eventId, eventId))
    .orderBy(asc(prizes.rank));
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

  const [scratched] = await db
    .select({ n: count() })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(and(eq(tickets.eventId, eventId), eq(orders.status, "paid"), isNotNull(tickets.scratchedAt)));

  return {
    paidOrders,
    reservedOrders,
    paidTickets,
    reservedTickets,
    remainingTickets: Math.max(0, totalTickets - paidTickets - reservedTickets),
    scratchedTickets: Number(scratched?.n ?? 0),
  };
}

adminRouter.post("/login", (req, res) => {
  if (!allowRequest(`admin-login:${clientKey(req)}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = z
    .object({
      email: z.string().trim().email().max(120),
      password: z.string().min(1).max(200),
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
  const data = withFallbackLang(parsed.data);
  const current = await latestEvent();
  if (current && current.status !== "drawn") {
    res.status(409).json({ error: "active_event_exists" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        slug: slugify(data.titleFr),
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        descriptionFr: data.descriptionFr,
        descriptionEn: data.descriptionEn,
        paymentInstructionsFr: data.paymentInstructionsFr,
        paymentInstructionsEn: data.paymentInstructionsEn,
        ticketPriceCents: data.ticketPriceCents,
        currency: data.currency,
        totalTickets: data.totalTickets,
        status: data.prizes.length ? "on_sale" : "draft",
      })
      .returning();
    if (!event) throw new Error("create_failed");
    if (data.prizes.length) {
      await tx.insert(prizes).values(
        data.prizes.map((prize) => ({
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
  const data = withFallbackLang(parsed.data);
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
  if (data.totalTickets < held) {
    res.status(409).json({ error: "total_too_low", held });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(events)
      .set({
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        descriptionFr: data.descriptionFr,
        descriptionEn: data.descriptionEn,
        paymentInstructionsFr: data.paymentInstructionsFr,
        paymentInstructionsEn: data.paymentInstructionsEn,
        ticketPriceCents: data.ticketPriceCents,
        currency: data.currency,
        totalTickets: data.totalTickets,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    await tx.delete(prizes).where(eq(prizes.eventId, event.id));
    if (data.prizes.length) {
      await tx.insert(prizes).values(
        data.prizes.map((prize) => ({
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
      paymentMethod: orders.paymentMethod,
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
  if (!z.string().uuid().safeParse(orderId).success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
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
  const { accessToken: _accessToken, ...safeOrder } = order;
  res.json({ order: safeOrder });
  void publishChange("order");
});

adminRouter.post("/orders/:id/cancel", requireAdmin, async (req, res) => {
  const event = await latestEvent();
  const orderId = String(req.params.id ?? "");
  if (!z.string().uuid().safeParse(orderId).success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
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
  const { accessToken: _accessToken, ...safeOrder } = cancelled;
  res.json({ order: safeOrder });
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
    const event = await latestEvent();
    const winners = event ? await winnersFor(event.id) : [];
    res.json({ ...result, winners });
    void publishChange("draw");
    void emailDrawResults();
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

async function emailDrawResults() {
  const event = await latestEvent();
  if (!event || event.status !== "drawn") return;

  const prizesWon = await db
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

  const board = prizesWon.map((prize) => ({
    rank: prize.rank,
    prizeNameFr: prize.prizeNameFr,
    prizeNameEn: prize.prizeNameEn,
    ticketNumber: prize.ticketNumber,
    buyerName: prize.buyerName,
  }));

  const paidBuyers = await db
    .select({
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      accessToken: orders.accessToken,
    })
    .from(orders)
    .where(and(eq(orders.eventId, event.id), eq(orders.status, "paid")));

  const recipients = [];
  const seen = new Set<string>();
  for (const buyer of paidBuyers) {
    const email = buyer.buyerEmail.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const wins = prizesWon
      .filter((prize) => prize.buyerEmail.trim().toLowerCase() === email)
      .map((prize) => ({
        rank: prize.rank,
        prizeNameFr: prize.prizeNameFr,
        prizeNameEn: prize.prizeNameEn,
        ticketNumber: prize.ticketNumber,
        buyerName: prize.buyerName,
      }));
    const token = prizesWon.find((prize) => prize.buyerEmail.trim().toLowerCase() === email)?.accessToken
      ?? buyer.accessToken;
    recipients.push({
      name: buyer.buyerName,
      email: buyer.buyerEmail,
      eventTitleFr: event.titleFr,
      eventTitleEn: event.titleEn,
      ticketsUrl: siteUrl(`/fr/tickets/${token}`),
      prizes: board,
      wins,
    });
  }

  await notifyDrawResults(recipients);
}

adminRouter.get("/contestants", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
    res.json({ contestants: [] });
    return;
  }
  res.json({ contestants: await contestantsFor(event.id) });
});

adminRouter.get("/winners", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
    res.json({ winners: [] });
    return;
  }
  res.json({ event, winners: await winnersFor(event.id) });
});

adminRouter.get("/scratches", requireAdmin, async (_req, res) => {
  const event = await latestEvent();
  if (!event) {
    res.json({ scratches: [] });
    return;
  }
  const rows = await db
    .select({
      ticketNumber: tickets.number,
      buyerName: orders.buyerName,
      scratchedAt: tickets.scratchedAt,
      prizeRank: prizes.rank,
      prizeNameFr: prizes.nameFr,
      prizeNameEn: prizes.nameEn,
    })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .leftJoin(prizes, eq(prizes.id, tickets.prizeId))
    .where(and(eq(tickets.eventId, event.id), isNotNull(tickets.scratchedAt)))
    .orderBy(desc(tickets.scratchedAt));

  res.json({
    scratches: rows.map((row) => ({
      ticketNumber: row.ticketNumber,
      buyerName: row.buyerName,
      scratchedAt: row.scratchedAt?.toISOString() ?? null,
      prizeRank: row.prizeRank,
      prizeNameFr: row.prizeNameFr,
      prizeNameEn: row.prizeNameEn,
    })),
  });
});

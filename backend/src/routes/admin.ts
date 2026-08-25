import { and, asc, count, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { donations, drawResults, events, members, orders, prizes, tickets } from "../db/schema.js";
import { adminEmailMatches, issueAdminAuth, newAccessToken, passwordMatches, requireAdmin, revokeAdminAuth } from "../lib/auth.js";
import {
  shuffle,
  randomTicketNumbers,
  drawModeOf,
  publicPrizes,
  sealWinningNumbers,
  attachPrizesToTickets,
  prizeAssignmentsOf,
  prizesAreSealed,
  heldSeatCount,
} from "../lib/tickets.js";
import { publishChange } from "../lib/publicSnapshot.js";
import { notifyDrawResults, notifyPurchase } from "../lib/mail.js";
import { siteUrl } from "../emails/layout.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";
import { registerAdminPushRoutes } from "./adminPush.js";
import { registerAdminQcmRoutes } from "./qcmAdmin.js";

export const adminRouter = Router();
registerAdminPushRoutes(adminRouter);
registerAdminQcmRoutes(adminRouter);

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
  drawMode: z.enum(["scratch", "roulette"]).default("scratch"),
  salesOpensAt: z.string().datetime().nullable().optional(),
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

async function requestedEventId(req: Request) {
  const fromQuery = req.query.eventId;
  const queryId = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  if (typeof queryId === "string" && z.string().uuid().safeParse(queryId).success) return queryId;
  const bodyId = req.body && typeof req.body === "object" ? (req.body as { eventId?: unknown }).eventId : undefined;
  if (typeof bodyId === "string" && z.string().uuid().safeParse(bodyId).success) return bodyId;
  return null;
}

async function preferredEvent() {
  const [onSale] = await db
    .select()
    .from(events)
    .where(eq(events.status, "on_sale"))
    .orderBy(desc(events.createdAt))
    .limit(1);
  if (onSale) return onSale;
  const [open] = await db
    .select()
    .from(events)
    .where(inArray(events.status, ["draft", "closed"]))
    .orderBy(desc(events.createdAt))
    .limit(1);
  if (open) return open;
  const [any] = await db.select().from(events).orderBy(desc(events.createdAt)).limit(1);
  return any ?? null;
}

async function latestEvent(req?: Request) {
  const id = req ? await requestedEventId(req) : null;
  if (id) {
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (event) return event;
  }
  return preferredEvent();
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

  const prizeRows = await db.select({ ticketNumber: prizes.ticketNumber }).from(prizes).where(eq(prizes.eventId, eventId));
  const prizeCount = prizeRows.length;
  const sealedCount = prizeRows.filter((row) => row.ticketNumber != null).length;

  return {
    paidOrders,
    reservedOrders,
    paidTickets,
    reservedTickets,
    remainingTickets: Math.max(0, totalTickets - paidTickets - reservedTickets),
    scratchedTickets: Number(scratched?.n ?? 0),
    prizeCount,
    prizesSealed: prizeCount > 0 && sealedCount === prizeCount,
  };
}

adminRouter.post("/login", async (req, res) => {
  if (!(await allowRequest(`admin-login:${clientKey(req)}`, 10, 15 * 60 * 1000))) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = z
    .object({
      email: z.string().trim().email().max(120),
      password: z.string().min(1).max(200),
    })
    .safeParse(req.body);
  if (!parsed.success || !adminEmailMatches(parsed.data.email) || !(await passwordMatches(parsed.data.password))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  await issueAdminAuth(res);
  res.json({ ok: true });
});

adminRouter.post("/logout", async (req, res) => {
  await revokeAdminAuth(req, res);
  res.json({ ok: true });
});

adminRouter.post("/refresh", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get("/me", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get("/events", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: events.id,
      titleFr: events.titleFr,
      titleEn: events.titleEn,
      status: events.status,
      totalTickets: events.totalTickets,
      createdAt: events.createdAt,
    })
    .from(events)
    .orderBy(desc(events.createdAt));
  res.json({
    events: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});

adminRouter.get("/event", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
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
  res.json({ event, prizes: publicPrizes(eventPrizes), stats });
});

adminRouter.post("/event", requireAdmin, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form", details: parsed.error.flatten() });
    return;
  }
  const data = withFallbackLang(parsed.data);
  const [onSale] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.status, "on_sale"))
    .limit(1);

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
        drawMode: data.drawMode,
        status: data.prizes.length && !onSale ? "on_sale" : "draft",
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
  const event = await latestEvent(req);
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
        drawMode: data.drawMode,
        salesOpensAt: data.salesOpensAt ? new Date(data.salesOpensAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    const priorPrizes = await tx
      .select({ rank: prizes.rank, ticketNumber: prizes.ticketNumber })
      .from(prizes)
      .where(eq(prizes.eventId, event.id));
    const priorByRank = new Map(
      priorPrizes
        .filter((prize) => prize.ticketNumber != null)
        .map((prize) => [prize.rank, prize.ticketNumber as number]),
    );

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

    if (drawModeOf(data.drawMode) === "scratch") {
      const nextPrizes = await tx.select().from(prizes).where(eq(prizes.eventId, event.id));
      for (const prize of nextPrizes) {
        const ticketNumber = priorByRank.get(prize.rank);
        if (ticketNumber && ticketNumber >= 1 && ticketNumber <= data.totalTickets) {
          await tx.update(prizes).set({ ticketNumber }).where(eq(prizes.id, prize.id));
        }
      }
      await attachPrizesToTickets(tx, event.id);
    } else if (drawModeOf(event.drawMode) === "scratch") {
      await tx.update(tickets).set({ prizeId: null }).where(eq(tickets.eventId, event.id));
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
  const event = await latestEvent(req);
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
    const [other] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.status, "on_sale"), ne(events.id, event.id)))
      .limit(1);
    if (other) {
      res.status(409).json({ error: "another_on_sale" });
      return;
    }
  }
  try {
    const [updated] = await db
      .update(events)
      .set({ status: status.data, updatedAt: new Date() })
      .where(eq(events.id, event.id))
      .returning();
    res.json({ event: updated });
    void publishChange("event");
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "another_on_sale" });
      return;
    }
    throw error;
  }
});

adminRouter.delete("/event", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  if (!event) {
    res.status(404).json({ error: "no_event" });
    return;
  }
  if (event.status !== "closed" && event.status !== "drawn") {
    res.status(409).json({ error: "event_not_finished" });
    return;
  }
  await db.delete(events).where(eq(events.id, event.id));
  res.json({ ok: true });
  void publishChange("event");
});

adminRouter.get("/orders", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
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
      paymentRef: orders.paymentRef,
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

const physicalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^[0-9+().\s-]+$/),
  quantity: z.number().int().min(1).max(50),
});

adminRouter.post("/orders/physical", requireAdmin, async (req, res) => {
  const parsed = physicalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const event = await latestEvent(req);
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}::text))`);
      const held = await heldSeatCount(tx, event.id);
      if (parsed.data.quantity > event.totalTickets - held) {
        throw Object.assign(new Error("not_enough_tickets"), { status: 409 });
      }
      const usedRows = await tx
        .select({ number: tickets.number })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(eq(tickets.eventId, event.id), ne(orders.status, "cancelled")));
      const numbers = randomTicketNumbers(
        usedRows.map((row) => row.number),
        event.totalTickets,
        parsed.data.quantity,
      );
      if (numbers.length < parsed.data.quantity) {
        throw Object.assign(new Error("not_enough_tickets"), { status: 409 });
      }
      const [order] = await tx
        .insert(orders)
        .values({
          eventId: event.id,
          memberId: null,
          buyerName: parsed.data.name,
          buyerEmail: "",
          buyerPhone: parsed.data.phone?.trim() || null,
          quantity: parsed.data.quantity,
          paymentMethod: "physical",
          status: "paid",
          paidAt: new Date(),
          accessToken: newAccessToken(),
        })
        .returning();
      if (!order) throw new Error("order_failed");
      await tx.insert(tickets).values(
        numbers.map((number) => ({
          eventId: event.id,
          orderId: order.id,
          number,
        })),
      );
      if (drawModeOf(event.drawMode) === "scratch") {
        await attachPrizesToTickets(tx, event.id);
      }
      const [paidRow] = await tx
        .select({ n: count() })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(eq(tickets.eventId, event.id), eq(orders.status, "paid")));
      if (event.status === "on_sale" && Number(paidRow?.n ?? 0) >= event.totalTickets) {
        await tx.update(events).set({ status: "closed", updatedAt: new Date() }).where(eq(events.id, event.id));
      }
      return { order, numbers };
    });
    const { accessToken: _accessToken, ...safeOrder } = created.order;
    res.status(201).json({ order: { ...safeOrder, numbers: created.numbers } });
    void publishChange("order");
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.message === "not_enough_tickets") {
      res.status(409).json({ error: "not_enough_tickets" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

adminRouter.post("/orders/:id/paid", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  const orderId = String(req.params.id ?? "");
  if (!z.string().uuid().safeParse(orderId).success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }

  try {
    const marked = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}::text))`);

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
      if (!order) {
        throw Object.assign(new Error("not_found"), { status: 404 });
      }

      const existingTickets = await tx
        .select({ number: tickets.number })
        .from(tickets)
        .where(eq(tickets.orderId, order.id));

      let numbers = existingTickets.map((row) => row.number).sort((a, b) => a - b);
      if (!numbers.length) {
        const usedRows = await tx
          .select({ number: tickets.number })
          .from(tickets)
          .innerJoin(orders, eq(tickets.orderId, orders.id))
          .where(and(eq(tickets.eventId, event.id), ne(orders.status, "cancelled")));
        numbers = randomTicketNumbers(
          usedRows.map((row) => row.number),
          event.totalTickets,
          order.quantity,
        );
        if (numbers.length < order.quantity) {
          throw Object.assign(new Error("not_enough_tickets"), { status: 409 });
        }
        await tx.insert(tickets).values(
          numbers.map((number) => ({
            eventId: event.id,
            orderId: order.id,
            number,
          })),
        );
      }

      const [updated] = await tx
        .update(orders)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(orders.id, order.id))
        .returning();
      if (!updated) {
        throw Object.assign(new Error("not_found"), { status: 404 });
      }

      if (drawModeOf(event.drawMode) === "scratch") {
        await attachPrizesToTickets(tx, event.id);
      }

      const [paidRow] = await tx
        .select({ n: count() })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(eq(tickets.eventId, event.id), eq(orders.status, "paid")));
      if (event.status === "on_sale" && Number(paidRow?.n ?? 0) >= event.totalTickets) {
        await tx
          .update(events)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(events.id, event.id));
      }

      return { order: updated, numbers, event };
    });

    const { accessToken: _accessToken, ...safeOrder } = marked.order;
    res.json({ order: { ...safeOrder, numbers: marked.numbers } });
    void publishChange("order");
    if (marked.order.paymentMethod !== "physical" && marked.order.buyerEmail.includes("@")) {
      void notifyPurchase({
        name: marked.order.buyerName,
        email: marked.order.buyerEmail,
        memberId: marked.order.memberId,
        eventTitleFr: marked.event.titleFr,
        eventTitleEn: marked.event.titleEn,
        quantity: marked.order.quantity,
        ticketPriceCents: marked.event.ticketPriceCents,
        currency: marked.event.currency,
        numbers: marked.numbers,
        paymentMethod: marked.order.paymentMethod,
        paymentRef: marked.order.paymentRef,
        paidAt: marked.order.paidAt?.toISOString() ?? new Date().toISOString(),
        drawMode: drawModeOf(marked.event.drawMode),
        ticketsUrl: siteUrl(
          marked.order.memberId
            ? `/fr/my-tickets/${marked.event.id}`
            : `/fr/tickets/${marked.order.accessToken}`,
        ),
      });
    } else if (marked.order.memberId) {
      void notifyPurchase({
        name: marked.order.buyerName,
        email: "",
        memberId: marked.order.memberId,
        eventTitleFr: marked.event.titleFr,
        eventTitleEn: marked.event.titleEn,
        quantity: marked.order.quantity,
        ticketPriceCents: marked.event.ticketPriceCents,
        currency: marked.event.currency,
        numbers: marked.numbers,
        paymentMethod: marked.order.paymentMethod,
        paymentRef: marked.order.paymentRef,
        paidAt: marked.order.paidAt?.toISOString() ?? new Date().toISOString(),
        drawMode: drawModeOf(marked.event.drawMode),
        ticketsUrl: siteUrl(`/fr/my-tickets/${marked.event.id}`),
      });
    }
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.message === "not_found") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (err.message === "not_enough_tickets") {
      res.status(409).json({ error: "not_enough_tickets" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

adminRouter.post("/orders/:id/unpaid", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  const orderId = String(req.params.id ?? "");
  if (!z.string().uuid().safeParse(orderId).success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  if (!event || event.status === "drawn") {
    res.status(409).json({ error: "event_locked" });
    return;
  }
  try {
    const reversed = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.eventId, event.id),
            eq(orders.status, "paid"),
          ),
        )
        .limit(1);
      if (!order) return null;
      const [scratched] = await tx
        .select({ n: count() })
        .from(tickets)
        .where(and(eq(tickets.orderId, order.id), isNotNull(tickets.scratchedAt)));
      if (Number(scratched?.n ?? 0) > 0) {
        throw Object.assign(new Error("already_scratched"), { status: 409 });
      }
      await tx.delete(tickets).where(eq(tickets.orderId, order.id));
      const [updated] = await tx
        .update(orders)
        .set({ status: "reserved", paidAt: null })
        .where(eq(orders.id, order.id))
        .returning();
      return updated;
    });
    if (!reversed) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { accessToken: _accessToken, ...safeOrder } = reversed;
    res.json({ order: safeOrder });
    void publishChange("order");
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.message === "already_scratched") {
      res.status(409).json({ error: "already_scratched" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error" });
  }
});

adminRouter.post("/orders/:id/cancel", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
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

adminRouter.get("/assignments", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  if (!event) {
    res.json({ sealed: false, totalTickets: 0, assignments: [] });
    return;
  }
  const eventPrizes = await db
    .select()
    .from(prizes)
    .where(eq(prizes.eventId, event.id))
    .orderBy(asc(prizes.rank));
  res.json({
    sealed: prizesAreSealed(eventPrizes, event.totalTickets),
    totalTickets: event.totalTickets,
    assignments: prizeAssignmentsOf(eventPrizes),
  });
});

adminRouter.post("/seal", requireAdmin, async (req, res) => {
  try {
    const selected = await latestEvent(req);
    const result = await db.transaction(async (tx) => {
      const [event] = selected
        ? await tx.select().from(events).where(eq(events.id, selected.id)).limit(1)
        : [];
      if (!event) throw Object.assign(new Error("no_event"), { status: 404 });
      if (event.status === "drawn") throw Object.assign(new Error("event_locked"), { status: 409 });
      if (drawModeOf(event.drawMode) !== "scratch") throw Object.assign(new Error("not_scratch"), { status: 409 });

      const eventPrizes = await tx
        .select()
        .from(prizes)
        .where(eq(prizes.eventId, event.id))
        .orderBy(asc(prizes.rank));
      if (!eventPrizes.length) throw Object.assign(new Error("need_prizes"), { status: 409 });

      if (!prizesAreSealed(eventPrizes, event.totalTickets)) {
        const anySealed = eventPrizes.some((prize) => prize.ticketNumber != null);
        await sealWinningNumbers(tx, event, { reshuffle: !anySealed });
        await attachPrizesToTickets(tx, event.id);
      }

      const nextPrizes = await tx
        .select()
        .from(prizes)
        .where(eq(prizes.eventId, event.id))
        .orderBy(asc(prizes.rank));
      return {
        sealed: prizesAreSealed(nextPrizes, event.totalTickets),
        totalTickets: event.totalTickets,
        assignments: prizeAssignmentsOf(nextPrizes),
      };
    });
    res.json(result);
    void publishChange("event");
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

adminRouter.post("/draw", requireAdmin, async (req, res) => {
  try {
    const selected = await latestEvent(req);
    const result = await db.transaction(async (tx) => {
      const [event] = selected
        ? await tx.select().from(events).where(eq(events.id, selected.id)).limit(1)
        : [];
      if (!event) throw Object.assign(new Error("no_event"), { status: 404 });
      if (event.status === "drawn") throw Object.assign(new Error("already_drawn"), { status: 409 });
      if (event.status !== "closed") throw Object.assign(new Error("sales_open"), { status: 409 });

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

      const drawnAt = new Date();
      const scratch = drawModeOf(event.drawMode) === "scratch";

      if (scratch) {
        const sealed = eventPrizes.every(
          (prize) => prize.ticketNumber && prize.ticketNumber >= 1 && prize.ticketNumber <= event.totalTickets,
        );
        if (!sealed) throw Object.assign(new Error("need_assignment"), { status: 409 });
        await attachPrizesToTickets(tx, event.id);
        const winners = await tx
          .select({ id: tickets.id, prizeId: tickets.prizeId })
          .from(tickets)
          .innerJoin(orders, eq(tickets.orderId, orders.id))
          .where(
            and(eq(tickets.eventId, event.id), eq(orders.status, "paid"), isNotNull(tickets.prizeId)),
          );
        for (const ticket of winners) {
          if (!ticket.prizeId) continue;
          await tx.insert(drawResults).values({
            eventId: event.id,
            prizeId: ticket.prizeId,
            ticketId: ticket.id,
            drawnAt,
          });
        }
        await tx.update(events).set({ status: "drawn", updatedAt: drawnAt }).where(eq(events.id, event.id));
        return {
          eventId: event.id,
          unpaidOrders: Number(unpaid[0]?.n ?? 0),
          awarded: winners.length,
          prizes: eventPrizes.length,
        };
      }

      const picked = shuffle(paidTickets);
      const awarded = eventPrizes.slice(0, picked.length);

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
        eventId: event.id,
        unpaidOrders: Number(unpaid[0]?.n ?? 0),
        awarded: awarded.length,
        prizes: eventPrizes.length,
      };
    });
    const winners = await winnersFor(result.eventId);
    res.json({ ...result, winners });
    void publishChange("draw");
    void emailDrawResults(result.eventId);
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

async function emailDrawResults(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
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
      memberId: orders.memberId,
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
      memberId: buyer.memberId,
      eventTitleFr: event.titleFr,
      eventTitleEn: event.titleEn,
      ticketsUrl: siteUrl(
        buyer.memberId ? `/fr/my-tickets/${event.id}` : `/fr/tickets/${token}`,
      ),
      prizes: board,
      wins,
      drawMode: event.drawMode === "roulette" ? ("roulette" as const) : ("scratch" as const),
    });
  }

  await notifyDrawResults(recipients);
}

adminRouter.get("/contestants", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  if (!event) {
    res.json({ contestants: [] });
    return;
  }
  res.json({ contestants: await contestantsFor(event.id) });
});

adminRouter.get("/winners", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
  if (!event) {
    res.json({ winners: [] });
    return;
  }
  res.json({ event, winners: await winnersFor(event.id) });
});

adminRouter.get("/scratches", requireAdmin, async (req, res) => {
  const event = await latestEvent(req);
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

adminRouter.get("/donations", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(donations).orderBy(desc(donations.createdAt));
  res.json({
    donations: rows.map((row) => ({
      id: row.id,
      donorName: row.donorName,
      donorEmail: row.donorEmail,
      donorPhone: row.donorPhone,
      amountCents: row.amountCents,
      paymentMethod: row.paymentMethod,
      paymentRef: row.paymentRef,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      receivedAt: row.receivedAt?.toISOString() ?? null,
    })),
  });
});

adminRouter.post("/donations/:id/received", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const [updated] = await db
    .update(donations)
    .set({ status: "received", receivedAt: new Date() })
    .where(and(eq(donations.id, id), eq(donations.status, "pending")))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    donation: {
      id: updated.id,
      donorName: updated.donorName,
      donorEmail: updated.donorEmail,
      donorPhone: updated.donorPhone,
      amountCents: updated.amountCents,
      paymentMethod: updated.paymentMethod,
      paymentRef: updated.paymentRef,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      receivedAt: updated.receivedAt?.toISOString() ?? null,
    },
  });
  void publishChange("order");
});

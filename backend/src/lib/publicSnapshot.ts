import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, orders, prizes } from "../db/schema.js";
import { broadcast } from "./realtime.js";
import { drawModeOf } from "./tickets.js";
import { salesAreOpen } from "./rateLimit.js";

export async function getCurrentPublicEvent() {
  const [event] = await db
    .select()
    .from(events)
    .where(inArray(events.status, ["on_sale", "closed", "drawn"]))
    .orderBy(
      sql`case ${events.status} when 'on_sale' then 0 when 'closed' then 1 else 2 end`,
      desc(events.createdAt),
    )
    .limit(1);
  return event ?? null;
}

async function ticketStats(eventId: string) {
  const rows = await db
    .select({
      status: orders.status,
      n: sql<number>`coalesce(sum(${orders.quantity}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), ne(orders.status, "cancelled")))
    .groupBy(orders.status);
  let paid = 0;
  let reserved = 0;
  for (const row of rows) {
    const n = Number(row.n ?? 0);
    if (row.status === "paid") paid = n;
    if (row.status === "reserved") reserved = n;
  }
  return { paid, reserved, held: paid + reserved };
}

export async function publicSnapshot() {
  const event = await getCurrentPublicEvent();
  if (!event) return null;
  const eventPrizes = await db
    .select()
    .from(prizes)
    .where(eq(prizes.eventId, event.id))
    .orderBy(asc(prizes.rank));
  const stats = await ticketStats(event.id);
  const open = salesAreOpen(event.salesOpensAt);
  return {
    id: event.id,
    slug: event.slug,
    status: event.status,
    salesOpensAt: event.salesOpensAt?.toISOString() ?? null,
    salesOpen: open,
    titleFr: event.titleFr,
    titleEn: event.titleEn,
    descriptionFr: event.descriptionFr,
    descriptionEn: event.descriptionEn,
    paymentInstructionsFr: event.paymentInstructionsFr,
    paymentInstructionsEn: event.paymentInstructionsEn,
    ticketPriceCents: event.ticketPriceCents,
    currency: event.currency,
    totalTickets: event.totalTickets,
    remainingTickets: Math.max(0, event.totalTickets - stats.held),
    paidTickets: stats.paid,
    reservedTickets: stats.reserved,
    drawMode: drawModeOf(event.drawMode),
    prizes: eventPrizes.map((prize) => ({
      id: prize.id,
      rank: prize.rank,
      nameFr: prize.nameFr,
      nameEn: prize.nameEn,
      descriptionFr: prize.descriptionFr,
      descriptionEn: prize.descriptionEn,
    })),
  };
}

export async function publishChange(reason: "order" | "event" | "draw" | "scratch") {
  const event = await publicSnapshot();
  broadcast({ type: "public.snapshot", event });
  broadcast({ type: "organizer.changed", reason }, "organizer");
  if (reason === "draw") {
    broadcast({ type: "draw.done" });
  }
}

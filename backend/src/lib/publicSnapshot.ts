import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, orders, prizes, tickets } from "../db/schema.js";
import { currentClub } from "./club.js";
import { broadcast } from "./realtime.js";
import { drawModeOf } from "./tickets.js";

export async function getCurrentPublicEvent(clubId?: string) {
  const [event] = await db
    .select()
    .from(events)
    .where(
      clubId
        ? and(eq(events.clubId, clubId), inArray(events.status, ["on_sale", "closed", "drawn"]))
        : inArray(events.status, ["on_sale", "closed", "drawn"]),
    )
    .orderBy(
      sql`case ${events.status} when 'on_sale' then 0 when 'closed' then 1 else 2 end`,
      desc(events.createdAt),
    )
    .limit(1);
  return event ?? null;
}

async function ticketStats(eventId: string) {
  const [paidRow] = await db
    .select({ tickets: count(tickets.id) })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(and(eq(tickets.eventId, eventId), eq(orders.status, "paid")));
  const paid = Number(paidRow?.tickets ?? 0);
  return { paid, reserved: 0, held: paid };
}

export async function publicSnapshot(clubId?: string) {
  const event = await getCurrentPublicEvent(clubId ?? currentClub()?.id);
  if (!event) return null;
  const eventPrizes = await db
    .select()
    .from(prizes)
    .where(eq(prizes.eventId, event.id))
    .orderBy(asc(prizes.rank));
  const stats = await ticketStats(event.id);
  return {
    id: event.id,
    slug: event.slug,
    status: event.status,
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

export async function publishChange(reason: "order" | "event" | "draw" | "scratch", clubId?: string) {
  const id = clubId ?? currentClub()?.id;
  const event = await publicSnapshot(id);
  broadcast({ type: "public.snapshot", event }, undefined, id);
  broadcast({ type: "organizer.changed", reason }, "organizer", id);
  if (reason === "draw") {
    broadcast({ type: "draw.done" }, undefined, id);
  }
}

import { randomInt } from "node:crypto";
import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders, prizes, tickets } from "../db/schema.js";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function heldSeatCount(tx: DbTx | typeof db, eventId: string) {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${orders.quantity}), 0)` })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), ne(orders.status, "cancelled")));
  return Number(row?.n ?? 0);
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export type DrawMode = "scratch" | "roulette";

export function drawModeOf(value: string | null | undefined): DrawMode {
  return value === "roulette" ? "roulette" : "scratch";
}

export function maskScratchPrizes<
  T extends {
    prizeId?: string | null;
    prizeRank?: number | null;
    prizeNameFr?: string | null;
    prizeNameEn?: string | null;
    scratchedAt?: Date | string | null;
  },
>(rows: T[], mode: DrawMode): T[] {
  if (mode !== "scratch") return rows;
  return rows.map((ticket) => {
    if (ticket.scratchedAt) return ticket;
    return {
      ...ticket,
      prizeId: null,
      prizeRank: null,
      prizeNameFr: null,
      prizeNameEn: null,
    };
  });
}

export function nextTicketNumbers(used: number[], total: number, quantity: number) {
  const taken = new Set(used);
  const numbers: number[] = [];
  for (let n = 1; n <= total && numbers.length < quantity; n += 1) {
    if (!taken.has(n)) numbers.push(n);
  }
  return numbers;
}

export function randomTicketNumbers(used: number[], total: number, quantity: number) {
  const taken = new Set(used);
  const pool: number[] = [];
  for (let n = 1; n <= total; n += 1) {
    if (!taken.has(n)) pool.push(n);
  }
  if (pool.length < quantity) return [];
  return shuffle(pool).slice(0, quantity);
}

export function publicPrizes<T extends { ticketNumber?: number | null }>(rows: T[]) {
  return rows.map(({ ticketNumber: _ticketNumber, ...prize }) => prize);
}

async function inheritWinningNumbersFromTickets(tx: DbTx, eventId: string) {
  const assigned = await tx
    .select({ prizeId: tickets.prizeId, number: tickets.number })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventId), isNotNull(tickets.prizeId)));
  if (!assigned.length) return;

  const eventPrizes = await tx.select().from(prizes).where(eq(prizes.eventId, eventId));
  const used = new Set(
    eventPrizes
      .map((prize) => prize.ticketNumber)
      .filter((number): number is number => number != null),
  );
  for (const row of assigned) {
    if (!row.prizeId) continue;
    const prize = eventPrizes.find((item) => item.id === row.prizeId);
    if (!prize || prize.ticketNumber || used.has(row.number)) continue;
    await tx.update(prizes).set({ ticketNumber: row.number }).where(eq(prizes.id, prize.id));
    prize.ticketNumber = row.number;
    used.add(row.number);
  }
}

export async function sealWinningNumbers(
  tx: DbTx,
  event: { id: string; totalTickets: number; drawMode: string },
  options: { reshuffle: boolean },
) {
  if (drawModeOf(event.drawMode) !== "scratch") return;

  if (!options.reshuffle) {
    await inheritWinningNumbersFromTickets(tx, event.id);
  }

  const eventPrizes = await tx.select().from(prizes).where(eq(prizes.eventId, event.id)).orderBy(asc(prizes.rank));
  if (!eventPrizes.length) return;

  if (options.reshuffle) {
    await tx.update(prizes).set({ ticketNumber: null }).where(eq(prizes.eventId, event.id));
    const pool = shuffle([...Array(event.totalTickets).keys()].map((index) => index + 1));
    for (let i = 0; i < eventPrizes.length; i += 1) {
      await tx.update(prizes).set({ ticketNumber: pool[i] ?? null }).where(eq(prizes.id, eventPrizes[i]!.id));
    }
    return;
  }

  const used = new Set<number>();
  const keep = new Set<string>();
  for (const prize of eventPrizes) {
    const number = prize.ticketNumber;
    if (number && number >= 1 && number <= event.totalTickets && !used.has(number)) {
      used.add(number);
      keep.add(prize.id);
    }
  }
  for (const prize of eventPrizes) {
    if (!keep.has(prize.id) && prize.ticketNumber != null) {
      await tx.update(prizes).set({ ticketNumber: null }).where(eq(prizes.id, prize.id));
    }
  }
  const available = shuffle(
    [...Array(event.totalTickets).keys()].map((index) => index + 1).filter((number) => !used.has(number)),
  );
  let next = 0;
  for (const prize of eventPrizes) {
    if (keep.has(prize.id)) continue;
    await tx.update(prizes).set({ ticketNumber: available[next] ?? null }).where(eq(prizes.id, prize.id));
    next += 1;
  }
}

export async function attachPrizesToTickets(tx: DbTx, eventId: string) {
  const eventPrizes = await tx.select().from(prizes).where(eq(prizes.eventId, eventId));
  const byNumber = new Map(
    eventPrizes
      .filter((prize) => prize.ticketNumber)
      .map((prize) => [prize.ticketNumber as number, prize.id]),
  );
  const rows = await tx
    .select({ id: tickets.id, number: tickets.number, prizeId: tickets.prizeId })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));
  for (const row of rows) {
    const prizeId = byNumber.get(row.number) ?? null;
    if (row.prizeId === prizeId) continue;
    await tx.update(tickets).set({ prizeId }).where(eq(tickets.id, row.id));
  }
}

export function prizeAssignmentsOf(
  eventPrizes: { rank: number; nameFr: string; nameEn: string; ticketNumber: number | null }[],
) {
  return eventPrizes
    .filter((prize) => prize.ticketNumber != null)
    .map((prize) => ({
      rank: prize.rank,
      prizeNameFr: prize.nameFr,
      prizeNameEn: prize.nameEn,
      ticketNumber: prize.ticketNumber as number,
      buyerName: "",
      avatarUrl: null as string | null,
    }));
}

export function prizesAreSealed(
  eventPrizes: { ticketNumber: number | null }[],
  totalTickets: number,
) {
  if (!eventPrizes.length) return false;
  const used = new Set<number>();
  for (const prize of eventPrizes) {
    const number = prize.ticketNumber;
    if (!number || number < 1 || number > totalTickets || used.has(number)) return false;
    used.add(number);
  }
  return true;
}

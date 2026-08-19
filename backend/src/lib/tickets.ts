import { randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders, prizes, tickets } from "../db/schema.js";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

export async function assignScratchPrizes(tx: DbTx, event: { id: string; totalTickets: number }) {
  const eventPrizes = await tx.select().from(prizes).where(eq(prizes.eventId, event.id)).orderBy(asc(prizes.rank));
  if (!eventPrizes.length) return;

  const paidRows = await tx
    .select({ id: tickets.id, prizeId: tickets.prizeId })
    .from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(and(eq(tickets.eventId, event.id), eq(orders.status, "paid")));

  const taken = new Set(paidRows.map((row) => row.prizeId).filter((id): id is string => Boolean(id)));
  const remainingPrizes = eventPrizes.filter((prize) => !taken.has(prize.id));
  const openTickets = paidRows.filter((row) => !row.prizeId);
  if (!remainingPrizes.length || !openTickets.length) return;

  const futureSlots = Math.max(0, event.totalTickets - paidRows.length);
  const poolSize = openTickets.length + futureSlots;
  const winCount = Math.min(remainingPrizes.length, poolSize);
  const winningOpen = new Set(
    shuffle([...Array(poolSize).keys()])
      .slice(0, winCount)
      .filter((slot) => slot < openTickets.length),
  );
  const shuffledOpen = shuffle(openTickets);
  let prizeIndex = 0;
  for (let i = 0; i < shuffledOpen.length && prizeIndex < remainingPrizes.length; i += 1) {
    if (!winningOpen.has(i)) continue;
    const prize = remainingPrizes[prizeIndex]!;
    prizeIndex += 1;
    await tx.update(tickets).set({ prizeId: prize.id }).where(eq(tickets.id, shuffledOpen[i]!.id));
  }
}

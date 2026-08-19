import { randomInt } from "node:crypto";

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
>(tickets: T[], mode: DrawMode): T[] {
  if (mode !== "scratch") return tickets;
  return tickets.map((ticket) => {
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

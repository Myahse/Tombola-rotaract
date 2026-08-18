import { randomInt } from "node:crypto";

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function nextTicketNumbers(used: number[], total: number, quantity: number) {
  const taken = new Set(used);
  const numbers: number[] = [];
  for (let n = 1; n <= total && numbers.length < quantity; n += 1) {
    if (!taken.has(n)) numbers.push(n);
  }
  return numbers;
}

import { client } from "../db/index.js";

const memory = new Map<string, { count: number; resetAt: number }>();

function allowInMemory(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || now >= current.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}

export async function allowRequest(key: string, max: number, windowMs: number) {
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const rows = await client<{ count: number }[]>`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now() THEN ${resetAt} ELSE rate_limits.reset_at END
      RETURNING count
    `;
    return Number(rows[0]?.count ?? 1) <= max;
  } catch {
    return allowInMemory(key, max, windowMs);
  }
}

export function clientKey(req: { ip?: string; socket?: { remoteAddress?: string } }) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

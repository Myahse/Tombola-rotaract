import type { Response } from "express";
import { client } from "../db/index.js";

const memory = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15) * 60 * 1000;

function envInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const rateLimits = {
  registerIp: envInt("RATE_LIMIT_REGISTER_PER_IP", process.env.NODE_ENV === "production" ? 30 : 8),
  registerEmail: envInt("RATE_LIMIT_REGISTER_PER_EMAIL", 5),
  registerEmailWindowMs: envInt("RATE_LIMIT_REGISTER_EMAIL_MINUTES", 60) * 60 * 1000,
  loginIp: envInt("RATE_LIMIT_LOGIN_PER_IP", process.env.NODE_ENV === "production" ? 30 : 15),
  buyIp: envInt("RATE_LIMIT_BUY_PER_IP", process.env.NODE_ENV === "production" ? 50 : 20),
  formIp: envInt("RATE_LIMIT_FORM_PER_IP", process.env.NODE_ENV === "production" ? 12 : 8),
  cancelIp: envInt("RATE_LIMIT_CANCEL_PER_IP", process.env.NODE_ENV === "production" ? 20 : 10),
  windowMs: WINDOW_MS,
};

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

function allowInMemory(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || now >= current.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true as const };
  }
  current.count += 1;
  if (current.count <= max) {
    return { allowed: true as const };
  }
  return {
    allowed: false as const,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const rows = await client<{ count: number; reset_at: Date }[]>`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now() THEN ${resetAt} ELSE rate_limits.reset_at END
      RETURNING count, reset_at
    `;
    const count = Number(rows[0]?.count ?? 1);
    const reset = rows[0]?.reset_at instanceof Date ? rows[0].reset_at : resetAt;
    if (count <= max) {
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)),
    };
  } catch {
    return allowInMemory(key, max, windowMs);
  }
}

/** @deprecated use rateLimit or enforceRateLimit */
export async function allowRequest(key: string, max: number, windowMs: number) {
  const result = await rateLimit(key, max, windowMs);
  return result.allowed;
}

export function sendRateLimited(res: Response, retryAfterSec: number) {
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({ error: "too_many_requests", retryAfter: retryAfterSec });
}

export async function enforceRateLimit(
  res: Response,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const result = await rateLimit(key, max, windowMs);
  if (result.allowed) {
    return true;
  }
  sendRateLimited(res, result.retryAfterSec);
  return false;
}

export function clientKey(req: { ip?: string; socket?: { remoteAddress?: string } }) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function salesAreOpen(salesOpensAt: Date | null | undefined, now = Date.now()) {
  if (!salesOpensAt) return true;
  return salesOpensAt.getTime() <= now;
}

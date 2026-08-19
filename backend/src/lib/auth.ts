import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const ADMIN_COOKIE = "tombola_session";
const MEMBER_COOKIE = "tombola_member";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionCookie() {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + WEEK_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionCookie(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      role?: string;
      exp?: number;
    };
    return data.role === "admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function adminEmailMatches(input: string) {
  const allowed = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return process.env.NODE_ENV !== "production";
  return allowed.includes(input.trim().toLowerCase());
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
    maxAge: WEEK_MS,
    path: "/",
  };
}

function cookieClearOptions() {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  return options;
}

export function hasAdminSessionFromCookieHeader(cookieHeader: string | undefined) {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === ADMIN_COOKIE) {
      return readSessionCookie(decodeURIComponent(rest.join("=")));
    }
  }
  return false;
}

export function setSession(res: Response) {
  res.cookie(ADMIN_COOKIE, createSessionCookie(), cookieOptions());
}

export function clearSession(res: Response) {
  res.clearCookie(ADMIN_COOKIE, cookieClearOptions());
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
  if (!readSessionCookie(token)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

export function createMemberCookie(memberId: string) {
  const payload = Buffer.from(
    JSON.stringify({ role: "member", memberId, exp: Date.now() + WEEK_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readMemberId(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      role?: string;
      memberId?: string;
      exp?: number;
    };
    if (data.role !== "member" || typeof data.memberId !== "string") return null;
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return data.memberId;
  } catch {
    return null;
  }
}

export function setMemberSession(res: Response, memberId: string) {
  res.cookie(MEMBER_COOKIE, createMemberCookie(memberId), cookieOptions());
}

export function clearMemberSession(res: Response) {
  res.clearCookie(MEMBER_COOKIE, cookieClearOptions());
}

export type MemberRequest = Request & { memberId: string };

export function requireMember(req: Request, res: Response, next: NextFunction) {
  const memberId = readMemberId(req.cookies?.[MEMBER_COOKIE] as string | undefined);
  if (!memberId) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  (req as MemberRequest).memberId = memberId;
  next();
}

export function optionalMemberId(req: Request) {
  return readMemberId(req.cookies?.[MEMBER_COOKIE] as string | undefined);
}

export function newAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

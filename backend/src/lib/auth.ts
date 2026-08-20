import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { defaultClubSlug, getClubById, getClubBySlug, runWithClub } from "./club.js";

const ADMIN_COOKIE = "tombola_session";
const MEMBER_COOKIE = "tombola_member";
const PLATFORM_COOKIE = "tombola_platform";
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

function readSigned<T extends Record<string, unknown>>(token: string | undefined): (T & { exp?: number }) | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp?: number };
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSigned(data: object) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + WEEK_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function createSessionCookie(clubId: string) {
  return writeSigned({ role: "admin", clubId });
}

export function readAdminSession(token: string | undefined) {
  const data = readSigned<{ role?: string; clubId?: string }>(token);
  if (!data || data.role !== "admin") return null;
  return { clubId: data.clubId ?? "" };
}

export function readSessionCookie(token: string | undefined) {
  return Boolean(readAdminSession(token));
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

export function adminClubIdFromCookieHeader(cookieHeader: string | undefined) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === ADMIN_COOKIE) {
      const session = readAdminSession(decodeURIComponent(rest.join("=")));
      return session?.clubId || null;
    }
  }
  return null;
}

export function hasAdminSessionFromCookieHeader(cookieHeader: string | undefined) {
  return Boolean(adminClubIdFromCookieHeader(cookieHeader));
}

export function setSession(res: Response, clubId: string) {
  res.cookie(ADMIN_COOKIE, createSessionCookie(clubId), cookieOptions());
}

export function clearSession(res: Response) {
  res.clearCookie(ADMIN_COOKIE, cookieClearOptions());
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
  const session = readAdminSession(token);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  void (async () => {
    let club = session.clubId ? await getClubById(session.clubId) : null;
    if (!club) club = await getClubBySlug(defaultClubSlug());
    if (!club || club.status === "suspended") {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.club = club;
    runWithClub(club, () => next());
  })().catch(next);
}

export function createPlatformCookie() {
  return writeSigned({ role: "platform" });
}

export function readPlatformSession(token: string | undefined) {
  const data = readSigned<{ role?: string }>(token);
  return Boolean(data && data.role === "platform");
}

export function setPlatformSession(res: Response) {
  res.cookie(PLATFORM_COOKIE, createPlatformCookie(), cookieOptions());
}

export function clearPlatformSession(res: Response) {
  res.clearCookie(PLATFORM_COOKIE, cookieClearOptions());
}

export function requirePlatform(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[PLATFORM_COOKIE] as string | undefined;
  if (!readPlatformSession(token)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

export function platformPasswordMatches(input: string) {
  const expected = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createMemberCookie(memberId: string, clubId?: string) {
  return writeSigned({ role: "member", memberId, clubId });
}

export function readMemberId(token: string | undefined): string | null {
  return readMemberSession(token)?.memberId ?? null;
}

export function readMemberSession(token: string | undefined) {
  const data = readSigned<{ role?: string; memberId?: string; clubId?: string }>(token);
  if (!data || data.role !== "member" || typeof data.memberId !== "string") return null;
  return { memberId: data.memberId, clubId: data.clubId ?? "" };
}

export function setMemberSession(res: Response, memberId: string, clubId?: string) {
  res.cookie(MEMBER_COOKIE, createMemberCookie(memberId, clubId), cookieOptions());
}

export function clearMemberSession(res: Response) {
  res.clearCookie(MEMBER_COOKIE, cookieClearOptions());
}

export type MemberRequest = Request & { memberId: string };

export function requireMember(req: Request, res: Response, next: NextFunction) {
  const session = readMemberSession(req.cookies?.[MEMBER_COOKIE] as string | undefined);
  if (!session) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  if (req.club && session.clubId && session.clubId !== req.club.id) {
    res.status(401).json({ error: "login_required" });
    return;
  }
  (req as MemberRequest).memberId = session.memberId;
  next();
}

export function optionalMemberId(req: Request) {
  const session = readMemberSession(req.cookies?.[MEMBER_COOKIE] as string | undefined);
  if (!session) return null;
  if (req.club && session.clubId && session.clubId !== req.club.id) return null;
  return session.memberId;
}

export function newAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

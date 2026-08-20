import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { members, refreshTokens } from "../db/schema.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { blacklistAccessJti, isAccessJtiBlacklisted } from "./redis.js";

const ADMIN_ACCESS_COOKIE = "tombola_session";
const ADMIN_REFRESH_COOKIE = "tombola_admin_refresh";
const MEMBER_ACCESS_COOKIE = "tombola_access";
const MEMBER_REFRESH_COOKIE = "tombola_refresh";
const LEGACY_MEMBER_COOKIE = "tombola_member";
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

type AccessPayload = {
  typ: "access";
  role: "member" | "admin";
  sub?: string;
  tv?: number;
  stamp?: string;
  jti: string;
  exp: number;
};

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

export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export function newAccessToken() {
  return randomBytes(24).toString("base64url");
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
    path: "/",
  };
}

function cookieOptions(maxAge: number) {
  return { ...cookieBase(), maxAge };
}

function cookieClearOptions() {
  return cookieBase();
}

function signAccess(data: AccessPayload) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readAccess(token: string | undefined): AccessPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as AccessPayload;
    if (data.typ !== "access" || typeof data.jti !== "string" || typeof data.exp !== "number") return null;
    if (data.role !== "member" && data.role !== "admin") return null;
    return data;
  } catch {
    return null;
  }
}

function cookieFromHeader(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

let adminPasswordHash: { raw: string; hash: string } | null = null;

function adminStamp() {
  return createHmac("sha256", secret())
    .update(`admin:${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest("base64url")
    .slice(0, 24);
}

export async function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || !input) return false;
  if (!adminPasswordHash || adminPasswordHash.raw !== expected) {
    adminPasswordHash = { raw: expected, hash: await hashPassword(expected) };
  }
  return verifyPassword(input, adminPasswordHash.hash);
}

export function adminEmailMatches(input: string) {
  const allowed = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return process.env.NODE_ENV !== "production";
  return allowed.includes(input.trim().toLowerCase());
}

async function insertRefresh(opts: {
  memberId: string | null;
  role: "member" | "admin";
  familyId: string;
}) {
  const raw = randomBytes(32).toString("base64url");
  await db.insert(refreshTokens).values({
    memberId: opts.memberId,
    role: opts.role,
    tokenHash: hashToken(raw),
    familyId: opts.familyId,
    expiresAt: new Date(Date.now() + REFRESH_MS),
  });
  return raw;
}

async function revokeFamily(familyId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllRefresh(opts: { memberId?: string; role?: "member" | "admin" }) {
  const now = new Date();
  if (opts.memberId) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.memberId, opts.memberId), isNull(refreshTokens.revokedAt)));
    return;
  }
  if (opts.role === "admin") {
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.role, "admin"), isNull(refreshTokens.revokedAt)));
  }
}

export async function bumpMemberTokenVersion(memberId: string) {
  const [updated] = await db
    .update(members)
    .set({ tokenVersion: sql`${members.tokenVersion} + 1` })
    .where(eq(members.id, memberId))
    .returning({ id: members.id, tokenVersion: members.tokenVersion });
  await revokeAllRefresh({ memberId });
  return updated?.tokenVersion ?? 0;
}

function setAccessCookie(res: Response, name: string, token: string, maxAge: number) {
  res.cookie(name, token, cookieOptions(maxAge));
}

function clearAuthCookies(res: Response, kind: "member" | "admin") {
  const clear = cookieClearOptions();
  if (kind === "member") {
    res.clearCookie(MEMBER_ACCESS_COOKIE, clear);
    res.clearCookie(MEMBER_REFRESH_COOKIE, clear);
    res.clearCookie(LEGACY_MEMBER_COOKIE, clear);
    return;
  }
  res.clearCookie(ADMIN_ACCESS_COOKIE, clear);
  res.clearCookie(ADMIN_REFRESH_COOKIE, clear);
}

export async function issueMemberAuth(res: Response, memberId: string, tokenVersion: number) {
  const jti = randomUUID();
  const exp = Date.now() + ACCESS_MS;
  const familyId = randomUUID();
  const refresh = await insertRefresh({ memberId, role: "member", familyId });
  setAccessCookie(
    res,
    MEMBER_ACCESS_COOKIE,
    signAccess({ typ: "access", role: "member", sub: memberId, tv: tokenVersion, jti, exp }),
    ACCESS_MS,
  );
  res.cookie(MEMBER_REFRESH_COOKIE, refresh, cookieOptions(REFRESH_MS));
  res.clearCookie(LEGACY_MEMBER_COOKIE, cookieClearOptions());
}

export async function issueAdminAuth(res: Response) {
  const jti = randomUUID();
  const exp = Date.now() + ACCESS_MS;
  const familyId = randomUUID();
  const refresh = await insertRefresh({ memberId: null, role: "admin", familyId });
  setAccessCookie(
    res,
    ADMIN_ACCESS_COOKIE,
    signAccess({ typ: "access", role: "admin", stamp: adminStamp(), jti, exp }),
    ACCESS_MS,
  );
  res.cookie(ADMIN_REFRESH_COOKIE, refresh, cookieOptions(REFRESH_MS));
}

async function rotateRefresh(raw: string, role: "member" | "admin") {
  const tokenHash = hashToken(raw);
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!row || row.role !== role) return null;
  if (row.revokedAt) {
    await revokeFamily(row.familyId);
    if (row.memberId) await bumpMemberTokenVersion(row.memberId);
    else if (row.role === "admin") await revokeAllRefresh({ role: "admin" });
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
    return null;
  }
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  const nextRaw = await insertRefresh({
    memberId: row.memberId,
    role,
    familyId: row.familyId,
  });
  return { row, nextRaw };
}

async function accessStillValid(data: AccessPayload) {
  if (data.exp <= Date.now()) return false;
  if (await isAccessJtiBlacklisted(data.jti)) return false;
  if (data.role === "admin") return data.stamp === adminStamp();
  if (data.role !== "member" || !data.sub || typeof data.tv !== "number") return false;
  const [member] = await db
    .select({ id: members.id, tokenVersion: members.tokenVersion })
    .from(members)
    .where(eq(members.id, data.sub))
    .limit(1);
  return Boolean(member && member.tokenVersion === data.tv);
}

export async function resolveMemberId(req: Request, res?: Response): Promise<string | null> {
  const access = readAccess(req.cookies?.[MEMBER_ACCESS_COOKIE] as string | undefined);
  if (access?.role === "member" && access.sub && (await accessStillValid(access))) {
    (req as MemberRequest).accessJti = access.jti;
    (req as MemberRequest).accessExp = access.exp;
    return access.sub;
  }

  const refreshRaw = req.cookies?.[MEMBER_REFRESH_COOKIE] as string | undefined;
  if (!refreshRaw || !res) return null;
  const rotated = await rotateRefresh(refreshRaw, "member");
  if (!rotated?.row.memberId) {
    clearAuthCookies(res, "member");
    return null;
  }
  if (access?.jti) await blacklistAccessJti(access.jti, access.exp);
  const [member] = await db
    .select({ id: members.id, tokenVersion: members.tokenVersion })
    .from(members)
    .where(eq(members.id, rotated.row.memberId))
    .limit(1);
  if (!member) {
    clearAuthCookies(res, "member");
    return null;
  }
  const jti = randomUUID();
  const exp = Date.now() + ACCESS_MS;
  setAccessCookie(
    res,
    MEMBER_ACCESS_COOKIE,
    signAccess({ typ: "access", role: "member", sub: member.id, tv: member.tokenVersion, jti, exp }),
    ACCESS_MS,
  );
  res.cookie(MEMBER_REFRESH_COOKIE, rotated.nextRaw, cookieOptions(REFRESH_MS));
  (req as MemberRequest).accessJti = jti;
  (req as MemberRequest).accessExp = exp;
  return member.id;
}

async function resolveAdmin(req: Request, res?: Response): Promise<boolean> {
  const access = readAccess(req.cookies?.[ADMIN_ACCESS_COOKIE] as string | undefined);
  if (access?.role === "admin" && (await accessStillValid(access))) {
    (req as AdminRequest).accessJti = access.jti;
    (req as AdminRequest).accessExp = access.exp;
    return true;
  }
  const refreshRaw = req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
  if (!refreshRaw || !res) return false;
  const rotated = await rotateRefresh(refreshRaw, "admin");
  if (!rotated) {
    clearAuthCookies(res, "admin");
    return false;
  }
  if (access?.jti) await blacklistAccessJti(access.jti, access.exp);
  const jti = randomUUID();
  const exp = Date.now() + ACCESS_MS;
  setAccessCookie(
    res,
    ADMIN_ACCESS_COOKIE,
    signAccess({ typ: "access", role: "admin", stamp: adminStamp(), jti, exp }),
    ACCESS_MS,
  );
  res.cookie(ADMIN_REFRESH_COOKIE, rotated.nextRaw, cookieOptions(REFRESH_MS));
  (req as AdminRequest).accessJti = jti;
  (req as AdminRequest).accessExp = exp;
  return true;
}

export async function hasAdminSessionFromCookieHeader(cookieHeader: string | undefined) {
  const access = readAccess(cookieFromHeader(cookieHeader, ADMIN_ACCESS_COOKIE));
  if (access?.role === "admin" && (await accessStillValid(access))) return true;
  const refreshRaw = cookieFromHeader(cookieHeader, ADMIN_REFRESH_COOKIE);
  if (!refreshRaw) return false;
  const tokenHash = hashToken(refreshRaw);
  const [row] = await db
    .select({ id: refreshTokens.id, expiresAt: refreshTokens.expiresAt, revokedAt: refreshTokens.revokedAt, role: refreshTokens.role })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return Boolean(row && row.role === "admin" && !row.revokedAt && row.expiresAt.getTime() > Date.now());
}

export async function revokeMemberAuth(req: Request, res: Response) {
  const access = readAccess(req.cookies?.[MEMBER_ACCESS_COOKIE] as string | undefined);
  if (access?.jti) await blacklistAccessJti(access.jti, access.exp);
  const refreshRaw = req.cookies?.[MEMBER_REFRESH_COOKIE] as string | undefined;
  if (refreshRaw) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshRaw)));
  }
  clearAuthCookies(res, "member");
}

export async function revokeAdminAuth(req: Request, res: Response) {
  const access = readAccess(req.cookies?.[ADMIN_ACCESS_COOKIE] as string | undefined);
  if (access?.jti) await blacklistAccessJti(access.jti, access.exp);
  const refreshRaw = req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
  if (refreshRaw) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshRaw)));
  }
  clearAuthCookies(res, "admin");
}

export function clearMemberSession(res: Response) {
  clearAuthCookies(res, "member");
}

export type MemberRequest = Request & { memberId: string; accessJti?: string; accessExp?: number };
type AdminRequest = Request & { accessJti?: string; accessExp?: number };

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await resolveAdmin(req, res))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireMember(req: Request, res: Response, next: NextFunction) {
  try {
    const memberId = await resolveMemberId(req, res);
    if (!memberId) {
      res.status(401).json({ error: "login_required" });
      return;
    }
    (req as MemberRequest).memberId = memberId;
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalMemberId(req: Request) {
  const access = readAccess(req.cookies?.[MEMBER_ACCESS_COOKIE] as string | undefined);
  return access?.role === "member" ? access.sub ?? null : null;
}

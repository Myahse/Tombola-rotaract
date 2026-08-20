import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clubs, type ClubRow } from "../db/schema.js";
import { timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";

export type { ClubRow };

const clubAls = new AsyncLocalStorage<ClubRow>();
const IUGB_SLUG = "rotaract-iugb";
const RESERVED_SLUGS = new Set([
  "api",
  "org",
  "mail",
  "www",
  "admin",
  "platform",
  "app",
  "organizer",
  "organisateurs",
  "organisateur",
  "campaign",
  "campagnes",
  "tombola",
]);

let hostCache: { at: number; hosts: Map<string, string> } | null = null;

export function defaultClubSlug() {
  return (process.env.DEFAULT_CLUB_SLUG ?? IUGB_SLUG).trim().toLowerCase() || IUGB_SLUG;
}

export function platformDomain() {
  return (process.env.PLATFORM_DOMAIN ?? "").trim().toLowerCase().replace(/^www\./, "");
}

export function currentClub() {
  return clubAls.getStore();
}

export function runWithClub<T>(club: ClubRow, fn: () => T) {
  return clubAls.run(club, fn);
}

export function publicClub(club: ClubRow) {
  return {
    id: club.id,
    slug: club.slug,
    name: club.name,
    logoUrl: club.logoUrl,
    logoDarkUrl: club.logoDarkUrl,
    primaryColor: club.primaryColor,
    status: club.status,
    publicUrl: club.publicUrl,
  };
}

export function clubSettings(club: ClubRow) {
  return {
    ...publicClub(club),
    wavePayUrl: club.wavePayUrl,
    senderName: club.senderName,
    senderEmail: club.senderEmail,
    publicUrl: club.publicUrl,
    organizerUrl: club.organizerUrl,
    campaignUrl: club.campaignUrl,
    customDomain: club.customDomain,
    organizerEmails: club.organizerEmails,
  };
}

export function normalizeClubSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug);
}

function hostnameOf(value: string | undefined) {
  if (!value) return "";
  try {
    if (value.includes("://")) return new URL(value).hostname.toLowerCase();
    return value.split(":")[0]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function hostsFor(club: ClubRow) {
  const hosts = new Set<string>();
  for (const value of [club.publicUrl, club.organizerUrl, club.campaignUrl, club.customDomain]) {
    const host = hostnameOf(value ?? "");
    if (host) hosts.add(host);
    if (host.startsWith("www.")) hosts.add(host.slice(4));
  }
  const platform = platformDomain();
  if (platform) hosts.add(`${club.slug}.${platform}`);
  if (club.slug === IUGB_SLUG) {
    hosts.add("tombola.rotaractiugb.com");
    hosts.add("organisateurs.rotaractiugb.com");
    hosts.add("campagnes.rotaractiugb.com");
    hosts.add("rotaractiugb.com");
  }
  return [...hosts];
}

export async function refreshClubHosts() {
  const rows = await db.select().from(clubs);
  const hosts = new Map<string, string>();
  for (const club of rows) {
    for (const host of hostsFor(club)) hosts.set(host, club.id);
  }
  hostCache = { at: Date.now(), hosts };
  return hosts;
}

export async function clubHostSet() {
  if (!hostCache || Date.now() - hostCache.at > 60_000) {
    await refreshClubHosts();
  }
  return new Set(hostCache?.hosts.keys() ?? []);
}

export async function getClubById(id: string) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1);
  return club ?? null;
}

export async function getClubBySlug(slug: string) {
  const normalized = normalizeClubSlug(slug);
  if (!normalized) return null;
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, normalized)).limit(1);
  return club ?? null;
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1";
}

function isSharedAppHost(host: string) {
  const platform = platformDomain();
  if (!platform) return false;
  return (
    host === platform ||
    host === `org.${platform}` ||
    host === `mail.${platform}` ||
    host === `admin.${platform}` ||
    host === `api.${platform}` ||
    host === `www.${platform}`
  );
}

export async function resolveClub(req: Request) {
  const originHost = hostnameOf(typeof req.headers.origin === "string" ? req.headers.origin : "");
  const requestHost = hostnameOf(req.headers.host);

  if (originHost && !isLocalHost(originHost) && !isSharedAppHost(originHost)) {
    const byOrigin = await clubFromHostname(originHost);
    if (byOrigin) return byOrigin;
  }
  if (requestHost && !isLocalHost(requestHost) && !isSharedAppHost(requestHost) && requestHost !== "api.rotaractiugb.com") {
    const byHost = await clubFromHostname(requestHost);
    if (byHost) return byHost;
  }

  const hint = clubHint(req);
  if (hint) {
    const bySlug = await getClubBySlug(hint);
    if (bySlug) return bySlug;
  }

  if (isLocalHost(originHost) || isLocalHost(requestHost) || !originHost) {
    return getClubBySlug(defaultClubSlug());
  }
  if (isSharedAppHost(originHost) || isSharedAppHost(requestHost)) {
    return getClubBySlug(defaultClubSlug());
  }
  return null;
}

async function clubFromHostname(host: string) {
  const platform = platformDomain();
  if (platform && host.endsWith(`.${platform}`)) {
    const slug = host.slice(0, -(platform.length + 1));
    if (slug && !isReservedSlug(slug) && !isSharedAppHost(host)) {
      const club = await getClubBySlug(slug);
      if (club) return club;
    }
  }
  if (!hostCache || Date.now() - hostCache.at > 60_000) {
    await refreshClubHosts();
  }
  const id = hostCache?.hosts.get(host);
  if (!id) return null;
  return getClubById(id);
}

function clubHint(req: Request) {
  const header = req.headers["x-club-slug"];
  if (typeof header === "string" && header.trim()) return header;
  const query = req.query.club;
  const value = Array.isArray(query) ? query[0] : query;
  if (typeof value === "string" && value.trim()) return value;
  const body = req.body && typeof req.body === "object" ? (req.body as { clubSlug?: unknown }).clubSlug : undefined;
  if (typeof body === "string" && body.trim()) return body;
  return "";
}

export function attachClub(req: Request, res: Response, next: NextFunction) {
  void resolveClub(req)
    .then((club) => {
      req.club = club;
      if (club) {
        runWithClub(club, () => next());
        return;
      }
      next();
    })
    .catch(next);
}

export function clubIdOf(req: Request) {
  return req.club?.id ?? "";
}

export function requireResolvedClub(req: Request, res: Response, next: NextFunction) {
  if (!req.club) {
    res.status(404).json({ error: "club_not_found" });
    return;
  }
  if (req.club.status === "suspended") {
    res.status(403).json({ error: "club_suspended" });
    return;
  }
  next();
}

function emailsOf(club: ClubRow) {
  const listed = club.organizerEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (listed.length) return listed;
  if (club.slug === defaultClubSlug()) {
    return (process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function organizerEmailAllowed(club: ClubRow, email: string) {
  const allowed = emailsOf(club);
  if (!allowed.length) return process.env.NODE_ENV !== "production";
  return allowed.includes(email.trim().toLowerCase());
}

export async function organizerPasswordOk(club: ClubRow, password: string) {
  if (club.organizerPasswordHash) {
    return verifyPassword(password, club.organizerPasswordHash);
  }
  if (club.slug === defaultClubSlug()) {
    const expected = process.env.ADMIN_PASSWORD ?? "";
    if (!expected || !password) return false;
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  return false;
}

export async function setOrganizerPassword(clubId: string, password: string) {
  const hash = await hashPassword(password);
  await db
    .update(clubs)
    .set({ organizerPasswordHash: hash, updatedAt: new Date() })
    .where(eq(clubs.id, clubId));
}

export function clubWaveUrl(club: ClubRow | undefined) {
  return safeHttpsWave(club?.wavePayUrl) || safeHttpsWave(process.env.WAVE_PAY_URL);
}

function safeHttpsWave(value: string | undefined) {
  try {
    const parsed = new URL((value ?? "").trim());
    if (parsed.protocol !== "https:") return "";
    if (parsed.hostname !== "pay.wave.com") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function clubSiteOrigin(club: ClubRow | undefined) {
  const fromClub = (club?.publicUrl ?? "").trim().replace(/\/$/, "");
  if (fromClub) {
    try {
      const url = new URL(fromClub);
      if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }
  return "";
}

declare global {
  namespace Express {
    interface Request {
      club?: ClubRow | null;
    }
  }
}

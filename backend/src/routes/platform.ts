import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { clubs } from "../db/schema.js";
import {
  clearPlatformSession,
  platformPasswordMatches,
  requirePlatform,
  setPlatformSession,
} from "../lib/auth.js";
import {
  clubSettings,
  isReservedSlug,
  normalizeClubSlug,
  refreshClubHosts,
  setOrganizerPassword,
} from "../lib/club.js";
import { refreshAllowedHosts } from "../lib/origins.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";
import { hashPassword } from "../lib/passwords.js";

export const platformRouter = Router();

platformRouter.post("/login", (req, res) => {
  if (!allowRequest(`platform-login:${clientKey(req)}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success || !platformPasswordMatches(parsed.data.password)) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  setPlatformSession(res);
  res.json({ ok: true });
});

platformRouter.post("/logout", (_req, res) => {
  clearPlatformSession(res);
  res.json({ ok: true });
});

platformRouter.get("/me", requirePlatform, (_req, res) => {
  res.json({ ok: true });
});

platformRouter.get("/clubs", requirePlatform, async (_req, res) => {
  const rows = await db.select().from(clubs).orderBy(desc(clubs.createdAt));
  res.json({
    clubs: rows.map((row) => clubSettings(row)),
  });
});

const createSchema = z.object({
  slug: z.string().trim().min(2).max(48),
  name: z.string().trim().min(2).max(120),
  organizerEmail: z.string().trim().email().max(120),
  organizerPassword: z.string().min(8).max(200),
  publicUrl: z.string().trim().max(300).optional().or(z.literal("")),
  organizerUrl: z.string().trim().max(300).optional().or(z.literal("")),
  campaignUrl: z.string().trim().max(300).optional().or(z.literal("")),
  wavePayUrl: z.string().trim().max(300).optional().or(z.literal("")),
});

platformRouter.post("/clubs", requirePlatform, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const slug = normalizeClubSlug(parsed.data.slug);
  if (!slug || isReservedSlug(slug)) {
    res.status(400).json({ error: "invalid_slug" });
    return;
  }
  const platform = (process.env.PLATFORM_DOMAIN ?? "").trim().replace(/^www\./, "");
  const publicUrl =
    parsed.data.publicUrl?.trim() || (platform ? `https://${slug}.${platform}` : "");
  const organizerUrl =
    parsed.data.organizerUrl?.trim() || (platform ? `https://org.${platform}` : "");
  const campaignUrl =
    parsed.data.campaignUrl?.trim() || (platform ? `https://mail.${platform}` : "");

  try {
    const [created] = await db
      .insert(clubs)
      .values({
        slug,
        name: parsed.data.name,
        organizerEmails: parsed.data.organizerEmail.toLowerCase(),
        organizerPasswordHash: await hashPassword(parsed.data.organizerPassword),
        publicUrl,
        organizerUrl,
        campaignUrl,
        wavePayUrl: parsed.data.wavePayUrl ?? "",
        senderName: parsed.data.name,
        status: "active",
      })
      .returning();
    await refreshClubHosts();
    await refreshAllowedHosts();
    res.status(201).json({ club: clubSettings(created) });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "slug_taken" });
      return;
    }
    throw error;
  }
});

platformRouter.patch("/clubs/:id", requirePlatform, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const parsed = z
    .object({
      status: z.enum(["trial", "active", "suspended"]).optional(),
      organizerPassword: z.string().min(8).max(200).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const [existing] = await db.select().from(clubs).where(eq(clubs.id, id.data)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (parsed.data.organizerPassword) {
    await setOrganizerPassword(existing.id, parsed.data.organizerPassword);
  }
  const [updated] = await db
    .update(clubs)
    .set({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(clubs.id, existing.id))
    .returning();
  await refreshClubHosts();
  await refreshAllowedHosts();
  res.json({ club: clubSettings(updated) });
});

import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { adhesionApplications } from "../db/schema.js";
import { requireAdmin } from "../lib/auth.js";
import { clientKey, enforceRateLimit, rateLimits } from "../lib/rateLimit.js";

export const publicFormsRouter = Router();
export const adminFormsRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const applicantSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  birthDate: z.string().trim().min(4).max(32),
  sex: z.enum(["female", "male", "other"]),
  address: z.string().trim().min(4).max(240),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(180),
  profession: z.string().trim().min(2).max(160),
  sponsorName: z.string().trim().min(2).max(160),
  sponsorEmail: z.string().trim().email().max(180),
  pledgeName: z.string().trim().min(2).max(160),
  pledgeRules: z.literal(true),
  pledgeParticipate: z.literal(true),
  pledgeDues: z.literal(true),
  pledgeObservation: z.literal(true),
  applicantSignature: z.string().trim().min(2).max(160),
  lang: z.enum(["fr", "en"]).optional(),
});

const sponsorSchema = z.object({
  sponsorName: z.string().trim().min(2).max(160),
  sponsorRole: z.string().trim().min(2).max(120),
  sponsorConfirmName: z.string().trim().min(2).max(160),
  sponsorSignature: z.string().trim().min(2).max(160),
  sponsorDate: z.string().trim().min(4).max(32),
});

const reviewSchema = z.object({
  depositDate: z.string().trim().max(32).optional().or(z.literal("")),
  commissionOpinion: z.string().trim().max(800).optional().or(z.literal("")),
  finalDecision: z.enum(["pending", "accepted", "rejected"]),
  presidentSignature: z.string().trim().max(160).optional().or(z.literal("")),
});

function publicApplication(row: typeof adhesionApplications.$inferSelect) {
  return {
    id: row.id,
    fullName: row.fullName,
    birthDate: row.birthDate,
    sex: row.sex,
    address: row.address,
    phone: row.phone,
    email: row.email,
    profession: row.profession,
    sponsorName: row.sponsorName,
    sponsorEmail: row.sponsorEmail,
    sponsorRole: row.sponsorRole,
    pledgeName: row.pledgeName,
    pledgeRules: row.pledgeRules,
    pledgeParticipate: row.pledgeParticipate,
    pledgeDues: row.pledgeDues,
    pledgeObservation: row.pledgeObservation,
    applicantSignature: row.applicantSignature,
    sponsorConfirmName: row.sponsorConfirmName,
    sponsorSignature: row.sponsorSignature,
    sponsorDate: row.sponsorDate,
    status: row.status as "awaiting_sponsor" | "awaiting_review",
    depositDate: row.depositDate,
    commissionOpinion: row.commissionOpinion,
    finalDecision: row.finalDecision,
    presidentSignature: row.presidentSignature,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sponsorPreview(row: typeof adhesionApplications.$inferSelect) {
  return {
    fullName: row.fullName,
    email: row.email,
    profession: row.profession,
    sponsorName: row.sponsorName,
    status: row.status as "awaiting_sponsor" | "awaiting_review",
  };
}

publicFormsRouter.post("/adhesion", async (req, res, next) => {
  try {
    if (!(await enforceRateLimit(res, `form-adhesion:${clientKey(req)}`, rateLimits.formIp, rateLimits.windowMs))) {
      return;
    }
    const parsed = applicantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const sponsorEmail = parsed.data.sponsorEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || !EMAIL_RE.test(sponsorEmail)) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const lang = parsed.data.lang === "en" ? "en" : "fr";
    const [created] = await db
      .insert(adhesionApplications)
      .values({
        fullName: parsed.data.fullName,
        birthDate: parsed.data.birthDate,
        sex: parsed.data.sex,
        address: parsed.data.address,
        phone: parsed.data.phone,
        email,
        profession: parsed.data.profession,
        sponsorName: parsed.data.sponsorName,
        sponsorEmail,
        pledgeName: parsed.data.pledgeName,
        pledgeRules: parsed.data.pledgeRules,
        pledgeParticipate: parsed.data.pledgeParticipate,
        pledgeDues: parsed.data.pledgeDues,
        pledgeObservation: parsed.data.pledgeObservation,
        applicantSignature: parsed.data.applicantSignature,
        sponsorToken: randomBytes(24).toString("base64url"),
        status: "awaiting_sponsor",
      })
      .returning();
    if (!created) {
      res.status(500).json({ error: "request_failed" });
      return;
    }
    void import("../lib/mail.js")
      .then(({ notifyAdhesionApplicant, notifyAdhesionSponsor }) =>
        Promise.all([notifyAdhesionApplicant(created), notifyAdhesionSponsor(created, lang)]),
      )
      .catch((error) => console.error("Adhesion invite failed", error));
    res.json({ ok: true, id: created.id });
  } catch (error) {
    next(error);
  }
});

publicFormsRouter.get("/adhesion/sponsor/:token", async (req, res, next) => {
  try {
    const token = req.params.token ?? "";
    if (!token) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [row] = await db
      .select()
      .from(adhesionApplications)
      .where(eq(adhesionApplications.sponsorToken, token))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ application: sponsorPreview(row) });
  } catch (error) {
    next(error);
  }
});

publicFormsRouter.post("/adhesion/sponsor/:token", async (req, res, next) => {
  try {
    if (!(await enforceRateLimit(res, `form-sponsor:${clientKey(req)}`, rateLimits.formIp, rateLimits.windowMs))) {
      return;
    }
    const token = req.params.token ?? "";
    const parsed = sponsorSchema.safeParse(req.body);
    if (!token || !parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const [existing] = await db
      .select()
      .from(adhesionApplications)
      .where(eq(adhesionApplications.sponsorToken, token))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (existing.status !== "awaiting_sponsor") {
      res.status(409).json({ error: "already_done" });
      return;
    }
    const [updated] = await db
      .update(adhesionApplications)
      .set({
        sponsorName: parsed.data.sponsorName,
        sponsorRole: parsed.data.sponsorRole,
        sponsorConfirmName: parsed.data.sponsorConfirmName,
        sponsorSignature: parsed.data.sponsorSignature,
        sponsorDate: parsed.data.sponsorDate,
        status: "awaiting_review",
        updatedAt: new Date(),
      })
      .where(and(eq(adhesionApplications.sponsorToken, token), eq(adhesionApplications.status, "awaiting_sponsor")))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "already_done" });
      return;
    }
    void import("../lib/mail.js")
      .then(({ notifyAdhesionApplication }) => notifyAdhesionApplication(updated))
      .catch((error) => console.error("Adhesion notice failed", error));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminFormsRouter.use(requireAdmin);

adminFormsRouter.get("/adhesion", async (_req, res, next) => {
  try {
    const rows = await db.select().from(adhesionApplications).orderBy(desc(adhesionApplications.createdAt));
    res.json({ applications: rows.map(publicApplication) });
  } catch (error) {
    next(error);
  }
});

adminFormsRouter.get("/adhesion/:id", async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(adhesionApplications)
      .where(eq(adhesionApplications.id, req.params.id ?? ""))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ application: publicApplication(row) });
  } catch (error) {
    next(error);
  }
});

adminFormsRouter.patch("/adhesion/:id", async (req, res, next) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const [current] = await db
      .select()
      .from(adhesionApplications)
      .where(eq(adhesionApplications.id, req.params.id ?? ""))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (current.status !== "awaiting_review") {
      res.status(409).json({ error: "waiting_sponsor" });
      return;
    }
    const [updated] = await db
      .update(adhesionApplications)
      .set({
        depositDate: parsed.data.depositDate || null,
        commissionOpinion: parsed.data.commissionOpinion || null,
        finalDecision: parsed.data.finalDecision,
        presidentSignature: parsed.data.presidentSignature || null,
        updatedAt: new Date(),
      })
      .where(eq(adhesionApplications.id, req.params.id ?? ""))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ application: publicApplication(updated) });
  } catch (error) {
    next(error);
  }
});

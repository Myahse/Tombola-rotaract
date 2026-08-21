import { eq } from "drizzle-orm";
import type { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { adminPushSubscriptions } from "../db/schema.js";
import { requireAdmin } from "../lib/auth.js";
import { getVapidPublicKey, isAllowedPushEndpoint, pushConfigured, sendPushToOrganizers } from "../lib/push.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";

const subscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(4096),
  keys: z.object({
    p256dh: z.string().trim().min(10).max(200),
    auth: z.string().trim().min(8).max(200),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().url().max(4096).optional(),
});

export function registerAdminPushRoutes(router: Router) {
  router.get("/push/key", requireAdmin, (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  router.get("/push/status", requireAdmin, async (req, res) => {
    const configured = pushConfigured();
    if (!configured) {
      res.json({ configured: false, subscribed: false });
      return;
    }
    const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint.trim() : "";
    if (endpoint) {
      const [row] = await db
        .select({ id: adminPushSubscriptions.id })
        .from(adminPushSubscriptions)
        .where(eq(adminPushSubscriptions.endpoint, endpoint))
        .limit(1);
      res.json({ configured: true, subscribed: Boolean(row) });
      return;
    }
    const [row] = await db.select({ id: adminPushSubscriptions.id }).from(adminPushSubscriptions).limit(1);
    res.json({ configured: true, subscribed: Boolean(row) });
  });

  router.post("/push/subscribe", requireAdmin, async (req, res) => {
    if (!(await allowRequest(`admin-push-sub:${clientKey(req)}`, 20, 15 * 60 * 1000))) {
      res.status(429).json({ error: "too_many_requests" });
      return;
    }
    if (!pushConfigured()) {
      res.status(503).json({ error: "push_unavailable" });
      return;
    }
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const agent = String(req.headers["user-agent"] ?? "").slice(0, 240);
    const now = new Date();

    const [existing] = await db
      .select({ id: adminPushSubscriptions.id })
      .from(adminPushSubscriptions)
      .where(eq(adminPushSubscriptions.endpoint, parsed.data.endpoint))
      .limit(1);

    if (existing) {
      await db
        .update(adminPushSubscriptions)
        .set({
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent: agent || null,
          updatedAt: now,
        })
        .where(eq(adminPushSubscriptions.id, existing.id));
    } else {
      await db.insert(adminPushSubscriptions).values({
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: agent || null,
        createdAt: now,
        updatedAt: now,
      });
    }
    res.json({ ok: true });
  });

  router.delete("/push/subscribe", requireAdmin, async (req, res) => {
    const parsed = unsubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    if (parsed.data.endpoint) {
      await db.delete(adminPushSubscriptions).where(eq(adminPushSubscriptions.endpoint, parsed.data.endpoint));
    } else {
      await db.delete(adminPushSubscriptions);
    }
    res.json({ ok: true });
  });

  router.post("/push/test", requireAdmin, async (req, res) => {
    if (!(await allowRequest(`admin-push-test:${clientKey(req)}`, 8, 15 * 60 * 1000))) {
      res.status(429).json({ error: "too_many_requests" });
      return;
    }
    if (!pushConfigured()) {
      res.status(503).json({ error: "push_unavailable" });
      return;
    }
    const [row] = await db.select({ id: adminPushSubscriptions.id }).from(adminPushSubscriptions).limit(1);
    if (!row) {
      res.status(409).json({ error: "not_subscribed" });
      return;
    }
    await sendPushToOrganizers({
      title: "Espace organisateurs",
      body: "Les notifications fonctionnent sur cet appareil.",
      url: "/fr",
    });
    res.json({ ok: true });
  });
}

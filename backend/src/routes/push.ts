import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { requireMember, type MemberRequest } from "../lib/auth.js";
import { getVapidPublicKey, pushConfigured } from "../lib/push.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";

export const pushRouter = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2048),
  keys: z.object({
    p256dh: z.string().trim().min(10).max(200),
    auth: z.string().trim().min(8).max(200),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().url().max(2048).optional(),
});

pushRouter.get("/push/key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

pushRouter.get("/push/status", requireMember, async (req, res) => {
  const memberId = (req as MemberRequest).memberId;
  const configured = pushConfigured();
  if (!configured) {
    res.json({ configured: false, subscribed: false });
    return;
  }
  const [row] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId))
    .limit(1);
  res.json({ configured: true, subscribed: Boolean(row) });
});

pushRouter.post("/push/subscribe", requireMember, async (req, res) => {
  if (!allowRequest(`push-sub:${clientKey(req)}`, 20, 15 * 60 * 1000)) {
    res.status(429).json({ error: "too_many_requests" });
    return;
  }
  if (!pushConfigured()) {
    res.status(503).json({ error: "push_unavailable" });
    return;
  }
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const memberId = (req as MemberRequest).memberId;
  const agent = String(req.headers["user-agent"] ?? "").slice(0, 240);
  const now = new Date();

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, parsed.data.endpoint));
  await db.insert(pushSubscriptions).values({
    memberId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: agent || null,
    createdAt: now,
    updatedAt: now,
  });
  res.json({ ok: true });
});

pushRouter.delete("/push/subscribe", requireMember, async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const memberId = (req as MemberRequest).memberId;
  if (parsed.data.endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.memberId, memberId), eq(pushSubscriptions.endpoint, parsed.data.endpoint)),
      );
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.memberId, memberId));
  }
  res.json({ ok: true });
});

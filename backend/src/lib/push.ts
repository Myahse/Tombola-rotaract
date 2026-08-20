import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "../db/index.js";
import { members, pushSubscriptions } from "../db/schema.js";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

type VapidKeys = { publicKey: string; privateKey: string };

let vapid: VapidKeys | null | undefined;

function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function loadVapid(): VapidKeys | null {
  if (vapid !== undefined) return vapid;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (publicKey && privateKey) {
    vapid = { publicKey, privateKey };
    webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);
    return vapid;
  }

  if (isProduction()) {
    console.warn("VAPID keys are not set: push notifications are disabled");
    vapid = null;
    return null;
  }

  const generated = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = generated.publicKey;
  process.env.VAPID_PRIVATE_KEY = generated.privateKey;
  vapid = generated;
  webpush.setVapidDetails(vapidSubject(), generated.publicKey, generated.privateKey);
  console.warn(
    "Generated ephemeral VAPID keys for local development. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to keep subscriptions across restarts.",
  );
  return vapid;
}

function vapidSubject() {
  const fromEnv = process.env.VAPID_SUBJECT?.trim();
  if (fromEnv) return fromEnv;
  const sender = process.env.BREVO_SENDER_EMAIL?.trim();
  if (sender) return `mailto:${sender}`;
  return "https://tombola.rotaractiugb.com";
}

export function getVapidPublicKey() {
  return loadVapid()?.publicKey ?? null;
}

export function pushConfigured() {
  return Boolean(loadVapid());
}

export function isAllowedPushEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const allowed = [
      "fcm.googleapis.com",
      "android.googleapis.com",
      "updates.push.services.mozilla.com",
      "updates-autopush.stage.mozaws.net",
      "web.push.apple.com",
      "push.apple.com",
    ];
    if (allowed.some((item) => host === item || host.endsWith(`.${item}`))) return true;
    if (host.endsWith(".notify.windows.com") || host === "notify.windows.com") return true;
    if (host.endsWith(".push.services.mozilla.com")) return true;
    return false;
  } catch {
    return false;
  }
}

function goneStatus(error: unknown) {
  const status = (error as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
}

async function sendToRow(
  row: typeof pushSubscriptions.$inferSelect,
  payload: PushPayload,
) {
  if (!isAllowedPushEndpoint(row.endpoint)) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
    return;
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "high" },
    );
  } catch (error) {
    if (goneStatus(error)) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
      return;
    }
    console.error("Push send failed", error);
  }
}

export async function sendPushToMember(memberId: string, payload: PushPayload) {
  if (!loadVapid()) return;
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId));
  await Promise.all(rows.map((row) => sendToRow(row, payload)));
}

export async function sendPushToEmail(email: string, payload: PushPayload) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !loadVapid()) return;
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, normalized))
    .limit(1);
  if (!member) return;
  await sendPushToMember(member.id, payload);
}

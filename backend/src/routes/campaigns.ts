import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { campaignAttachments, campaignRecipients, campaigns, members, orders } from "../db/schema.js";
import { campaignEmail } from "../emails/campaign.js";
import { campaignImageUrl } from "../emails/layout.js";
import { requireAdmin } from "../lib/auth.js";
import { isBrevoConfigured, sendBrevoEmail, type EmailAttachment } from "../lib/brevo.js";
import { allowRequest, clientKey } from "../lib/rateLimit.js";

export const campaignRouter = Router();

const sending = new Set<string>();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_TYPES = new Set(["application/pdf"]);
const MAX_ATTACHMENTS = 8;
const MAX_RECIPIENTS = 800;
const MAX_IMAGE_CHARS = 1_800_000;
const MAX_DOCUMENT_CHARS = 4_000_000;

const saveSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  subject: z.string().trim().min(2).max(180),
  preheader: z.string().trim().max(180).default(""),
  heading: z.string().trim().max(180).default(""),
  body: z.string().trim().max(8000).default(""),
  ctaLabel: z.string().trim().max(80).default(""),
  ctaUrl: z.string().trim().max(500).default(""),
  includeMembers: z.boolean().default(true),
  includeBuyers: z.boolean().default(false),
  optedInOnly: z.boolean().default(true),
  extraEmails: z.string().max(20000).default(""),
});

campaignRouter.use(requireAdmin);

function parseExtraEmails(raw: string) {
  const seen = new Set<string>();
  const emails: string[] = [];
  let invalid = 0;
  for (const part of raw.split(/[,;\n\r\t ]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    if (emails.length >= 400) break;
  }
  return { emails, invalid };
}

type Recipient = { email: string; name: string; source: "member" | "buyer" | "custom" };

async function resolveAudience(input: {
  includeMembers: boolean;
  includeBuyers: boolean;
  optedInOnly: boolean;
  extraEmails: string;
}) {
  const map = new Map<string, Recipient>();

  if (input.includeMembers) {
    const rows = input.optedInOnly
      ? await db
          .select({ email: members.email, name: members.name })
          .from(members)
          .where(isNotNull(members.emailsAcceptedAt))
      : await db.select({ email: members.email, name: members.name }).from(members);
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || map.has(email)) continue;
      map.set(email, { email, name: row.name, source: "member" });
    }
  }

  if (input.includeBuyers) {
    const rows = await db
      .select({ email: orders.buyerEmail, name: orders.buyerName })
      .from(orders)
      .where(eq(orders.status, "paid"));
    const opted = input.optedInOnly
      ? new Set(
          (
            await db
              .select({ email: members.email })
              .from(members)
              .where(isNotNull(members.emailsAcceptedAt))
          ).map((row) => row.email.trim().toLowerCase()),
        )
      : null;
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || map.has(email)) continue;
      if (opted && !opted.has(email)) continue;
      map.set(email, { email, name: row.name, source: "buyer" });
    }
  }

  const extra = parseExtraEmails(input.extraEmails);
  for (const email of extra.emails) {
    if (map.has(email)) continue;
    map.set(email, { email, name: email.split("@")[0] ?? "", source: "custom" });
  }

  return {
    recipients: [...map.values()].slice(0, MAX_RECIPIENTS),
    invalid: extra.invalid,
    truncated: map.size > MAX_RECIPIENTS,
  };
}

function publicCampaign(row: typeof campaigns.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    heading: row.heading,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl,
    includeMembers: row.includeMembers,
    includeBuyers: row.includeBuyers,
    optedInOnly: row.optedInOnly,
    extraEmails: row.extraEmails,
    status: row.status,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    recipientCount: row.recipientCount,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sentAt: row.sentAt,
  };
}

function publicAttachment(row: typeof campaignAttachments.$inferSelect) {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    inline: row.inline,
    bytes: Math.floor((row.content.length * 3) / 4),
  };
}

async function loadCampaign(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

async function attachmentsFor(campaignId: string) {
  return db
    .select()
    .from(campaignAttachments)
    .where(eq(campaignAttachments.campaignId, campaignId))
    .orderBy(campaignAttachments.createdAt);
}

function brevoAttachments(files: typeof campaignAttachments.$inferSelect[]): EmailAttachment[] {
  return files
    .filter((file) => !file.inline)
    .map((file) => ({
      name: file.filename,
      content: file.content,
    }));
}

function inlineImageRefs(files: typeof campaignAttachments.$inferSelect[]) {
  return files
    .filter((file) => file.inline)
    .map((file) => ({ url: campaignImageUrl(file.id), filename: file.filename }));
}

campaignRouter.get("/meta", async (_req, res) => {
  const memberRows = await db.select({ email: members.email, accepted: members.emailsAcceptedAt }).from(members);
  const buyerRows = await db.select({ email: orders.buyerEmail }).from(orders).where(eq(orders.status, "paid"));
  const buyers = new Set(buyerRows.map((row) => row.email.trim().toLowerCase()).filter((email) => EMAIL_RE.test(email)));
  res.json({
    brevo: isBrevoConfigured(),
    audience: {
      members: memberRows.length,
      optedIn: memberRows.filter((row) => row.accepted).length,
      buyers: buyers.size,
    },
  });
});

campaignRouter.get("/people", async (_req, res) => {
  const memberRows = await db
    .select({ email: members.email, name: members.name, accepted: members.emailsAcceptedAt })
    .from(members);
  const buyerRows = await db
    .select({ email: orders.buyerEmail, name: orders.buyerName })
    .from(orders)
    .where(eq(orders.status, "paid"));

  const map = new Map<
    string,
    { email: string; name: string; member: boolean; buyer: boolean; optedIn: boolean }
  >();
  for (const row of memberRows) {
    const email = row.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    map.set(email, {
      email,
      name: row.name,
      member: true,
      buyer: false,
      optedIn: Boolean(row.accepted),
    });
  }
  for (const row of buyerRows) {
    const email = row.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const existing = map.get(email);
    if (existing) {
      existing.buyer = true;
      if (!existing.name.trim()) existing.name = row.name;
    } else {
      map.set(email, {
        email,
        name: row.name,
        member: false,
        buyer: true,
        optedIn: false,
      });
    }
  }

  const people = [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }) || a.email.localeCompare(b.email))
    .slice(0, MAX_RECIPIENTS);
  res.json({ people });
});

campaignRouter.post("/preview-html", async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const data = parsed.data;
  const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId : "";
  const files = campaignId ? await attachmentsFor(campaignId) : [];
  const sample = { name: "Awa Koné", email: "awa@example.com" };
  const message = campaignEmail({
    name: sample.name,
    email: sample.email,
    subject: data.subject,
    preheader: data.preheader,
    heading: data.heading,
    body: data.body,
    ctaLabel: data.ctaLabel,
    ctaUrl: data.ctaUrl,
    inlineImages: inlineImageRefs(files),
  });
  let html = message.html;
  for (const file of files.filter((item) => item.inline)) {
    html = html.replaceAll(
      campaignImageUrl(file.id),
      `data:${file.mimeType};base64,${file.content}`,
    );
  }
  res.json({ subject: message.subject, html });
});

campaignRouter.post("/preview-audience", async (req, res) => {
  const parsed = saveSchema.pick({
    includeMembers: true,
    includeBuyers: true,
    optedInOnly: true,
    extraEmails: true,
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const result = await resolveAudience(parsed.data);
  res.json({
    total: result.recipients.length,
    invalid: result.invalid,
    truncated: result.truncated,
    recipients: result.recipients.slice(0, 400),
  });
});

campaignRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(80);
  res.json({ campaigns: rows.map(publicCampaign) });
});

campaignRouter.post("/", async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const data = parsed.data;
  const [created] = await db
    .insert(campaigns)
    .values({
      name: data.name?.trim() || data.subject,
      subject: data.subject,
      preheader: data.preheader,
      heading: data.heading,
      body: data.body,
      ctaLabel: data.ctaLabel,
      ctaUrl: data.ctaUrl,
      includeMembers: data.includeMembers,
      includeBuyers: data.includeBuyers,
      optedInOnly: data.optedInOnly,
      extraEmails: data.extraEmails,
    })
    .returning();
  res.json({ campaign: publicCampaign(created) });
});

campaignRouter.get("/:id", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const files = await attachmentsFor(campaign.id);
  const recipients = await db
    .select({
      email: campaignRecipients.email,
      name: campaignRecipients.name,
      source: campaignRecipients.source,
      status: campaignRecipients.status,
      error: campaignRecipients.error,
      sentAt: campaignRecipients.sentAt,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaign.id))
    .orderBy(campaignRecipients.email)
    .limit(500);
  res.json({
    campaign: publicCampaign(campaign),
    attachments: files.map(publicAttachment),
    recipients,
  });
});

campaignRouter.put("/:id", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    res.status(409).json({ error: "locked" });
    return;
  }
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_form" });
    return;
  }
  const data = parsed.data;
  const [updated] = await db
    .update(campaigns)
    .set({
      name: data.name?.trim() || data.subject,
      subject: data.subject,
      preheader: data.preheader,
      heading: data.heading,
      body: data.body,
      ctaLabel: data.ctaLabel,
      ctaUrl: data.ctaUrl,
      includeMembers: data.includeMembers,
      includeBuyers: data.includeBuyers,
      optedInOnly: data.optedInOnly,
      extraEmails: data.extraEmails,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id))
    .returning();
  res.json({ campaign: publicCampaign(updated) });
});

campaignRouter.delete("/:id", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (campaign.status === "sending") {
    res.status(409).json({ error: "locked" });
    return;
  }
  await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
  res.json({ ok: true });
});

campaignRouter.post("/:id/duplicate", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const [copy] = await db
    .insert(campaigns)
    .values({
      name: `${campaign.name} (copie)`,
      subject: campaign.subject,
      preheader: campaign.preheader,
      heading: campaign.heading,
      body: campaign.body,
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl,
      includeMembers: campaign.includeMembers,
      includeBuyers: campaign.includeBuyers,
      optedInOnly: campaign.optedInOnly,
      extraEmails: campaign.extraEmails,
    })
    .returning();
  const files = await attachmentsFor(campaign.id);
  if (files.length) {
    await db.insert(campaignAttachments).values(
      files.map((file) => ({
        campaignId: copy.id,
        filename: file.filename,
        mimeType: file.mimeType,
        content: file.content,
        inline: file.inline,
      })),
    );
  }
  res.json({ campaign: publicCampaign(copy) });
});

campaignRouter.post("/:id/attachments", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    res.status(409).json({ error: "locked" });
    return;
  }
  const parsed = z
    .object({
      filename: z.string().trim().min(1).max(120),
      mimeType: z.string().trim().min(3).max(80),
      content: z.string().min(24),
      inline: z.boolean().default(true),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_attachment" });
    return;
  }
  const { mimeType, content } = parsed.data;
  const isImage = IMAGE_TYPES.has(mimeType);
  const isDocument = DOCUMENT_TYPES.has(mimeType);
  if (!isImage && !isDocument) {
    res.status(400).json({ error: "invalid_attachment" });
    return;
  }
  const maxChars = isDocument ? MAX_DOCUMENT_CHARS : MAX_IMAGE_CHARS;
  if (content.length > maxChars) {
    res.status(400).json({ error: "file_too_large" });
    return;
  }
  const existing = await attachmentsFor(campaign.id);
  if (existing.length >= MAX_ATTACHMENTS) {
    res.status(400).json({ error: "too_many_attachments" });
    return;
  }
  const inline = isDocument ? false : parsed.data.inline;
  const filename = parsed.data.filename.replace(/[^\w.\- ()àâéèêëïîôùüç]+/gi, "_").slice(0, 80);
  const [created] = await db
    .insert(campaignAttachments)
    .values({
      campaignId: campaign.id,
      filename: filename || (isDocument ? "document.pdf" : "image.jpg"),
      mimeType,
      content: content.replace(/^data:[^;]+;base64,/, ""),
      inline,
    })
    .returning();
  res.json({ attachment: publicAttachment(created) });
});

campaignRouter.get("/:id/attachments/:attachmentId", async (req, res) => {
  const [file] = await db
    .select()
    .from(campaignAttachments)
    .where(
      and(eq(campaignAttachments.id, req.params.attachmentId), eq(campaignAttachments.campaignId, req.params.id)),
    )
    .limit(1);
  if (!file) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const buffer = Buffer.from(file.content, "base64");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buffer);
});

campaignRouter.delete("/:id/attachments/:attachmentId", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    res.status(409).json({ error: "locked" });
    return;
  }
  await db
    .delete(campaignAttachments)
    .where(
      and(eq(campaignAttachments.id, req.params.attachmentId), eq(campaignAttachments.campaignId, campaign.id)),
    );
  res.json({ ok: true });
});

campaignRouter.post("/:id/test", async (req, res) => {
  if (!(await allowRequest(`campaign-test:${clientKey(req)}`, 20, 60 * 60 * 1000))) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const email = String((req.body as { email?: string })?.email ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  if (!isBrevoConfigured()) {
    res.status(400).json({ error: "brevo_not_configured" });
    return;
  }
  const files = await attachmentsFor(campaign.id);
  const message = campaignEmail({
    name: "Test",
    email,
    subject: campaign.subject,
    preheader: campaign.preheader,
    heading: campaign.heading,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    inlineImages: inlineImageRefs(files),
  });
  await sendBrevoEmail({
    to: { email, name: "Test" },
    subject: `[Test] ${message.subject}`,
    html: message.html,
    text: message.text,
    attachments: brevoAttachments(files),
  });
  res.json({ ok: true });
});

campaignRouter.post("/:id/send", async (req, res) => {
  if (!(await allowRequest(`campaign-send:${clientKey(req)}`, 8, 60 * 60 * 1000))) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (campaign.status === "sent" || campaign.status === "sending") {
    res.status(409).json({ error: "locked" });
    return;
  }
  if (!isBrevoConfigured()) {
    res.status(400).json({ error: "brevo_not_configured" });
    return;
  }
  const audience = await resolveAudience(campaign);
  if (!audience.recipients.length) {
    res.status(400).json({ error: "no_recipients" });
    return;
  }
  if (sending.has(campaign.id)) {
    res.status(409).json({ error: "locked" });
    return;
  }
  sending.add(campaign.id);
  await db
    .update(campaigns)
    .set({
      status: "sending",
      recipientCount: audience.recipients.length,
      sentCount: 0,
      failedCount: 0,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaign.id));
  await db.insert(campaignRecipients).values(
    audience.recipients.map((person) => ({
      campaignId: campaign.id,
      email: person.email,
      name: person.name,
      source: person.source,
      status: "pending",
    })),
  );

  res.json({
    ok: true,
    status: "sending",
    recipientCount: audience.recipients.length,
  });

  void runSend(campaign.id).finally(() => sending.delete(campaign.id));
});

async function runSend(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) return;
  const files = await attachmentsFor(campaignId);
  const people = await db
    .select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  const attachments = brevoAttachments(files);
  const inlineImages = inlineImageRefs(files);

  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  for (const person of people) {
    const message = campaignEmail({
      name: person.name,
      email: person.email,
      subject: campaign.subject,
      preheader: campaign.preheader,
      heading: campaign.heading,
      body: campaign.body,
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl,
      inlineImages,
    });
    try {
      const result = await sendBrevoEmail({
        to: { email: person.email, name: person.name },
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments,
      });
      if (result.skipped) {
        throw new Error("brevo_not_configured");
      }
      sentCount += 1;
      await db
        .update(campaignRecipients)
        .set({ status: "sent", sentAt: new Date(), error: null })
        .where(eq(campaignRecipients.id, person.id));
    } catch (error) {
      failedCount += 1;
      lastError = error instanceof Error ? error.message.slice(0, 400) : "send_failed";
      await db
        .update(campaignRecipients)
        .set({ status: "failed", error: lastError })
        .where(eq(campaignRecipients.id, person.id));
    }
    await db
      .update(campaigns)
      .set({ sentCount, failedCount, lastError, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
    await sleep(80);
  }

  await db
    .update(campaigns)
    .set({
      status: sentCount ? "sent" : "failed",
      sentCount,
      failedCount,
      lastError,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

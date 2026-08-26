import { randomBytes } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { members, qcmAttempts, qcmExams, qcmInvites } from "../db/schema.js";
import type { QcmExamRow, QcmInviteRow } from "../db/schema.js";
import { examSiteUrl } from "../emails/layout.js";
import { adminQuestions, monitorAttempts, publicExam, publishQcm, stopLiveAttempts } from "./qcm.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITE_EMAILS = 80;

export function parseInviteEmails(emails: string[]) {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
    if (valid.length >= MAX_INVITE_EMAILS) break;
  }
  return valid;
}

function newToken() {
  return randomBytes(24).toString("hex");
}

export function inviteUrl(lang: "fr" | "en", slug: string, token: string) {
  return examSiteUrl(`/${lang}/${slug}?invite=${encodeURIComponent(token)}`);
}

export function parseScheduledAt(value: string | null | undefined) {
  if (!value?.trim()) return { error: "need_appointment" as const };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: "invalid_form" as const };
  const max = Date.now() + 2 * 365 * 24 * 60 * 60 * 1000;
  if (date.getTime() > max) return { error: "invalid_form" as const };
  return { date };
}

export function publicInvite(row: QcmInviteRow, exam: QcmExamRow, lang: "fr" | "en") {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    examUrl: inviteUrl(lang, exam.slug, row.token),
  };
}

export async function listLiveInvites(examId: string) {
  return db
    .select()
    .from(qcmInvites)
    .where(and(eq(qcmInvites.examId, examId), isNull(qcmInvites.archivedAt)))
    .orderBy(desc(qcmInvites.createdAt));
}

export async function listArchives(examId: string) {
  const [attemptRows, inviteRows] = await Promise.all([
    db
      .select({ archivedAt: qcmAttempts.archivedAt, count: count() })
      .from(qcmAttempts)
      .where(and(eq(qcmAttempts.examId, examId), sql`${qcmAttempts.archivedAt} is not null`))
      .groupBy(qcmAttempts.archivedAt),
    db
      .select({ archivedAt: qcmInvites.archivedAt, count: count() })
      .from(qcmInvites)
      .where(and(eq(qcmInvites.examId, examId), sql`${qcmInvites.archivedAt} is not null`))
      .groupBy(qcmInvites.archivedAt),
  ]);
  const map = new Map<string, { archivedAt: string; attempts: number; invites: number }>();
  const bump = (at: Date | null, field: "attempts" | "invites", n: number) => {
    if (!at) return;
    const archivedAt = at.toISOString();
    const current = map.get(archivedAt) ?? { archivedAt, attempts: 0, invites: 0 };
    current[field] += n;
    map.set(archivedAt, current);
  };
  for (const row of attemptRows) bump(row.archivedAt, "attempts", Number(row.count));
  for (const row of inviteRows) bump(row.archivedAt, "invites", Number(row.count));
  return [...map.values()].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export async function resolveInvite(examId: string, memberId: string, token?: string | null) {
  const [member] = await db
    .select({ id: members.id, email: members.email, name: members.name })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member) return { error: "not_invited" as const };
  const email = member.email.trim().toLowerCase();

  if (token?.trim()) {
    const [invite] = await db.select().from(qcmInvites).where(eq(qcmInvites.token, token.trim())).limit(1);
    if (!invite || invite.examId !== examId || invite.archivedAt) {
      return { error: "not_invited" as const };
    }
    if (invite.email !== email) return { error: "invite_mismatch" as const };
    return { invite, member };
  }

  const [invite] = await db
    .select()
    .from(qcmInvites)
    .where(and(eq(qcmInvites.examId, examId), eq(qcmInvites.email, email), isNull(qcmInvites.archivedAt)))
    .limit(1);
  if (!invite) return { error: "not_invited" as const };
  return { invite, member };
}

export async function markInviteStarted(invite: QcmInviteRow, memberId: string) {
  await db
    .update(qcmInvites)
    .set({
      status: invite.status === "completed" ? invite.status : "started",
      memberId,
    })
    .where(eq(qcmInvites.id, invite.id));
}

export async function markInviteCompleted(inviteId: string | null | undefined) {
  if (!inviteId) return;
  await db.update(qcmInvites).set({ status: "completed" }).where(eq(qcmInvites.id, inviteId));
}

export async function upsertInvites(exam: QcmExamRow, emails: string[], lang: "fr" | "en", scheduledAt: Date) {
  const found = emails.length
    ? await db
        .select({ id: members.id, name: members.name, email: members.email })
        .from(members)
        .where(inArray(members.email, emails))
    : [];
  const byEmail = new Map(found.map((row) => [row.email.trim().toLowerCase(), row]));
  const existing = await listLiveInvites(exam.id);
  const existingByEmail = new Map(existing.map((row) => [row.email, row]));
  const now = new Date();
  const rows: QcmInviteRow[] = [];

  for (const email of emails) {
    const member = byEmail.get(email);
    const current = existingByEmail.get(email);
    if (current) {
      const [updated] = await db
        .update(qcmInvites)
        .set({
          sentAt: now,
          memberId: member?.id ?? current.memberId,
          status: current.status === "completed" ? current.status : current.status === "started" ? current.status : "pending",
        })
        .where(eq(qcmInvites.id, current.id))
        .returning();
      if (updated) rows.push(updated);
      continue;
    }
    const [created] = await db
      .insert(qcmInvites)
      .values({
        examId: exam.id,
        email,
        memberId: member?.id ?? null,
        token: newToken(),
        status: "pending",
        sentAt: now,
      })
      .returning();
    if (created) rows.push(created);
  }

  return rows.map((row) => {
    const member = byEmail.get(row.email);
    return {
      name: member?.name || row.email.split("@")[0] || row.email,
      email: row.email,
      memberId: member?.id,
      titleFr: exam.titleFr,
      titleEn: exam.titleEn,
      slug: exam.slug,
      examUrl: inviteUrl(lang, exam.slug, row.token),
      lang,
      scheduledAt: scheduledAt.toISOString(),
      durationSeconds: exam.examDurationSeconds && exam.examDurationSeconds > 0 ? exam.examDurationSeconds : null,
      inviteId: row.id,
    };
  });
}

export async function archiveLiveSession(examId: string) {
  const exam = await getExamRow(examId);
  if (!exam) return { error: "not_found" as const };
  const [attempts, invites] = await Promise.all([monitorAttempts(examId), listLiveInvites(examId)]);
  if (!attempts.length && !invites.length) return { error: "no_session" as const };
  await stopLiveAttempts(examId);
  const now = new Date();
  await db
    .update(qcmAttempts)
    .set({ archivedAt: now })
    .where(and(eq(qcmAttempts.examId, examId), isNull(qcmAttempts.archivedAt)));
  await db
    .update(qcmInvites)
    .set({ archivedAt: now, status: "archived" })
    .where(and(eq(qcmInvites.examId, examId), isNull(qcmInvites.archivedAt)));
  await db
    .update(qcmExams)
    .set({ scoresSentAt: null, status: "closed", updatedAt: now })
    .where(eq(qcmExams.id, examId));
  publishQcm("exam");
  return payloadForExam(examId);
}

export async function deleteArchive(examId: string, archivedAtIso: string) {
  const archivedAt = new Date(archivedAtIso);
  if (Number.isNaN(archivedAt.getTime())) return { error: "invalid_form" as const };
  const sameBatch = sql`date_trunc('milliseconds', ${archivedAtIso}::timestamptz)`;
  await db
    .delete(qcmAttempts)
    .where(
      and(eq(qcmAttempts.examId, examId), sql`date_trunc('milliseconds', ${qcmAttempts.archivedAt}) = ${sameBatch}`),
    );
  await db
    .delete(qcmInvites)
    .where(
      and(eq(qcmInvites.examId, examId), sql`date_trunc('milliseconds', ${qcmInvites.archivedAt}) = ${sameBatch}`),
    );
  publishQcm("exam");
  return payloadForExam(examId);
}

async function getExamRow(examId: string) {
  const [exam] = await db.select().from(qcmExams).where(eq(qcmExams.id, examId)).limit(1);
  return exam ?? null;
}

export async function payloadForExam(examId: string, lang: "fr" | "en" = "fr") {
  const exam = await getExamRow(examId);
  if (!exam) return { exam: null, questions: [], attempts: [], invites: [], archives: [] };
  const [questions, attempts, invites, archives] = await Promise.all([
    adminQuestions(exam.id),
    monitorAttempts(exam.id),
    listLiveInvites(exam.id),
    listArchives(exam.id),
  ]);
  return {
    exam: publicExam(exam),
    questions,
    attempts,
    invites: invites.map((row) => publicInvite(row, exam, lang)),
    archives,
  };
}

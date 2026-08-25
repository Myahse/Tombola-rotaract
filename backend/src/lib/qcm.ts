import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { members, qcmAnswers, qcmAttempts, qcmExams, qcmQuestions } from "../db/schema.js";
import type { QcmAttemptRow, QcmExamRow, QcmQuestionRow } from "../db/schema.js";
import { broadcast } from "./realtime.js";

export type QcmChoice = { id: string; textFr: string; textEn: string };

export type PublicQuestion = {
  id: string;
  position: number;
  promptFr: string;
  promptEn: string;
  choices: QcmChoice[];
};

export type PublicAttempt = {
  id: string;
  status: "in_progress" | "completed";
  currentIndex: number;
  questionCount: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
};

export type MonitorAttempt = PublicAttempt & {
  memberId: string;
  memberName: string;
  memberEmail: string;
  clubName: string | null;
  clubRole: string | null;
  lastCorrect: boolean | null;
  lastAnsweredAt: string | null;
};

export function parseChoices(raw: string): QcmChoice[] {
  try {
    const parsed = JSON.parse(raw) as QcmChoice[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((choice) => choice && typeof choice.id === "string");
  } catch {
    return [];
  }
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleChoices(choices: QcmChoice[], seed: string) {
  const next = [...choices];
  let state = hashSeed(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function publicExam(row: QcmExamRow) {
  return {
    id: row.id,
    titleFr: row.titleFr,
    titleEn: row.titleEn,
    questionCount: row.questionCount,
    passScore: row.passScore,
    status: row.status,
    scoresSent: Boolean(row.scoresSentAt),
    slug: row.slug,
  };
}

export function publicAttempt(row: QcmAttemptRow, questionCount: number): PublicAttempt {
  return {
    id: row.id,
    status: row.status === "completed" ? "completed" : "in_progress",
    currentIndex: row.currentIndex,
    questionCount,
    score: row.score,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export function publicQuestion(row: QcmQuestionRow, seed: string): PublicQuestion {
  return {
    id: row.id,
    position: row.position,
    promptFr: row.promptFr,
    promptEn: row.promptEn,
    choices: shuffleChoices(parseChoices(row.choices), `${seed}:${row.id}`),
  };
}

export async function getExamBySlug(slug: string) {
  const value = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(value)) return null;
  const [exam] = await db.select().from(qcmExams).where(eq(qcmExams.slug, value)).limit(1);
  return exam ?? null;
}

export async function getInductionExam() {
  return getExamBySlug("induction");
}

export async function questionAt(examId: string, position: number) {
  const [row] = await db
    .select()
    .from(qcmQuestions)
    .where(and(eq(qcmQuestions.examId, examId), eq(qcmQuestions.position, position)))
    .limit(1);
  return row ?? null;
}

export async function memberAttempt(examId: string, memberId: string) {
  const [row] = await db
    .select()
    .from(qcmAttempts)
    .where(and(eq(qcmAttempts.examId, examId), eq(qcmAttempts.memberId, memberId)))
    .limit(1);
  return row ?? null;
}

export async function monitorAttempts(examId: string): Promise<MonitorAttempt[]> {
  const rows = await db
    .select({
      attempt: qcmAttempts,
      memberName: members.name,
      memberEmail: members.email,
      clubName: members.clubName,
      clubRole: members.clubRole,
    })
    .from(qcmAttempts)
    .innerJoin(members, eq(members.id, qcmAttempts.memberId))
    .where(eq(qcmAttempts.examId, examId))
    .orderBy(
      sql`case when ${qcmAttempts.status} = 'in_progress' then 0 else 1 end`,
      desc(qcmAttempts.lastAnsweredAt),
      desc(qcmAttempts.startedAt),
    );

  const attemptIds = rows.map((row) => row.attempt.id);
  const lastByAttempt = new Map<string, boolean>();
  if (attemptIds.length) {
    const answers = await db
      .select()
      .from(qcmAnswers)
      .where(inArray(qcmAnswers.attemptId, attemptIds))
      .orderBy(desc(qcmAnswers.answeredAt));
    for (const answer of answers) {
      if (!lastByAttempt.has(answer.attemptId)) {
        lastByAttempt.set(answer.attemptId, answer.correct);
      }
    }
  }

  const [exam] = await db.select().from(qcmExams).where(eq(qcmExams.id, examId)).limit(1);
  const questionCount = exam?.questionCount ?? 20;

  return rows.map((row) => ({
    ...publicAttempt(row.attempt, questionCount),
    memberId: row.attempt.memberId,
    memberName: row.memberName,
    memberEmail: row.memberEmail,
    clubName: row.clubName,
    clubRole: row.clubRole,
    lastCorrect: lastByAttempt.get(row.attempt.id) ?? null,
    lastAnsweredAt: row.attempt.lastAnsweredAt ? row.attempt.lastAnsweredAt.toISOString() : null,
  }));
}

export async function adminQuestions(examId: string) {
  const rows = await db
    .select()
    .from(qcmQuestions)
    .where(eq(qcmQuestions.examId, examId))
    .orderBy(asc(qcmQuestions.position));
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    promptFr: row.promptFr,
    promptEn: row.promptEn,
    choices: parseChoices(row.choices),
    correctChoiceId: row.correctChoiceId,
  }));
}

export function publishQcm(reason: "start" | "answer" | "complete" | "exam") {
  const message = { type: "qcm.changed" as const, reason };
  broadcast(message, "monitor");
  broadcast(message, "candidate");
}

export async function stopLiveAttempts(examId: string) {
  const live = await db
    .select({ id: qcmAttempts.id })
    .from(qcmAttempts)
    .where(and(eq(qcmAttempts.examId, examId), eq(qcmAttempts.status, "in_progress")));
  const now = new Date();
  for (const row of live) {
    const [totals] = await db
      .select({ value: count() })
      .from(qcmAnswers)
      .where(and(eq(qcmAnswers.attemptId, row.id), eq(qcmAnswers.correct, true)));
    await db
      .update(qcmAttempts)
      .set({
        status: "completed",
        completedAt: now,
        score: Number(totals?.value ?? 0),
      })
      .where(eq(qcmAttempts.id, row.id));
  }
}

export async function saveInductionExam(input: {
  titleFr: string;
  titleEn: string;
  passScore: number;
  questions: Array<{
    promptFr: string;
    promptEn: string;
    choices: QcmChoice[];
    correctChoiceId: string;
  }>;
}) {
  const exam = await getInductionExam();
  if (!exam) return { error: "not_found" as const };
  if (exam.status === "open") return { error: "qcm_locked" as const };

  const [live] = await db
    .select({ id: qcmAttempts.id })
    .from(qcmAttempts)
    .where(and(eq(qcmAttempts.examId, exam.id), eq(qcmAttempts.status, "in_progress")))
    .limit(1);
  if (live) return { error: "qcm_locked" as const };

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(qcmExams)
      .set({
        titleFr: input.titleFr,
        titleEn: input.titleEn,
        passScore: input.passScore,
        questionCount: input.questions.length,
        updatedAt: new Date(),
      })
      .where(eq(qcmExams.id, exam.id))
      .returning();

    await tx.delete(qcmQuestions).where(eq(qcmQuestions.examId, exam.id));
    if (input.questions.length) {
      await tx.insert(qcmQuestions).values(
        input.questions.map((question, index) => ({
          examId: exam.id,
          position: index + 1,
          promptFr: question.promptFr,
          promptEn: question.promptEn,
          choices: JSON.stringify(question.choices),
          correctChoiceId: question.correctChoiceId,
        })),
      );
    }
    return [row];
  });

  publishQcm("exam");
  return {
    exam: updated ? publicExam(updated) : publicExam({ ...exam, ...input, questionCount: input.questions.length }),
    questions: await adminQuestions(exam.id),
    attempts: await monitorAttempts(exam.id),
  };
}

export async function seedInductionQcm() {
  const existing = await getInductionExam();
  if (existing) return existing;

  const [exam] = await db
    .insert(qcmExams)
    .values({
      slug: "induction",
      titleFr: "QCM d’intronisation",
      titleEn: "Induction quiz",
      questionCount: 0,
      passScore: 1,
      status: "draft",
    })
    .returning();

  return exam ?? null;
}

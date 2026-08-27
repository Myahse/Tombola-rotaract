import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, isUniqueViolation } from "../db/index.js";
import { members, qcmAnswers, qcmAttempts, qcmExams, qcmInvites, qcmQuestions } from "../db/schema.js";
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
  examEndsAt: string | null;
  questionEndsAt: string | null;
};

export type MonitorAttempt = PublicAttempt & {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberGender: string | null;
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
    examDurationSeconds: row.examDurationSeconds && row.examDurationSeconds > 0 ? row.examDurationSeconds : null,
    questionDurationSeconds:
      row.questionDurationSeconds && row.questionDurationSeconds > 0 ? row.questionDurationSeconds : null,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
  };
}

const TIMEOUT_CHOICE = "-";
const TIMER_GRACE_MS = 1500;

export function examDeadline(exam: QcmExamRow, attempt: QcmAttemptRow) {
  const seconds = exam.examDurationSeconds;
  if (!seconds || seconds < 1) return null;
  return new Date(attempt.startedAt.getTime() + seconds * 1000);
}

export function questionDeadline(exam: QcmExamRow, attempt: QcmAttemptRow) {
  const seconds = exam.questionDurationSeconds;
  if (!seconds || seconds < 1) return null;
  const start = attempt.questionStartedAt ?? attempt.lastAnsweredAt ?? attempt.startedAt;
  return new Date(start.getTime() + seconds * 1000);
}

export function publicAttempt(
  row: QcmAttemptRow,
  questionCount: number,
  exam?: QcmExamRow | null,
  options?: { hideScore?: boolean },
): PublicAttempt {
  const examEnd = exam ? examDeadline(exam, row) : null;
  const questionEnd = exam && row.status !== "completed" ? questionDeadline(exam, row) : null;
  return {
    id: row.id,
    status: row.status === "completed" ? "completed" : "in_progress",
    currentIndex: row.currentIndex,
    questionCount,
    score: options?.hideScore ? null : row.score,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    examEndsAt: examEnd ? examEnd.toISOString() : null,
    questionEndsAt: questionEnd ? questionEnd.toISOString() : null,
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
    .where(and(eq(qcmAttempts.examId, examId), eq(qcmAttempts.memberId, memberId), isNull(qcmAttempts.archivedAt)))
    .limit(1);
  return row ?? null;
}

export async function monitorAttempts(examId: string): Promise<MonitorAttempt[]> {
  const rows = await db
    .select({
      attempt: qcmAttempts,
      memberName: members.name,
      memberEmail: members.email,
      memberGender: members.gender,
      clubName: members.clubName,
      clubRole: members.clubRole,
    })
    .from(qcmAttempts)
    .innerJoin(members, eq(members.id, qcmAttempts.memberId))
    .where(and(eq(qcmAttempts.examId, examId), isNull(qcmAttempts.archivedAt)))
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
    ...publicAttempt(row.attempt, questionCount, exam),
    memberId: row.attempt.memberId,
    memberName: row.memberName,
    memberEmail: row.memberEmail,
    memberGender: row.memberGender,
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

export async function completeAttempt(attemptId: string, now = new Date()) {
  const [totals] = await db
    .select({ value: count() })
    .from(qcmAnswers)
    .where(and(eq(qcmAnswers.attemptId, attemptId), eq(qcmAnswers.correct, true)));
  const [updated] = await db
    .update(qcmAttempts)
    .set({
      status: "completed",
      completedAt: now,
      score: Number(totals?.value ?? 0),
    })
    .where(and(eq(qcmAttempts.id, attemptId), eq(qcmAttempts.status, "in_progress")))
    .returning();
  if (updated?.inviteId) {
    await db.update(qcmInvites).set({ status: "completed" }).where(eq(qcmInvites.id, updated.inviteId));
  }
  return updated ?? null;
}

async function timeoutCurrentQuestion(exam: QcmExamRow, attempt: QcmAttemptRow, now: Date, finish: boolean) {
  const question = await questionAt(exam.id, attempt.currentIndex + 1);
  const nextIndex = attempt.currentIndex + 1;
  const done = finish || nextIndex >= exam.questionCount;
  try {
    if (question) {
      await db.insert(qcmAnswers).values({
        attemptId: attempt.id,
        questionId: question.id,
        choiceId: TIMEOUT_CHOICE,
        correct: false,
      });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  if (done) {
    return (await completeAttempt(attempt.id, now)) ?? attempt;
  }
  const [updated] = await db
    .update(qcmAttempts)
    .set({
      currentIndex: nextIndex,
      lastAnsweredAt: now,
      questionStartedAt: now,
    })
    .where(and(eq(qcmAttempts.id, attempt.id), eq(qcmAttempts.status, "in_progress")))
    .returning();
  return updated ?? attempt;
}

export async function settleAttempt(exam: QcmExamRow, attempt: QcmAttemptRow) {
  if (attempt.status !== "in_progress") return attempt;
  let current = attempt;
  const now = new Date();
  for (let step = 0; step < exam.questionCount + 2; step += 1) {
    if (current.status !== "in_progress") return current;
    const examEnd = examDeadline(exam, current);
    if (examEnd && now.getTime() >= examEnd.getTime() + TIMER_GRACE_MS) {
      current = await timeoutCurrentQuestion(exam, current, now, true);
      if (current.status === "completed") publishQcm("complete");
      return current;
    }
    const questionEnd = questionDeadline(exam, current);
    if (questionEnd && now.getTime() >= questionEnd.getTime() + TIMER_GRACE_MS) {
      const before = current.currentIndex;
      current = await timeoutCurrentQuestion(exam, current, now, false);
      publishQcm(current.status === "completed" ? "complete" : "answer");
      if (current.currentIndex === before && current.status === "in_progress") return current;
      continue;
    }
    return current;
  }
  return current;
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
    .where(and(eq(qcmAttempts.examId, examId), eq(qcmAttempts.status, "in_progress"), isNull(qcmAttempts.archivedAt)));
  const now = new Date();
  for (const row of live) {
    await completeAttempt(row.id, now);
  }
}

export async function saveInductionExam(input: {
  titleFr: string;
  titleEn: string;
  passScore: number;
  examDurationSeconds: number | null;
  questionDurationSeconds: number | null;
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
    .where(and(eq(qcmAttempts.examId, exam.id), eq(qcmAttempts.status, "in_progress"), isNull(qcmAttempts.archivedAt)))
    .limit(1);
  if (live) return { error: "qcm_locked" as const };

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(qcmExams)
      .set({
        titleFr: input.titleFr,
        titleEn: input.titleEn,
        passScore: input.passScore,
        examDurationSeconds: input.examDurationSeconds,
        questionDurationSeconds: input.questionDurationSeconds,
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

export async function updateExamEnglish(
  examId: string,
  titleEn: string,
  questions: Array<{ id: string; promptEn: string; choices: QcmChoice[] }>,
) {
  await db.update(qcmExams).set({ titleEn, updatedAt: new Date() }).where(eq(qcmExams.id, examId));
  for (const question of questions) {
    await db
      .update(qcmQuestions)
      .set({
        promptEn: question.promptEn,
        choices: JSON.stringify(question.choices),
      })
      .where(and(eq(qcmQuestions.id, question.id), eq(qcmQuestions.examId, examId)));
  }
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

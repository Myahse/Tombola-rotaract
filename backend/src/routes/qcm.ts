import { and, count, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { qcmAnswers, qcmAttempts } from "../db/schema.js";
import { requireMember, type MemberRequest } from "../lib/auth.js";
import {
  getExamBySlug,
  getInductionExam,
  memberAttempt,
  parseChoices,
  publicAttempt,
  publicExam,
  publicQuestion,
  publishQcm,
  questionAt,
  settleAttempt,
} from "../lib/qcm.js";
import { markInviteCompleted, markInviteStarted, resolveInvite } from "../lib/qcmInvites.js";
import { clientKey, enforceRateLimit } from "../lib/rateLimit.js";
import type { QcmExamRow } from "../db/schema.js";

export const qcmRouter = Router();

const answerSchema = z.object({
  choiceId: z.string().trim().min(1).max(8).optional(),
  timedOut: z.boolean().optional(),
});

const startSchema = z.object({
  invite: z.string().trim().min(8).max(80).optional(),
});

function queryInvite(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function paramSlug(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

function inviteFromReq(req: { query?: unknown; body?: unknown }) {
  const parsed = startSchema.safeParse(req.body ?? {});
  const fromBody = parsed.success ? parsed.data.invite?.trim() : "";
  if (fromBody) return fromBody;
  return queryInvite((req.query as { invite?: unknown } | undefined)?.invite) || undefined;
}

async function examPayload(memberId: string, exam: QcmExamRow | null, token?: string) {
  if (!exam) return { exam: null, attempt: null, question: null, inviteError: null as string | null };
  let attempt = await memberAttempt(exam.id, memberId);
  if (attempt) attempt = await settleAttempt(exam, attempt);
  if (!attempt) {
    const resolved = await resolveInvite(exam.id, memberId, token);
    if ("error" in resolved) {
      return {
        exam: publicExam(exam),
        attempt: null,
        question: null,
        inviteError: resolved.error,
      };
    }
  }
  const question =
    attempt && attempt.status === "in_progress"
      ? await questionAt(exam.id, attempt.currentIndex + 1)
      : null;
  return {
    exam: publicExam(exam),
    attempt: attempt ? publicAttempt(attempt, exam.questionCount, exam, { hideScore: true }) : null,
    question: question && attempt ? publicQuestion(question, attempt.id) : null,
    inviteError: null as string | null,
  };
}

function attemptBody(
  exam: QcmExamRow,
  attempt: NonNullable<Awaited<ReturnType<typeof memberAttempt>>>,
  question: Awaited<ReturnType<typeof questionAt>> | null,
) {
  return {
    exam: publicExam(exam),
    attempt: publicAttempt(attempt, exam.questionCount, exam, { hideScore: true }),
    question: question ? publicQuestion(question, attempt.id) : null,
    inviteError: null as string | null,
  };
}

async function startExam(memberId: string, exam: QcmExamRow | null, token?: string) {
  if (!exam || exam.status !== "open") {
    return { status: 409 as const, error: "qcm_closed" };
  }
  if (exam.questionCount < 1) {
    return { status: 409 as const, error: "qcm_closed" };
  }

  const existing = await memberAttempt(exam.id, memberId);
  if (existing) {
    const settled = await settleAttempt(exam, existing);
    const question =
      settled.status === "in_progress" ? await questionAt(exam.id, settled.currentIndex + 1) : null;
    return {
      status: 200 as const,
      body: attemptBody(exam, settled, question),
    };
  }

  const resolved = await resolveInvite(exam.id, memberId, token);
  if ("error" in resolved) {
    return { status: 403 as const, error: resolved.error };
  }

  const now = new Date();
  const [created] = await db
    .insert(qcmAttempts)
    .values({ examId: exam.id, memberId, questionStartedAt: now, inviteId: resolved.invite.id })
    .returning();
  if (!created) {
    return { status: 500 as const, error: "request_failed" };
  }
  await markInviteStarted(resolved.invite, memberId);
  const question = await questionAt(exam.id, 1);
  publishQcm("start");
  return {
    status: 200 as const,
    body: attemptBody(exam, created, question),
  };
}

async function answerExam(memberId: string, exam: QcmExamRow | null, choiceId: string | undefined, timedOut: boolean) {
  if (!exam || exam.status !== "open") {
    return { status: 409 as const, error: "qcm_closed" };
  }
  const live = await memberAttempt(exam.id, memberId);
  if (!live || live.status !== "in_progress") {
    return { status: 409 as const, error: "qcm_not_started" };
  }

  const beforeIndex = live.currentIndex;
  const attempt = await settleAttempt(exam, live);
  if (timedOut || attempt.status !== "in_progress" || attempt.currentIndex !== beforeIndex) {
    const question =
      attempt.status === "in_progress" ? await questionAt(exam.id, attempt.currentIndex + 1) : null;
    return { status: 200 as const, body: attemptBody(exam, attempt, question) };
  }

  if (!choiceId) {
    return { status: 400 as const, error: "invalid_form" };
  }

  const question = await questionAt(exam.id, attempt.currentIndex + 1);
  if (!question) {
    return { status: 409 as const, error: "qcm_complete" };
  }
  if (!parseChoices(question.choices).some((choice) => choice.id === choiceId)) {
    return { status: 400 as const, error: "invalid_form" };
  }

  const correct = question.correctChoiceId === choiceId;
  const now = new Date();
  const nextIndex = attempt.currentIndex + 1;
  const done = nextIndex >= exam.questionCount;

  const result = await db.transaction(async (tx) => {
    await tx.insert(qcmAnswers).values({
      attemptId: attempt.id,
      questionId: question.id,
      choiceId,
      correct,
    });

    let score = attempt.score;
    if (done) {
      const [totals] = await tx
        .select({ value: count() })
        .from(qcmAnswers)
        .where(and(eq(qcmAnswers.attemptId, attempt.id), eq(qcmAnswers.correct, true)));
      score = Number(totals?.value ?? 0);
    }

    const [updated] = await tx
      .update(qcmAttempts)
      .set({
        currentIndex: nextIndex,
        lastAnsweredAt: now,
        questionStartedAt: done ? attempt.questionStartedAt : now,
        ...(done ? { status: "completed", completedAt: now, score } : {}),
      })
      .where(and(eq(qcmAttempts.id, attempt.id), eq(qcmAttempts.status, "in_progress")))
      .returning();
    return updated;
  });

  if (!result) {
    return { status: 409 as const, error: "qcm_not_started" };
  }

  publishQcm(result.status === "completed" ? "complete" : "answer");
  if (result.status === "completed") await markInviteCompleted(result.inviteId);
  const nextQuestion =
    result.status === "in_progress" ? await questionAt(exam.id, result.currentIndex + 1) : null;
  return {
    status: 200 as const,
    body: attemptBody(exam, result, nextQuestion),
  };
}

qcmRouter.get("/qcm", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    res.json(await examPayload(memberId, await getInductionExam(), queryInvite(req.query.invite)));
  } catch (error) {
    next(error);
  }
});

qcmRouter.get("/qcm/:slug", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    res.json(
      await examPayload(memberId, await getExamBySlug(paramSlug(req.params.slug)), queryInvite(req.query.invite)),
    );
  } catch (error) {
    next(error);
  }
});

qcmRouter.post("/qcm/start", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    if (!(await enforceRateLimit(res, `qcm-start:${memberId}:${clientKey(req)}`, 8, 15 * 60 * 1000))) {
      return;
    }
    const exam = await getInductionExam();
    try {
      const result = await startExam(memberId, exam, inviteFromReq(req));
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.json(await examPayload(memberId, exam, inviteFromReq(req)));
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

qcmRouter.post("/qcm/:slug/start", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    if (!(await enforceRateLimit(res, `qcm-start:${memberId}:${clientKey(req)}`, 8, 15 * 60 * 1000))) {
      return;
    }
    const exam = await getExamBySlug(paramSlug(req.params.slug));
    if (!exam) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      const result = await startExam(memberId, exam, inviteFromReq(req));
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.json(await examPayload(memberId, exam, inviteFromReq(req)));
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

qcmRouter.post("/qcm/answer", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    if (!(await enforceRateLimit(res, `qcm-answer:${memberId}`, 40, 15 * 60 * 1000))) {
      return;
    }
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.timedOut && !parsed.data.choiceId)) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const exam = await getInductionExam();
    try {
      const result = await answerExam(memberId, exam, parsed.data.choiceId, Boolean(parsed.data.timedOut));
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.json(await examPayload(memberId, exam));
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

qcmRouter.post("/qcm/:slug/answer", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    if (!(await enforceRateLimit(res, `qcm-answer:${memberId}`, 40, 15 * 60 * 1000))) {
      return;
    }
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.timedOut && !parsed.data.choiceId)) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const exam = await getExamBySlug(paramSlug(req.params.slug));
    if (!exam) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      const result = await answerExam(memberId, exam, parsed.data.choiceId, Boolean(parsed.data.timedOut));
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.json(await examPayload(memberId, exam));
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

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
} from "../lib/qcm.js";
import { clientKey, enforceRateLimit } from "../lib/rateLimit.js";
import type { QcmExamRow } from "../db/schema.js";

export const qcmRouter = Router();

const answerSchema = z.object({
  choiceId: z.string().trim().min(1).max(8),
});

function paramSlug(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

async function examPayload(memberId: string, exam: QcmExamRow | null) {
  if (!exam) return { exam: null, attempt: null, question: null };
  const attempt = await memberAttempt(exam.id, memberId);
  const question =
    attempt && attempt.status === "in_progress"
      ? await questionAt(exam.id, attempt.currentIndex + 1)
      : null;
  return {
    exam: publicExam(exam),
    attempt: attempt ? publicAttempt(attempt, exam.questionCount) : null,
    question: question && attempt ? publicQuestion(question, attempt.id) : null,
  };
}

async function startExam(memberId: string, exam: QcmExamRow | null) {
  if (!exam || exam.status !== "open") {
    return { status: 409 as const, error: "qcm_closed" };
  }
  if (exam.questionCount < 1) {
    return { status: 409 as const, error: "qcm_closed" };
  }

  const existing = await memberAttempt(exam.id, memberId);
  if (existing) {
    const question =
      existing.status === "in_progress" ? await questionAt(exam.id, existing.currentIndex + 1) : null;
    return {
      status: 200 as const,
      body: {
        exam: publicExam(exam),
        attempt: publicAttempt(existing, exam.questionCount),
        question: question ? publicQuestion(question, existing.id) : null,
      },
    };
  }

  const [created] = await db
    .insert(qcmAttempts)
    .values({ examId: exam.id, memberId })
    .returning();
  if (!created) {
    return { status: 500 as const, error: "request_failed" };
  }
  const question = await questionAt(exam.id, 1);
  publishQcm("start");
  return {
    status: 200 as const,
    body: {
      exam: publicExam(exam),
      attempt: publicAttempt(created, exam.questionCount),
      question: question ? publicQuestion(question, created.id) : null,
    },
  };
}

async function answerExam(memberId: string, exam: QcmExamRow | null, choiceId: string) {
  if (!exam || exam.status !== "open") {
    return { status: 409 as const, error: "qcm_closed" };
  }
  const attempt = await memberAttempt(exam.id, memberId);
  if (!attempt || attempt.status !== "in_progress") {
    return { status: 409 as const, error: "qcm_not_started" };
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
  const nextQuestion =
    result.status === "in_progress" ? await questionAt(exam.id, result.currentIndex + 1) : null;
  return {
    status: 200 as const,
    body: {
      exam: publicExam(exam),
      attempt: publicAttempt(result, exam.questionCount),
      question: nextQuestion ? publicQuestion(nextQuestion, result.id) : null,
    },
  };
}

qcmRouter.get("/qcm", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    res.json(await examPayload(memberId, await getInductionExam()));
  } catch (error) {
    next(error);
  }
});

qcmRouter.get("/qcm/:slug", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    res.json(await examPayload(memberId, await getExamBySlug(paramSlug(req.params.slug))));
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
      const result = await startExam(memberId, exam);
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
      const result = await startExam(memberId, exam);
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

qcmRouter.post("/qcm/answer", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    if (!(await enforceRateLimit(res, `qcm-answer:${memberId}`, 40, 15 * 60 * 1000))) {
      return;
    }
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const exam = await getInductionExam();
    try {
      const result = await answerExam(memberId, exam, parsed.data.choiceId);
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
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }
    const exam = await getExamBySlug(paramSlug(req.params.slug));
    if (!exam) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      const result = await answerExam(memberId, exam, parsed.data.choiceId);
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

import { and, count, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/index.js";
import { qcmAnswers, qcmAttempts } from "../db/schema.js";
import { requireMember, type MemberRequest } from "../lib/auth.js";
import {
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

export const qcmRouter = Router();

const answerSchema = z.object({
  choiceId: z.string().trim().min(1).max(8),
});

async function examPayload(memberId: string) {
  const exam = await getInductionExam();
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

qcmRouter.get("/qcm", requireMember, async (req, res, next) => {
  try {
    const memberId = (req as MemberRequest).memberId;
    res.json(await examPayload(memberId));
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
    if (!exam || exam.status !== "open") {
      res.status(409).json({ error: "qcm_closed" });
      return;
    }
    if (exam.questionCount < 1) {
      res.status(409).json({ error: "qcm_closed" });
      return;
    }

    const existing = await memberAttempt(exam.id, memberId);
    if (existing) {
      const question =
        existing.status === "in_progress" ? await questionAt(exam.id, existing.currentIndex + 1) : null;
      res.json({
        exam: publicExam(exam),
        attempt: publicAttempt(existing, exam.questionCount),
        question: question ? publicQuestion(question, existing.id) : null,
      });
      return;
    }

    const [created] = await db
      .insert(qcmAttempts)
      .values({ examId: exam.id, memberId })
      .returning();
    if (!created) {
      res.status(500).json({ error: "request_failed" });
      return;
    }
    const question = await questionAt(exam.id, 1);
    publishQcm("start");
    res.json({
      exam: publicExam(exam),
      attempt: publicAttempt(created, exam.questionCount),
      question: question ? publicQuestion(question, created.id) : null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const memberId = (req as MemberRequest).memberId;
      res.json(await examPayload(memberId));
      return;
    }
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
    if (!exam || exam.status !== "open") {
      res.status(409).json({ error: "qcm_closed" });
      return;
    }
    const attempt = await memberAttempt(exam.id, memberId);
    if (!attempt || attempt.status !== "in_progress") {
      res.status(409).json({ error: "qcm_not_started" });
      return;
    }

    const question = await questionAt(exam.id, attempt.currentIndex + 1);
    if (!question) {
      res.status(409).json({ error: "qcm_complete" });
      return;
    }
    if (!parseChoices(question.choices).some((choice) => choice.id === parsed.data.choiceId)) {
      res.status(400).json({ error: "invalid_form" });
      return;
    }

    const correct = question.correctChoiceId === parsed.data.choiceId;
    const now = new Date();
    const nextIndex = attempt.currentIndex + 1;
    const done = nextIndex >= exam.questionCount;

    const result = await db.transaction(async (tx) => {
      await tx.insert(qcmAnswers).values({
        attemptId: attempt.id,
        questionId: question.id,
        choiceId: parsed.data.choiceId,
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
          ...(done
            ? { status: "completed", completedAt: now, score }
            : {}),
        })
        .where(and(eq(qcmAttempts.id, attempt.id), eq(qcmAttempts.status, "in_progress")))
        .returning();
      return updated;
    });

    if (!result) {
      res.status(409).json({ error: "qcm_not_started" });
      return;
    }

    publishQcm(result.status === "completed" ? "complete" : "answer");
    const nextQuestion =
      result.status === "in_progress" ? await questionAt(exam.id, result.currentIndex + 1) : null;
    res.json({
      exam: publicExam(exam),
      attempt: publicAttempt(result, exam.questionCount),
      question: nextQuestion ? publicQuestion(nextQuestion, result.id) : null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const memberId = (req as MemberRequest).memberId;
      res.json(await examPayload(memberId));
      return;
    }
    next(error);
  }
});

import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { qcmExams } from "../db/schema.js";
import { requireAdmin } from "../lib/auth.js";
import {
  adminQuestions,
  getInductionExam,
  monitorAttempts,
  publishQcm,
  saveInductionExam,
  stopLiveAttempts,
} from "../lib/qcm.js";
import { archiveLiveSession, deleteArchive, parseInviteEmails, payloadForExam, upsertInvites } from "../lib/qcmInvites.js";
import { clientKey, enforceRateLimit } from "../lib/rateLimit.js";
import { translateFrToEnMany } from "../lib/translate.js";

const choiceSchema = z.object({
  textFr: z.string().trim().min(1).max(240),
  textEn: z.string().trim().max(240).optional().or(z.literal("")),
});

const questionSchema = z.object({
  promptFr: z.string().trim().min(2).max(800),
  promptEn: z.string().trim().max(800).optional().or(z.literal("")),
  choices: z.array(choiceSchema).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
});

const examSchema = z.object({
  titleFr: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().max(120).optional().or(z.literal("")),
  passScore: z.number().int().min(1).max(50),
  examDurationMinutes: z.number().int().min(0).max(240).optional().nullable(),
  questionDurationSeconds: z.number().int().min(0).max(900).optional().nullable(),
  questions: z.array(questionSchema).min(1).max(50),
});

const statusSchema = z.object({
  status: z.enum(["open", "closed"]),
});

const inviteSchema = z.object({
  emails: z.array(z.string().trim().min(3).max(120)).min(1).max(80),
  lang: z.enum(["fr", "en"]).optional(),
});

const archiveDeleteSchema = z.object({
  archivedAt: z.string().trim().min(8).max(40),
});

const ids = ["a", "b", "c", "d", "e", "f"];

function normalizeExam(data: z.infer<typeof examSchema>) {
  const questions = data.questions.map((question) => {
    const choices = question.choices.map((choice, index) => ({
      id: ids[index] ?? String(index),
      textFr: choice.textFr,
      textEn: choice.textEn?.trim() || choice.textFr,
    }));
    const correct = choices[question.correctIndex];
    if (!correct) {
      throw new Error("invalid_form");
    }
    return {
      promptFr: question.promptFr,
      promptEn: question.promptEn?.trim() || question.promptFr,
      choices,
      correctChoiceId: correct.id,
    };
  });
  if (data.passScore > questions.length) {
    throw new Error("pass_too_high");
  }
  return {
    titleFr: data.titleFr,
    titleEn: data.titleEn?.trim() || data.titleFr,
    passScore: data.passScore,
    examDurationSeconds: data.examDurationMinutes && data.examDurationMinutes > 0 ? data.examDurationMinutes * 60 : null,
    questionDurationSeconds:
      data.questionDurationSeconds && data.questionDurationSeconds > 0 ? data.questionDurationSeconds : null,
    questions,
  };
}

async function withEnglish(data: ReturnType<typeof normalizeExam>) {
  const source = [
    data.titleFr,
    ...data.questions.flatMap((question) => [question.promptFr, ...question.choices.map((choice) => choice.textFr)]),
  ];
  const translated = await translateFrToEnMany(source);
  const en = (value: string) => translated.get(value.trim()) || value;
  return {
    ...data,
    titleEn: en(data.titleFr),
    questions: data.questions.map((question) => ({
      ...question,
      promptEn: en(question.promptFr),
      choices: question.choices.map((choice) => ({ ...choice, textEn: en(choice.textFr) })),
    })),
  };
}

async function payload(lang: "fr" | "en" = "fr") {
  const exam = await getInductionExam();
  if (!exam) return { exam: null, questions: [], attempts: [], invites: [], archives: [] };
  return payloadForExam(exam.id, lang);
}

export function registerAdminQcmRoutes(router: Router) {
  router.get("/qcm", requireAdmin, async (req, res, next) => {
    try {
      const lang = req.query.lang === "en" ? "en" : "fr";
      res.json(await payload(lang));
    } catch (error) {
      next(error);
    }
  });

  router.put("/qcm", requireAdmin, async (req, res, next) => {
    try {
      const parsed = examSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_form" });
        return;
      }
      let normalized;
      try {
        normalized = await withEnglish(normalizeExam(parsed.data));
      } catch (error) {
        const code = error instanceof Error ? error.message : "invalid_form";
        res.status(400).json({ error: code });
        return;
      }
      const saved = await saveInductionExam(normalized);
      if ("error" in saved) {
        res.status(saved.error === "not_found" ? 404 : 409).json({ error: saved.error });
        return;
      }
      res.json(await payload());
    } catch (error) {
      next(error);
    }
  });

  router.post("/qcm/status", requireAdmin, async (req, res, next) => {
    try {
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_form" });
        return;
      }
      const exam = await getInductionExam();
      if (!exam) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (parsed.data.status === "open") {
        const questions = await adminQuestions(exam.id);
        if (!questions.length) {
          res.status(409).json({ error: "need_questions" });
          return;
        }
      }
      if (parsed.data.status === "closed") {
        await stopLiveAttempts(exam.id);
      }
      await db
        .update(qcmExams)
        .set({
          status: parsed.data.status,
          updatedAt: new Date(),
          ...(parsed.data.status === "open" ? { scoresSentAt: null } : {}),
        })
        .where(eq(qcmExams.id, exam.id));
      publishQcm("exam");
      res.json(await payload());
    } catch (error) {
      next(error);
    }
  });

  router.post("/qcm/invite", requireAdmin, async (req, res, next) => {
    try {
      if (!(await enforceRateLimit(res, `qcm-invite:${clientKey(req)}`, 8, 15 * 60 * 1000))) {
        return;
      }
      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_form" });
        return;
      }
      const emails = parseInviteEmails(parsed.data.emails);
      if (!emails.length) {
        res.status(400).json({ error: "no_emails" });
        return;
      }
      const exam = await getInductionExam();
      if (!exam) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const lang = parsed.data.lang === "en" ? "en" : "fr";
      const recipients = await upsertInvites(exam, emails, lang);
      const { notifyQcmInvite } = await import("../lib/mail.js");
      await notifyQcmInvite(recipients);
      const next = await payload(lang);
      res.json({ ...next, sent: recipients.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/qcm/send-scores", requireAdmin, async (_req, res, next) => {
    try {
      const exam = await getInductionExam();
      if (!exam) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (exam.status !== "closed") {
        res.status(409).json({ error: "qcm_open" });
        return;
      }
      if (exam.scoresSentAt) {
        res.status(409).json({ error: "scores_already_sent" });
        return;
      }
      await stopLiveAttempts(exam.id);
      const attempts = await monitorAttempts(exam.id);
      const recipients = attempts.filter((item) => item.status === "completed" && item.memberEmail);
      if (!recipients.length) {
        res.status(409).json({ error: "no_scores" });
        return;
      }
      const { notifyQcmScore } = await import("../lib/mail.js");
      await notifyQcmScore(
        recipients.map((item) => ({
          name: item.memberName,
          email: item.memberEmail,
          memberId: item.memberId,
          titleFr: exam.titleFr,
          titleEn: exam.titleEn,
          score: item.score ?? 0,
          total: item.questionCount,
          passScore: exam.passScore,
          passed: (item.score ?? 0) >= exam.passScore,
        })),
      );
      await db
        .update(qcmExams)
        .set({ scoresSentAt: new Date(), updatedAt: new Date() })
        .where(eq(qcmExams.id, exam.id));
      publishQcm("exam");
      res.json(await payload());
    } catch (error) {
      next(error);
    }
  });

  router.post("/qcm/archive", requireAdmin, async (_req, res, next) => {
    try {
      const exam = await getInductionExam();
      if (!exam) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const result = await archiveLiveSession(exam.id);
      if ("error" in result) {
        res.status(result.error === "no_session" ? 409 : 404).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/qcm/archives/delete", requireAdmin, async (req, res, next) => {
    try {
      const parsed = archiveDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_form" });
        return;
      }
      const exam = await getInductionExam();
      if (!exam) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const result = await deleteArchive(exam.id, parsed.data.archivedAt);
      if (result && "error" in result) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}

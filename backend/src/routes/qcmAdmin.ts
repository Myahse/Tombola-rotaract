import { eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { members, qcmExams } from "../db/schema.js";
import { examSiteUrl } from "../emails/layout.js";
import { requireAdmin } from "../lib/auth.js";
import {
  adminQuestions,
  getInductionExam,
  monitorAttempts,
  publicExam,
  publishQcm,
  saveInductionExam,
  stopLiveAttempts,
} from "../lib/qcm.js";
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
  questions: z.array(questionSchema).min(1).max(50),
});

const statusSchema = z.object({
  status: z.enum(["open", "closed"]),
});

const inviteSchema = z.object({
  emails: z.string().trim().min(1).max(20000),
  lang: z.enum(["fr", "en"]).optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITE_EMAILS = 80;

function parseInviteEmails(raw: string) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,;\n\r\t ]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    if (emails.length >= MAX_INVITE_EMAILS) break;
  }
  return emails;
}

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

async function payload() {
  const exam = await getInductionExam();
  if (!exam) return { exam: null, questions: [], attempts: [] };
  const [questions, attempts] = await Promise.all([adminQuestions(exam.id), monitorAttempts(exam.id)]);
  return { exam: publicExam(exam), questions, attempts };
}

export function registerAdminQcmRoutes(router: Router) {
  router.get("/qcm", requireAdmin, async (_req, res, next) => {
    try {
      res.json(await payload());
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
      res.json(saved);
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
      const [updated] = await db
        .update(qcmExams)
        .set({
          status: parsed.data.status,
          updatedAt: new Date(),
          ...(parsed.data.status === "open" ? { scoresSentAt: null } : {}),
        })
        .where(eq(qcmExams.id, exam.id))
        .returning();
      publishQcm("exam");
      res.json({
        exam: updated ? publicExam(updated) : publicExam(exam),
        questions: await adminQuestions(exam.id),
        attempts: await monitorAttempts(exam.id),
      });
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
      const examUrl = examSiteUrl(`/${lang}/${exam.slug}`);
      const found = await db
        .select({ id: members.id, name: members.name, email: members.email })
        .from(members)
        .where(inArray(members.email, emails));
      const byEmail = new Map(found.map((row) => [row.email.trim().toLowerCase(), row]));
      const { notifyQcmInvite } = await import("../lib/mail.js");
      await notifyQcmInvite(
        emails.map((email) => {
          const member = byEmail.get(email);
          return {
            name: member?.name || email.split("@")[0] || email,
            email,
            memberId: member?.id,
            titleFr: exam.titleFr,
            titleEn: exam.titleEn,
            examUrl,
            lang,
          };
        }),
      );
      res.json({ sent: emails.length, url: examUrl });
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
      const [updated] = await db
        .update(qcmExams)
        .set({ scoresSentAt: new Date(), updatedAt: new Date() })
        .where(eq(qcmExams.id, exam.id))
        .returning();
      publishQcm("exam");
      res.json({
        exam: updated ? publicExam(updated) : publicExam({ ...exam, scoresSentAt: new Date() }),
        questions: await adminQuestions(exam.id),
        attempts,
      });
    } catch (error) {
      next(error);
    }
  });
}

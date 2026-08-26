import { useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useAuth } from "../auth";
import { ExamCall, type CallStatus } from "../ExamCall";
import { useStay, enterExamFullscreen } from "../stay";
import type { QcmState } from "../types";

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

function remainingMs(deadline: string | null | undefined, now: number) {
  if (!deadline) return null;
  return new Date(deadline).getTime() - now;
}

function formatRemain(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ExamClocks({
  examEndsAt,
  questionEndsAt,
  onExpire,
}: {
  examEndsAt: string | null;
  questionEndsAt: string | null;
  onExpire: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
  }, [examEndsAt, questionEndsAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const examLeft = remainingMs(examEndsAt, now);
  const questionLeft = remainingMs(questionEndsAt, now);
  const expired =
    (examLeft !== null && examLeft <= 0) || (questionLeft !== null && questionLeft <= 0);

  useEffect(() => {
    if (!expired || fired.current) return;
    fired.current = true;
    onExpire();
  }, [expired, onExpire]);

  if (examLeft === null && questionLeft === null) return null;

  return (
    <div className="qcm-clocks">
      {examLeft !== null ? (
        <p className={examLeft <= 30_000 ? "is-urgent" : undefined}>
          {t("qcm.examClock", { time: formatRemain(examLeft) })}
        </p>
      ) : null}
      {questionLeft !== null ? (
        <p className={questionLeft <= 10_000 ? "is-urgent" : undefined}>
          {t("qcm.questionClock", { time: formatRemain(questionLeft) })}
        </p>
      ) : null}
    </div>
  );
}

export function ExamPage() {
  const { t, i18n } = useTranslation();
  const { lang, slug: rawSlug } = useParams();
  const [params] = useSearchParams();
  const slug = (rawSlug ?? "").toLowerCase();
  const invite = params.get("invite")?.trim() || "";
  const validSlug = SLUG_RE.test(slug);
  const { member, loading } = useAuth();
  const [state, setState] = useState<QcmState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState<CallStatus>("off");
  const [shareTick, setShareTick] = useState(0);
  const { setLocked } = useStay();
  const exam = state?.exam ?? null;
  const attempt = state?.attempt ?? null;
  const inviteError = state?.inviteError ?? null;
  const open = exam?.status === "open";
  const inProgress = open && attempt?.status === "in_progress";
  const waitingScores = Boolean(attempt?.status === "completed" && exam && !exam.scoresSent);
  const screenOff = Boolean(exam?.scoresSent);
  const examPath = `/${lang}/${slug}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
  const loginPath = `/${lang}/login?next=${encodeURIComponent(examPath)}`;

  async function load() {
    const data = await api.qcm(slug, invite || undefined);
    setState(data);
    setReady(true);
  }

  useEffect(() => {
    if (!member || !validSlug) return;
    load().catch(() => {
      setReady(true);
      setError(t("errors.generic"));
    });
  }, [member, slug, invite, validSlug, t]);

  useEffect(() => {
    if (!member || !validSlug || !(open || waitingScores)) return;
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [member, open, waitingScores, slug, invite, validSlug]);

  const sessionLock = Boolean(inProgress || waitingScores);

  useEffect(() => {
    setLocked(sessionLock);
    return () => setLocked(false);
  }, [sessionLock, setLocked]);

  if (loading) return <p className="lede">…</p>;
  if (!validSlug) return <p className="lede">{t("qcm.unknown")}</p>;
  if (!member) return <Navigate to={loginPath} replace />;
  if (!ready) return <p className="lede">…</p>;

  const question = state?.question ?? null;
  const invited = !inviteError;
  const calling = Boolean(open && (inProgress || (!attempt && invited)));
  const canStart = camera === "ready";

  async function start() {
    if (!canStart) return;
    setBusy(true);
    setError("");
    try {
      enterExamFullscreen();
      setState(await api.startQcm(slug, invite || undefined));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "qcm_closed"
          ? t("qcm.closed")
          : code === "not_invited"
            ? t("qcm.notInvited")
            : code === "invite_mismatch"
              ? t("qcm.inviteMismatch")
              : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function answer(choiceId: string) {
    setBusy(true);
    setError("");
    try {
      setState(await api.answerQcm(slug, { choiceId }));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "qcm_closed") {
        await load();
        return;
      }
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function expire() {
    if (busy) return;
    setBusy(true);
    try {
      setState(await api.answerQcm(slug, { timedOut: true }));
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (screenOff) {
    return (
      <div className="exam-blackout" role="status">
        <p>{t("qcm.stopped")}</p>
      </div>
    );
  }

  return (
    <section className={`section${calling ? " has-call" : ""}`} style={{ borderBottom: 0 }}>
      {calling ? (
        <ExamCall active recapture={shareTick} onStatus={setCamera} onSession={() => void load()} />
      ) : null}
      <p className="eyebrow">{t("qcm.kicker")}</p>
      <h1>{exam ? localized(exam, i18n.language, "title") : t("qcm.title")}</h1>

      {!exam ? <p className="lede mt-3">{t("qcm.unknown")}</p> : null}
      {inviteError === "not_invited" ? <p className="lede mt-3">{t("qcm.notInvited")}</p> : null}
      {inviteError === "invite_mismatch" ? <p className="lede mt-3">{t("qcm.inviteMismatch")}</p> : null}
      {exam && !open && !attempt && !inviteError ? <p className="lede mt-3">{t("qcm.closed")}</p> : null}

      {exam && !attempt && open && invited ? (
        <>
          <p className="lede mt-3">{t("qcm.intro", { count: exam.questionCount, pass: exam.passScore })}</p>
          {exam.examDurationSeconds ? (
            <p className="field-hint">{t("qcm.examTimerRule", { minutes: Math.round(exam.examDurationSeconds / 60) })}</p>
          ) : null}
          {exam.questionDurationSeconds ? (
            <p className="field-hint">{t("qcm.questionTimerRule", { seconds: exam.questionDurationSeconds })}</p>
          ) : null}
          <ul className="qcm-rules">
            <li>{t("qcm.ruleStep")}</li>
            <li>{t("qcm.ruleBack")}</li>
            <li>{t("qcm.ruleLive")}</li>
            <li>{t("qcm.ruleCamera")}</li>
            <li>{t("qcm.ruleScreen")}</li>
            <li>{t("qcm.ruleStay")}</li>
            <li>{t("qcm.ruleScore")}</li>
          </ul>
          {camera === "need" ? <p className="field-hint mt-3">{t("qcm.cameraWait")}</p> : null}
          {camera === "screen" ? (
            <>
              <p className="field-hint mt-3">{t("qcm.screenWait")}</p>
              <button type="button" className="btn-outline mt-3" onClick={() => setShareTick((value) => value + 1)}>
                {t("qcm.shareScreen")}
              </button>
            </>
          ) : null}
          {camera === "denied" ? <p className="mt-3 text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={busy || !canStart}
            onClick={() => void start()}
          >
            {busy ? t("qcm.starting") : t("qcm.start")}
          </button>
        </>
      ) : null}

      {inProgress && question && attempt ? (
        <>
          {camera === "denied" ? <p className="mt-3 text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
          {camera === "screen" ? (
            <>
              <p className="mt-3 text-sm text-ticket">{t("qcm.screenLost")}</p>
              <button type="button" className="btn-outline mt-3" onClick={() => setShareTick((value) => value + 1)}>
                {t("qcm.shareScreen")}
              </button>
            </>
          ) : null}
          <p className="field-hint mt-3">{t("qcm.stayHint")}</p>
          <ExamClocks examEndsAt={attempt.examEndsAt} questionEndsAt={attempt.questionEndsAt} onExpire={() => void expire()} />
          <p className="qcm-progress mt-4">
            {t("qcm.progress", { current: attempt.currentIndex + 1, total: attempt.questionCount })}
          </p>
          <div className="qcm-bar" aria-hidden="true">
            <span style={{ width: `${(attempt.currentIndex / attempt.questionCount) * 100}%` }} />
          </div>
          <h2 className="qcm-prompt">{localized(question, i18n.language, "prompt")}</h2>
          <div className="qcm-choices">
            {question.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="qcm-choice"
                disabled={busy || camera === "screen"}
                onClick={() => void answer(choice.id)}
              >
                {localized(choice, i18n.language, "text")}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {waitingScores ? (
        <article className="account-card mt-4">
          <h2>{t("qcm.doneTitle")}</h2>
          <p className="lede">{t("qcm.doneLead")}</p>
          <p className="field-hint">{t("qcm.waitingSend")}</p>
        </article>
      ) : null}

      {error ? <p className="mt-3 text-sm text-ticket">{error}</p> : null}
    </section>
  );
}

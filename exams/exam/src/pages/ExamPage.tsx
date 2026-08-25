import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useAuth } from "../auth";
import { ExamCall, type CallStatus } from "../ExamCall";
import { useStay } from "../stay";
import type { QcmState } from "../types";

export function ExamPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const { member, loading } = useAuth();
  const [state, setState] = useState<QcmState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState<CallStatus>("off");
  const { setLocked } = useStay();
  const exam = state?.exam ?? null;
  const attempt = state?.attempt ?? null;
  const open = exam?.status === "open";
  const inProgress = open && attempt?.status === "in_progress";
  const showScore = attempt?.status === "completed" && !exam?.scoresSent;
  const screenOff = Boolean(exam?.scoresSent);
  const waitingScores = exam?.status === "closed" && !exam.scoresSent;

  async function load() {
    const data = await api.qcm();
    setState(data);
    setReady(true);
  }

  useEffect(() => {
    if (!member) return;
    load().catch(() => {
      setReady(true);
      setError(t("errors.generic"));
    });
  }, [member, t]);

  useEffect(() => {
    if (!member || !(open || waitingScores)) return;
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [member, open, waitingScores]);

  useEffect(() => {
    setLocked(Boolean(inProgress));
    return () => setLocked(false);
  }, [inProgress, setLocked]);

  if (loading) return <p className="lede">…</p>;
  if (!member) return <Navigate to={`/${lang}/login`} replace />;
  if (!ready) return <p className="lede">…</p>;

  const question = state?.question ?? null;
  const passed = Boolean(showScore && exam && attempt.score !== null && attempt.score >= exam.passScore);
  const calling = Boolean(open && (inProgress || !attempt));

  async function start() {
    if (camera !== "ready") return;
    setBusy(true);
    setError("");
    try {
      setState(await api.startQcm());
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(code === "qcm_closed" ? t("qcm.closed") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function answer(choiceId: string) {
    setBusy(true);
    setError("");
    try {
      setState(await api.answerQcm(choiceId));
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

  if (screenOff) {
    return (
      <div className="exam-blackout" role="status">
        <p>{t("qcm.stopped")}</p>
      </div>
    );
  }

  return (
    <section className={`section${calling ? " has-call" : ""}`} style={{ borderBottom: 0 }}>
      {calling ? <ExamCall active onStatus={setCamera} onSession={() => void load()} /> : null}
      <p className="eyebrow">{t("qcm.kicker")}</p>
      <h1>{exam ? localized(exam, i18n.language, "title") : t("qcm.title")}</h1>

      {!exam || (!open && !attempt) ? <p className="lede mt-3">{t("qcm.closed")}</p> : null}

      {exam && !attempt && open ? (
        <>
          <p className="lede mt-3">{t("qcm.intro", { count: exam.questionCount, pass: exam.passScore })}</p>
          <ul className="qcm-rules">
            <li>{t("qcm.ruleStep")}</li>
            <li>{t("qcm.ruleBack")}</li>
            <li>{t("qcm.ruleLive")}</li>
            <li>{t("qcm.ruleCamera")}</li>
            <li>{t("qcm.ruleStay")}</li>
          </ul>
          {camera === "need" ? <p className="field-hint mt-3">{t("qcm.cameraWait")}</p> : null}
          {camera === "denied" ? <p className="mt-3 text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={busy || camera !== "ready"}
            onClick={() => void start()}
          >
            {busy ? t("qcm.starting") : t("qcm.start")}
          </button>
        </>
      ) : null}

      {inProgress && question && attempt ? (
        <>
          {camera === "denied" ? <p className="mt-3 text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
          <p className="field-hint mt-3">{t("qcm.stayHint")}</p>
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
                disabled={busy}
                onClick={() => void answer(choice.id)}
              >
                {localized(choice, i18n.language, "text")}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {showScore && attempt ? (
        <article className="account-card mt-4">
          <p className={`badge ${passed ? "ok" : "wait"}`}>{passed ? t("qcm.passed") : t("qcm.failed")}</p>
          <h2 className="mt-3">{t("qcm.doneTitle")}</h2>
          <p className="lede">{t("qcm.score", { score: attempt.score ?? 0, total: attempt.questionCount })}</p>
          <p className="field-hint">{t("qcm.callEnded")}</p>
          <p className="field-hint">{t("qcm.waitingSend")}</p>
        </article>
      ) : null}

      {error ? <p className="mt-3 text-sm text-ticket">{error}</p> : null}
    </section>
  );
}

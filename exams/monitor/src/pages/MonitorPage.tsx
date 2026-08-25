import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { examSiteUrl } from "../config";
import { useCallMedia } from "../call";
import { VideoTile } from "../components/VideoTile";
import { useLiveStatus, useLiveTick, useAwayIds } from "../live";
import type { QcmAdminState } from "../types";

function CandidateVideo({ stream, name }: { stream: MediaStream | null; name: string }) {
  const { t } = useTranslation();
  const [listen, setListen] = useState(false);
  return (
    <div className="call-card-video">
      <VideoTile stream={stream} muted={!listen} label={name} />
      <button type="button" className="call-listen" onClick={() => setListen((value) => !value)}>
        {listen ? t("qcm.mute") : t("qcm.listen")}
      </button>
    </div>
  );
}

export function MonitorPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<QcmAdminState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const tick = useLiveTick();
  const live = useLiveStatus();
  const awayIds = useAwayIds();
  const { local, remotes, camera, hangUp, startCall } = useCallMedia();

  async function load() {
    const next = await api.qcm();
    setData(next);
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => {
      setReady(true);
      setMessage(t("errors.generic"));
    });
  }, [t, tick]);

  if (!ready) return <p className="lede">…</p>;

  const exam = data?.exam ?? null;
  const attempts = data?.attempts ?? [];
  const liveCount = attempts.filter((item) => item.status === "in_progress").length;
  const doneCount = attempts.filter((item) => item.status === "completed").length;
  const passedCount = attempts.filter(
    (item) => item.status === "completed" && exam && item.score !== null && item.score >= exam.passScore,
  ).length;
  const open = exam?.status === "open";
  const lang = i18n.language === "en" ? "en" : "fr";
  const examLink = exam ? `${examSiteUrl()}/${lang}/${exam.slug}` : "";
  const attemptIds = new Set(attempts.map((item) => item.memberId));
  const waitingCameras = remotes.filter((peer) => !attemptIds.has(peer.memberId));

  async function sendScores() {
    setBusy(true);
    setMessage("");
    try {
      setData(await api.sendQcmScores());
      hangUp();
      setMessage(t("qcm.scoresSent"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage(
        code === "no_scores"
          ? t("qcm.noScores")
          : code === "qcm_open"
            ? t("qcm.closeFirst")
            : code === "scores_already_sent"
              ? t("qcm.scoresSent")
              : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    setInviting(true);
    setMessage("");
    try {
      await api.inviteQcm({ emails: inviteEmails, lang });
      setInviteEmails("");
      setMessage(t("qcm.inviteSent"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage(
        code === "no_emails"
          ? t("qcm.inviteNeedEmails")
          : code === "not_found"
            ? t("qcm.inviteNeedExam")
            : t("errors.generic"),
      );
    } finally {
      setInviting(false);
    }
  }

  async function setStatus(status: "open" | "closed") {
    setBusy(true);
    setMessage("");
    try {
      setData(await api.setQcmStatus(status));
      if (status === "closed") hangUp();
      if (status === "open" && camera === "off") void startCall();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage(code === "need_questions" ? t("qcm.needQuestions") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="qcm-monitor">
      <p className="eyebrow">
        {live ? t("qcm.liveOn") : t("qcm.liveOff")}
        {" · "}
        {open ? t("qcm.statusOpen") : t("qcm.statusClosed")}
      </p>
      <h1>{exam ? localized(exam, i18n.language, "title") : t("qcm.title")}</h1>
      <p className="lede mt-3">{t("qcm.lead")}</p>

      <div className="call-self mt-4">
        {local ? <VideoTile stream={local} muted mirror label={t("qcm.you")} /> : <VideoTile stream={null} label={t("qcm.you")} />}
        {camera === "need" ? <p className="field-hint">{t("qcm.cameraWait")}</p> : null}
        {camera === "denied" ? <p className="text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
        {camera === "off" ? <p className="field-hint">{t("qcm.callEnded")}</p> : null}
        {camera === "ready" ? (
          <button type="button" className="btn-hangup" onClick={hangUp}>
            {t("qcm.endCall")}
          </button>
        ) : null}
        {camera === "off" || camera === "denied" ? (
          <button type="button" className="btn-primary" onClick={() => void startCall()}>
            {t("qcm.startCall")}
          </button>
        ) : null}
      </div>
      {examLink ? (
        <p className="field-hint">
          {t("qcm.share")}{" "}
          <a href={examLink} target="_blank" rel="noreferrer">
            {examLink}
          </a>
        </p>
      ) : null}
      {exam ? (
        <div className="mt-4 grid gap-2">
          <label>
            {t("qcm.inviteEmails")}
            <textarea
              rows={4}
              value={inviteEmails}
              onChange={(event) => setInviteEmails(event.target.value)}
              placeholder={t("qcm.invitePlaceholder")}
            />
          </label>
          <p className="field-hint">{t("qcm.inviteHint")}</p>
          <button
            type="button"
            className="btn-primary"
            disabled={inviting || !inviteEmails.trim()}
            onClick={() => void sendInvite()}
          >
            {inviting ? t("qcm.inviteSending") : t("qcm.inviteSend")}
          </button>
        </div>
      ) : null}
      <p className="field-hint">
        {t("qcm.questionsCount", { count: data?.questions.length ?? 0 })}
      </p>

      <dl className="stat-list mt-4">
        <div className="fact">
          <dt>{t("qcm.liveNow")}</dt>
          <dd>{liveCount}</dd>
        </div>
        <div className="fact">
          <dt>{t("qcm.finished")}</dt>
          <dd>{doneCount}</dd>
        </div>
        <div className="fact">
          <dt>{t("qcm.passed")}</dt>
          <dd>{passedCount}</dd>
        </div>
      </dl>

      <div className="no-print mt-6 flex flex-wrap gap-2">
        {open ? (
          <button type="button" className="btn-outline btn-block" disabled={busy} onClick={() => void setStatus("closed")}>
            {t("qcm.close")}
          </button>
        ) : (
          <button type="button" className="btn-primary btn-block" disabled={busy} onClick={() => void setStatus("open")}>
            {t("qcm.open")}
          </button>
        )}
        {!open && exam && !exam.scoresSent ? (
          <button type="button" className="btn-primary btn-block" disabled={busy} onClick={() => void sendScores()}>
            {t("qcm.sendScores")}
          </button>
        ) : null}
        {exam?.scoresSent ? <p className="field-hint">{t("qcm.scoresSent")}</p> : null}
      </div>

      {waitingCameras.length ? (
        <>
          <h2 className="mt-8">{t("qcm.cameras")}</h2>
          <div className="call-grid mt-4">
            {waitingCameras.map((peer) => (
              <CandidateVideo key={peer.peerId} stream={peer.stream} name={peer.name} />
            ))}
          </div>
        </>
      ) : null}

      <h2 className="mt-8">{t("qcm.candidates")}</h2>
      {!attempts.length ? <p className="lede mt-3">{t("qcm.empty")}</p> : null}

      <div className="qcm-cards mt-4">
        {attempts.map((item) => {
          const progress = item.status === "completed" ? item.questionCount : item.currentIndex;
          const peer = remotes.find((remote) => remote.memberId === item.memberId);
          return (
            <article key={item.id} className={`qcm-card ${item.status === "in_progress" ? "is-live" : ""}${awayIds.has(item.memberId) ? " is-away" : ""}`}>
              {peer ? <CandidateVideo stream={peer.stream} name={item.memberName} /> : null}
              <div className="qcm-card-top">
                <strong>{item.memberName}</strong>
                <span
                  className={`badge ${
                    awayIds.has(item.memberId)
                      ? ""
                      : item.status === "in_progress"
                        ? "wait"
                        : exam && item.score !== null && item.score >= exam.passScore
                          ? "ok"
                          : ""
                  }`}
                >
                  {awayIds.has(item.memberId)
                    ? t("qcm.leftScreen")
                    : item.status === "in_progress"
                      ? t("qcm.inProgress")
                      : exam && item.score !== null && item.score >= exam.passScore
                        ? t("qcm.passed")
                        : t("qcm.failed")}
                </span>
              </div>
              <p className="buyer-meta">
                {item.memberEmail}
                {item.clubName ? ` · ${item.clubName}` : ""}
                {item.clubRole ? ` · ${item.clubRole}` : ""}
              </p>
              <dl className="buyer-facts">
                <div>
                  <dt>{t("qcm.question")}</dt>
                  <dd>
                    {progress}/{item.questionCount}
                  </dd>
                </div>
                <div>
                  <dt>{t("qcm.lastAnswer")}</dt>
                  <dd>
                    {item.lastCorrect === null ? "—" : item.lastCorrect ? t("qcm.correct") : t("qcm.wrong")}
                  </dd>
                </div>
                <div>
                  <dt>{t("qcm.scoreLabel")}</dt>
                  <dd>{item.score === null ? "—" : `${item.score}/${item.questionCount}`}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      {message ? <p className="mt-3 text-sm text-ticket">{message}</p> : null}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useCallMedia } from "../call";
import { VideoTile } from "../components/VideoTile";
import { useLiveStatus, useLiveTick, useAwayIds } from "../live";
import type { QcmAdminState } from "../types";

function CandidateVideo({
  stream,
  screen,
  name,
}: {
  stream: MediaStream | null;
  screen: MediaStream | null;
  name: string;
}) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [listen, setListen] = useState(false);
  const main = screen ?? stream;
  const pip = screen ? stream : null;

  function expand() {
    const node = wrapRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void node.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div className={`call-card-video${screen ? " has-screen" : ""}`} ref={wrapRef}>
      <VideoTile stream={main} muted={Boolean(screen) || !listen} label={name} className={screen ? "is-screen" : ""} />
      {pip ? <VideoTile stream={pip} muted={!listen} mirror label={t("qcm.camera")} className="is-pip" /> : null}
      <div className="call-video-actions">
        <button type="button" className="call-listen" onClick={() => setListen((value) => !value)}>
          {listen ? t("qcm.mute") : t("qcm.listen")}
        </button>
        {screen ? (
          <button type="button" className="call-listen" onClick={expand}>
            {t("qcm.expandScreen")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MonitorPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<QcmAdminState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const tick = useLiveTick();
  const live = useLiveStatus();
  const awayIds = useAwayIds();
  const { local, remotes, camera, hangUp, startCall } = useCallMedia();
  const lang = i18n.language === "en" ? "en" : "fr";

  async function load() {
    const next = await api.qcm(lang);
    setData(next);
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => {
      setReady(true);
      setMessage(t("errors.generic"));
    });
  }, [t, tick, lang]);

  useEffect(() => {
    if (live) return;
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [live, lang]);

  if (!ready) return <p className="lede">…</p>;

  const exam = data?.exam ?? null;
  const attempts = data?.attempts ?? [];
  const invites = data?.invites ?? [];
  const archives = data?.archives ?? [];
  const liveCount = attempts.filter((item) => item.status === "in_progress").length;
  const doneCount = attempts.filter((item) => item.status === "completed").length;
  const passedCount = attempts.filter(
    (item) => item.status === "completed" && exam && item.score !== null && item.score >= exam.passScore,
  ).length;
  const open = exam?.status === "open";
  const examTitle = exam ? localized(exam, i18n.language, "title") : "";
  const attemptIds = new Set(attempts.map((item) => item.memberId));
  const waitingCameras = remotes.filter((peer) => !attemptIds.has(peer.memberId));
  const canInvite = inviteEmails.some((value) => value.trim());

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
    const emails = inviteEmails.map((value) => value.trim()).filter(Boolean);
    if (!emails.length) return;
    setInviting(true);
    setMessage("");
    try {
      const next = await api.inviteQcm({ emails, lang });
      setData(next);
      setInviteEmails([""]);
      setMessage(t("qcm.inviteSent", { title: examTitle, count: next.sent }));
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

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(t("qcm.linkCopied"));
    } catch {
      setMessage(t("errors.generic"));
    }
  }

  async function archiveSession() {
    if (!window.confirm(t("qcm.archiveConfirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      setData(await api.archiveQcm());
      hangUp();
      setMessage(t("qcm.archiveDone"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage(code === "no_session" ? t("qcm.archiveEmpty") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function removeArchive(archivedAt: string) {
    if (!window.confirm(t("qcm.deleteArchiveConfirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      setData(await api.deleteArchive({ archivedAt }));
      setMessage(t("qcm.deleteArchiveDone"));
    } catch {
      setMessage(t("errors.generic"));
    } finally {
      setBusy(false);
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
      <h1>{examTitle || t("qcm.title")}</h1>
      <p className="lede mt-3">{t("qcm.lead")}</p>
      {exam ? (
        <article className="qcm-session-card mt-4">
          <p className="eyebrow">{t("qcm.thisExam")}</p>
          <h2>{examTitle}</h2>
          <p className="field-hint">
            {t("qcm.examSlug", { slug: exam.slug })} · {t("qcm.questionsCount", { count: data?.questions.length ?? 0 })}
          </p>
          <p className="lede mt-3">{t("qcm.inviteLead", { title: examTitle })}</p>
          <div className="mt-4 grid gap-2">
            {inviteEmails.map((value, index) => (
              <div className="invite-row" key={index}>
                <label>
                  {t("qcm.takerEmail", { n: index + 1 })}
                  <input
                    type="email"
                    autoComplete="off"
                    value={value}
                    onChange={(event) =>
                      setInviteEmails((rows) => rows.map((item, i) => (i === index ? event.target.value : item)))
                    }
                    placeholder={t("qcm.invitePlaceholder")}
                  />
                </label>
                {inviteEmails.length > 1 ? (
                  <button type="button" className="btn-ghost" onClick={() => setInviteEmails((rows) => rows.filter((_, i) => i !== index))}>
                    {t("qcm.remove")}
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="btn-outline"
              disabled={inviteEmails.length >= 80}
              onClick={() => setInviteEmails((rows) => [...rows, ""])}
            >
              {t("qcm.addTaker")}
            </button>
            <p className="field-hint">{t("qcm.inviteHint", { title: examTitle })}</p>
            <button type="button" className="btn-primary" disabled={inviting || !canInvite} onClick={() => void sendInvite()}>
              {inviting ? t("qcm.inviteSending") : t("qcm.inviteSend", { title: examTitle })}
            </button>
          </div>
          {invites.length ? (
            <>
              <h3 className="mt-6">{t("qcm.liveInvites")}</h3>
              <ul className="invite-list mt-3">
                {invites.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <span className="badge">{t(`qcm.inviteStatus.${invite.status}`)}</span>
                    </div>
                    <button type="button" className="btn-outline" onClick={() => void copyLink(invite.examUrl)}>
                      {t("qcm.copyLink")}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="field-hint mt-3">{t("qcm.noInvites")}</p>
          )}
        </article>
      ) : null}
      {camera === "need" ? <p className="field-hint">{t("qcm.cameraWait")}</p> : null}
      {camera === "denied" ? <p className="mt-3 text-sm text-ticket">{t("qcm.cameraDenied")}</p> : null}
      {camera === "off" ? <p className="field-hint">{t("qcm.callEnded")}</p> : null}

      <div className="call-self mt-4">
        {local ? <VideoTile stream={local} muted mirror label={t("qcm.you")} /> : null}
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
        {exam && (attempts.length || invites.length) ? (
          <button type="button" className="btn-outline btn-block" disabled={busy} onClick={() => void archiveSession()}>
            {t("qcm.archive")}
          </button>
        ) : null}
      </div>

      {archives.length ? (
        <>
          <h2 className="mt-8">{t("qcm.archives")}</h2>
          <p className="field-hint">{t("qcm.archivesHint")}</p>
          <ul className="archive-list mt-3">
            {archives.map((item) => (
              <li key={item.archivedAt}>
                <div>
                  <strong>{new Date(item.archivedAt).toLocaleString(lang === "en" ? "en-GB" : "fr-FR")}</strong>
                  <p className="field-hint">
                    {t("qcm.archiveMeta", { attempts: item.attempts, invites: item.invites })}
                  </p>
                </div>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => void removeArchive(item.archivedAt)}>
                  {t("qcm.deleteArchive")}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {waitingCameras.length ? (
        <>
          <h2 className="mt-8">{t("qcm.cameras")}</h2>
          <div className="call-grid mt-4">
            {waitingCameras.map((peer) => (
              <CandidateVideo key={peer.peerId} stream={peer.stream} screen={peer.screen} name={peer.name} />
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
              {peer ? <CandidateVideo stream={peer.stream} screen={peer.screen} name={item.memberName} /> : null}
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

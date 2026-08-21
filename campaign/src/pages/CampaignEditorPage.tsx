import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmailPreview } from "../components/EmailPreview";
import { ConfirmModal } from "../components/ConfirmModal";
import { NoticeModal } from "../components/NoticeModal";
import { PeoplePicker } from "../components/PeoplePicker";
import { selectedFromDraft } from "../audience";
import { SAMPLE_PERSON, type PreviewPerson } from "../emailPreview";
import { api, attachmentUrl } from "../api";
import { resizeCampaignImage } from "../resizeImage";
import { readPdfAttachment } from "../readPdfAttachment";
import type {
  AudiencePreview,
  Campaign,
  CampaignAttachment,
  CampaignDraft,
  CampaignMeta,
  CampaignPerson,
  CampaignRecipient,
} from "../types";

function draftFrom(campaign: Campaign): CampaignDraft {
  return {
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader,
    heading: campaign.heading,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    includeMembers: campaign.includeMembers,
    includeBuyers: campaign.includeBuyers,
    optedInOnly: campaign.optedInOnly,
    extraEmails: campaign.extraEmails,
  };
}

function errorText(t: (key: string) => string, error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "invalid_form") return t("errors.invalidForm");
  if (code === "locked") return t("errors.locked");
  if (code === "rate_limited") return t("errors.rateLimited");
  if (code === "brevo_not_configured") return t("errors.brevo");
  if (code === "no_recipients") return t("errors.noRecipients");
  if (code === "too_many_images" || code === "too_many_attachments") return t("campaign.tooManyAttachments");
  if (code === "invalid_image" || code === "invalid_attachment") return t("campaign.badAttachment");
  if (code === "file_too_large") return t("campaign.fileTooLarge");
  if (code === "api_down") return t("errors.apiDown");
  return t("errors.generic");
}

export function CampaignEditorPage() {
  const { t } = useTranslation();
  const { lang, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [attachments, setAttachments] = useState<CampaignAttachment[]>([]);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [meta, setMeta] = useState<CampaignMeta | null>(null);
  const [people, setPeople] = useState<CampaignPerson[]>([]);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [person, setPerson] = useState<PreviewPerson>(SAMPLE_PERSON);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "send" | "image" | "document" | "delete" | "">("");
  const [focusField, setFocusField] = useState<"subject" | "preheader" | "heading" | "body" | "ctaLabel">("body");
  const [askingDelete, setAskingDelete] = useState(false);
  const [askingSend, setAskingSend] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(
    Boolean((location.state as { created?: boolean } | null)?.created),
  );
  const [sentNotice, setSentNotice] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const fieldRefs = {
    subject: useRef<HTMLInputElement>(null),
    preheader: useRef<HTMLInputElement>(null),
    heading: useRef<HTMLInputElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    ctaLabel: useRef<HTMLInputElement>(null),
  };

  const locked = campaign?.status === "sent" || campaign?.status === "sending";

  async function load() {
    if (!id) return;
    const [detail, info, directory] = await Promise.all([api.get(id), api.meta(), api.people()]);
    setCampaign(detail.campaign);
    setDraft(draftFrom(detail.campaign));
    setAttachments(detail.attachments);
    setRecipients(detail.recipients);
    setMeta(info);
    setPeople(directory.people);
  }

  useEffect(() => {
    load().catch(() => setMessage(t("errors.generic")));
  }, [id, t]);

  useEffect(() => {
    if (!draft) return;
    const timer = window.setTimeout(() => {
      api
        .previewAudience(draft)
        .then(setAudience)
        .catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, id]);

  useEffect(() => {
    if (campaign?.status !== "sending" || !id) return;
    const timer = window.setInterval(() => {
      api
        .get(id)
        .then((detail) => {
          setCampaign(detail.campaign);
          setRecipients(detail.recipients);
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [campaign?.status, id]);

  function patch(next: Partial<CampaignDraft>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function insertToken(token: string) {
    if (!draft || locked) return;
    const key = focusField;
    const field = fieldRefs[key].current;
    const current = draft[key];
    const start = field?.selectionStart ?? current.length;
    const end = field?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    patch({ [key]: next });
    requestAnimationFrame(() => {
      field?.focus();
      const pos = start + token.length;
      field?.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    if (!id || !draft) return;
    setBusy("save");
    setMessage("");
    try {
      const { campaign: saved } = await api.save(id, draft);
      setCampaign(saved);
      setDraft(draftFrom(saved));
      setMessage(t("campaign.saved"));
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      setBusy("");
    }
  }

  async function onImages(files: FileList | null) {
    if (!id || !files?.length) return;
    setBusy("image");
    setMessage("");
    try {
      for (const file of [...files]) {
        const resized = await resizeCampaignImage(file);
        if (!resized) {
          setMessage(t("campaign.badImage"));
          continue;
        }
        const { attachment } = await api.addImage(id, {
          filename: file.name.replace(/\.[^.]+$/, ".jpg"),
          mimeType: resized.mimeType,
          content: resized.content,
          inline: true,
        });
        setAttachments((current) => [...current, attachment]);
      }
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      setBusy("");
    }
  }

  async function onDocuments(files: FileList | null) {
    if (!id || !files?.length) return;
    setBusy("document");
    setMessage("");
    try {
      for (const file of [...files]) {
        const payload = await readPdfAttachment(file);
        if (!payload) {
          setMessage(t("campaign.badDocument"));
          continue;
        }
        const { attachment } = await api.addAttachment(id, payload);
        setAttachments((current) => [...current, attachment]);
      }
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      setBusy("");
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!id) return;
    await api.deleteImage(id, attachmentId);
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy("test");
    setMessage("");
    try {
      if (draft) await api.save(id, draft);
      await api.test(id, testEmail);
      setMessage(t("campaign.tested"));
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      setBusy("");
    }
  }

  async function sendAll() {
    if (!id || !draft) return;
    setBusy("send");
    setMessage("");
    try {
      await api.save(id, draft);
      await api.send(id);
      setAskingSend(false);
      setSentCount(audience?.total ?? 0);
      setSentNotice(true);
      await load();
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      setBusy("");
    }
  }

  async function duplicate() {
    if (!id) return;
    const { campaign: copy } = await api.duplicate(id);
    navigate(`/${lang}/${copy.id}`);
  }

  async function remove() {
    if (!id) return;
    setBusy("delete");
    setMessage("");
    try {
      await api.remove(id);
      navigate(`/${lang}`);
    } catch (error) {
      setMessage(errorText(t, error));
      setAskingDelete(false);
    } finally {
      setBusy("");
    }
  }

  const sourceLabel = useMemo(
    () => ({
      member: t("campaign.sourceMember"),
      buyer: t("campaign.sourceBuyer"),
      custom: t("campaign.sourceCustom"),
    }),
    [t],
  );

  const previewPeople = useMemo(() => {
    if (!draft) return [SAMPLE_PERSON];
    const selected = selectedFromDraft(draft, people);
    const fromDir = people.filter((item) => selected.has(item.email));
    const extras = (audience?.recipients ?? []).filter(
      (item) => !people.some((person) => person.email === item.email.toLowerCase()),
    );
    return [...fromDir, ...extras];
  }, [audience, draft, people]);

  if (!campaign || !draft) {
    return <p className="lede">…</p>;
  }

  const inlineImages = attachments.filter((file) => file.inline);
  const fileAttachments = attachments.filter((file) => !file.inline);

  return (
    <section className="grid gap-6">
      <div className="campaign-head">
        <div>
          <Link to={`/${lang}`} className="hint">
            ← {t("campaign.back")}
          </Link>
          <h1 className="mt-2">{draft.name || t("campaign.new")}</h1>
          <p className="mt-2">
            <span className={campaign.status === "sent" ? "badge ok" : "badge wait"}>{t(`campaign.${campaign.status}`)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => void duplicate()}>
            {t("campaign.duplicate")}
          </button>
          {campaign.status !== "sending" ? (
            <button type="button" className="btn-danger" disabled={Boolean(busy)} onClick={() => setAskingDelete(true)}>
              {t("campaign.delete")}
            </button>
          ) : null}
        </div>
      </div>

      {meta && !meta.brevo ? <p className="text-ticket">{t("campaign.brevoOff")}</p> : null}
      {message ? <p className="text-sm text-ticket">{message}</p> : null}

      <div className="campaign-grid split">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            {t("campaign.name")}
            <input value={draft.name} disabled={locked} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label>
            {t("campaign.subject")}
            <input
              ref={fieldRefs.subject}
              value={draft.subject}
              required
              disabled={locked}
              onFocus={() => setFocusField("subject")}
              onChange={(e) => patch({ subject: e.target.value })}
            />
          </label>
          <label>
            {t("campaign.preheader")}
            <input
              ref={fieldRefs.preheader}
              value={draft.preheader}
              disabled={locked}
              onFocus={() => setFocusField("preheader")}
              onChange={(e) => patch({ preheader: e.target.value })}
            />
          </label>
          <label>
            {t("campaign.heading")}
            <input
              ref={fieldRefs.heading}
              value={draft.heading}
              disabled={locked}
              onFocus={() => setFocusField("heading")}
              onChange={(e) => patch({ heading: e.target.value })}
            />
          </label>
          <label>
            {t("campaign.body")}
            <textarea
              ref={fieldRefs.body}
              rows={8}
              value={draft.body}
              disabled={locked}
              onFocus={() => setFocusField("body")}
              onChange={(e) => patch({ body: e.target.value })}
            />
          </label>
          <div className="token-row">
            <span>{t("campaign.tokensHelp")}</span>
            {(
              [
                ["{{firstName}}", t("campaign.tokenFirst")],
                ["{{name}}", t("campaign.tokenName")],
                ["{{email}}", t("campaign.tokenEmail")],
              ] as const
            ).map(([token, label]) => (
              <button
                key={token}
                type="button"
                className="token"
                disabled={locked}
                onClick={() => insertToken(token)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              {t("campaign.ctaLabel")}
              <input
                ref={fieldRefs.ctaLabel}
                value={draft.ctaLabel}
                disabled={locked}
                onFocus={() => setFocusField("ctaLabel")}
                onChange={(e) => patch({ ctaLabel: e.target.value })}
              />
            </label>
            <label>
              {t("campaign.ctaUrl")}
              <input value={draft.ctaUrl} disabled={locked} onChange={(e) => patch({ ctaUrl: e.target.value })} />
            </label>
          </div>

          <PeoplePicker people={people} draft={draft} locked={locked} onPatch={patch} />
          {audience ? (
            <p className="hint">
              {t("campaign.audienceTotal", { count: audience.total })}
              {audience.invalid ? ` · ${t("campaign.invalidExtra", { count: audience.invalid })}` : ""}
              {audience.truncated ? ` · ${t("campaign.truncated")}` : ""}
            </p>
          ) : null}

          <div>
            <h2>{t("campaign.images")}</h2>
            <p className="hint">{t("campaign.imagesHelp")}</p>
            {!locked ? (
              <label className="btn-outline file-btn mt-3">
                {t("campaign.addImage")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  disabled={busy === "image"}
                  onChange={(e) => {
                    void onImages(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            ) : null}
            {inlineImages.length ? (
              <div className="image-grid mt-4">
                {inlineImages.map((file) => (
                  <article key={file.id} className="image-card">
                    <img src={attachmentUrl(campaign.id, file.id)} alt={file.filename} />
                    <footer>
                      <span>{t("campaign.inline")}</span>
                      {!locked ? (
                        <button type="button" className="btn-ghost" onClick={() => void removeAttachment(file.id)}>
                          {t("campaign.remove")}
                        </button>
                      ) : null}
                    </footer>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <h2>{t("campaign.documents")}</h2>
            <p className="hint">{t("campaign.documentsHelp")}</p>
            {!locked ? (
              <label className="btn-outline file-btn mt-3">
                {t("campaign.addDocument")}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  disabled={busy === "document"}
                  onChange={(e) => {
                    void onDocuments(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            ) : null}
            {fileAttachments.length ? (
              <ul className="file-list mt-4">
                {fileAttachments.map((file) => (
                  <li key={file.id} className="file-card">
                    <div>
                      <strong>{file.filename}</strong>
                      <p>{t("campaign.documentSize", { size: Math.max(1, Math.round(file.bytes / 1024)) })}</p>
                    </div>
                    {!locked ? (
                      <button type="button" className="btn-ghost" onClick={() => void removeAttachment(file.id)}>
                        {t("campaign.remove")}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {!locked ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline" disabled={Boolean(busy)}>
                {busy === "save" ? t("campaign.saving") : t("campaign.save")}
              </button>
              <button type="button" className="btn-primary" disabled={Boolean(busy) || !meta?.brevo} onClick={() => setAskingSend(true)}>
                {busy === "send" ? t("campaign.sending") : t("campaign.send")}
              </button>
            </div>
          ) : null}
        </form>

        <div className="grid gap-4">
          <EmailPreview
            draft={draft}
            campaignId={campaign.id}
            attachments={attachments}
            people={previewPeople}
            person={person}
            onPerson={setPerson}
          />
          {!locked ? (
            <form className="grid gap-3" onSubmit={(e) => void sendTest(e)}>
              <label>
                {t("campaign.testEmail")}
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </label>
              <button className="btn-outline" disabled={Boolean(busy) || !meta?.brevo}>
                {busy === "test" ? t("campaign.testing") : t("campaign.test")}
              </button>
            </form>
          ) : null}
          {recipients.length ? (
            <div>
              <h2>{t("campaign.recipients", { count: recipients.length })}</h2>
              <table className="data-table mt-3">
                <thead>
                  <tr>
                    <th>{t("admin.email")}</th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((person) => (
                    <tr key={person.email}>
                      <td>
                        <strong>{person.name || person.email}</strong>
                        <div className="hint">{person.email}</div>
                      </td>
                      <td>{sourceLabel[person.source]}</td>
                      <td>
                        <span className={person.status === "sent" ? "badge ok" : person.status === "failed" ? "badge" : "badge wait"}>
                          {person.status === "sent"
                            ? t("campaign.ok")
                            : person.status === "failed"
                              ? t("campaign.err")
                              : t("campaign.pending")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : audience?.recipients.length ? (
            <div>
              <h2>{t("campaign.recipients", { count: audience.total })}</h2>
              <ul className="mt-3">
                {audience.recipients.map((item) => (
                  <li key={item.email} className="pillar">
                    <button
                      type="button"
                      className="mail-pick"
                      onClick={() => setPerson({ name: item.name, email: item.email.toLowerCase() })}
                    >
                      <strong>{item.name || item.email}</strong>
                      <p>{item.email}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      {askingSend ? (
        <ConfirmModal
          title={t("campaign.send")}
          body={t("campaign.sendingConfirm", { count: audience?.total ?? 0 })}
          confirmLabel={busy === "send" ? t("campaign.sending") : t("campaign.send")}
          cancelLabel={t("campaign.cancel")}
          busy={busy === "send"}
          onConfirm={() => void sendAll()}
          onCancel={() => {
            if (busy !== "send") setAskingSend(false);
          }}
        />
      ) : null}
      {askingDelete ? (
        <ConfirmModal
          title={t("campaign.delete")}
          body={t("campaign.deleteConfirm")}
          confirmLabel={busy === "delete" ? t("campaign.deleting") : t("campaign.delete")}
          cancelLabel={t("campaign.cancel")}
          busy={busy === "delete"}
          onConfirm={() => void remove()}
          onCancel={() => {
            if (busy !== "delete") setAskingDelete(false);
          }}
        />
      ) : null}
      {createdNotice ? (
        <NoticeModal
          title={t("campaign.createdTitle")}
          body={t("campaign.createdBody")}
          okLabel={t("campaign.gotIt")}
          onClose={() => setCreatedNotice(false)}
        />
      ) : null}
      {sentNotice ? (
        <NoticeModal
          title={t("campaign.sentTitle")}
          body={t("campaign.sentBody", { count: sentCount })}
          okLabel={t("campaign.gotIt")}
          onClose={() => setSentNotice(false)}
        />
      ) : null}
    </section>
  );
}

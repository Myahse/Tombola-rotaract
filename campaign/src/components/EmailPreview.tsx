import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { attachmentUrl } from "../api";
import { firstName, SAMPLE_PERSON, type PreviewPerson } from "../emailPreview";
import type { CampaignAttachment, CampaignDraft } from "../types";

type Device = "desktop" | "mobile";

function fill(template: string, person: PreviewPerson) {
  const first = firstName(person.name || person.email);
  return template
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{name}}", person.name.trim() || first)
    .replaceAll("{{email}}", person.email);
}

function decorate(template: string, person: PreviewPerson): ReactNode {
  const first = firstName(person.name || person.email);
  const values: Record<string, string> = {
    "{{firstName}}": first,
    "{{name}}": person.name.trim() || first,
    "{{email}}": person.email,
  };
  const parts = template.split(/(\{\{(?:firstName|name|email)\}\})/g);
  if (parts.length === 1) return template;
  return parts.map((part, index) =>
    values[part] ? (
      <mark key={index} className="mail-token">
        {values[part]}
      </mark>
    ) : (
      part
    ),
  );
}

function decoratedBlocks(body: string, person: PreviewPerson) {
  const text = body.trim();
  if (!text) return [];
  return text.split(/\n{2,}/).map((block) => block.split("\n").map((line) => decorate(line, person)));
}

export function EmailPreview({
  draft,
  campaignId,
  attachments,
  people,
  person,
  onPerson,
}: {
  draft: CampaignDraft;
  campaignId: string;
  attachments: CampaignAttachment[];
  people: PreviewPerson[];
  person: PreviewPerson;
  onPerson: (person: PreviewPerson) => void;
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>("desktop");
  const view = useMemo(() => {
    const headingSource = draft.heading.trim() || draft.subject;
    return {
      subject: decorate(draft.subject, person),
      subjectText: fill(draft.subject, person),
      preheader: fill(draft.preheader || headingSource, person),
      heading: decorate(headingSource, person),
      blocks: decoratedBlocks(draft.body, person),
      ctaLabel: draft.ctaLabel.trim() ? decorate(draft.ctaLabel, person) : null,
      ctaUrl: draft.ctaUrl.trim(),
    };
  }, [draft, person]);
  const inline = attachments.filter((file) => file.inline);
  const options = useMemo(() => {
    const map = new Map<string, PreviewPerson>();
    map.set(SAMPLE_PERSON.email, SAMPLE_PERSON);
    for (const item of people) {
      const email = item.email.trim().toLowerCase();
      if (email) map.set(email, { name: item.name, email });
    }
    return [...map.values()];
  }, [people]);

  return (
    <div className="mail-shell">
      <div className="mail-toolbar">
        <strong>{t("campaign.preview")}</strong>
        <div className="mail-devices" role="group" aria-label={t("campaign.preview")}>
          <button type="button" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>
            {t("campaign.previewDesktop")}
          </button>
          <button type="button" className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>
            {t("campaign.previewMobile")}
          </button>
        </div>
      </div>
      <p className="hint">{t("campaign.previewSample")}</p>

      <label className="mail-to">
        {t("campaign.previewAs")}
        <select
          value={person.email}
          onChange={(e) => {
            const next = options.find((item) => item.email === e.target.value) ?? SAMPLE_PERSON;
            onPerson(next);
          }}
        >
          {options.map((item) => (
            <option key={item.email} value={item.email}>
              {item.name ? `${item.name} · ${item.email}` : item.email}
            </option>
          ))}
        </select>
      </label>

      <div className={`mail-inbox ${device}`}>
        <div className="mail-meta">
          <p>
            <span>{t("campaign.previewFrom")}</span>
            <strong>Rotaract IUGB Club</strong>
          </p>
          <p>
            <span>{t("campaign.previewTo")}</span>
            <strong>{person.name || person.email}</strong>
          </p>
          <p className="mail-subject">{view.subjectText ? view.subject : t("campaign.subject")}</p>
          {view.preheader ? <p className="mail-preheader">{view.preheader}</p> : null}
        </div>

        <div className="mail-stage">
          <article className="mail-card">
            <header className="mail-brand">
              <img src="/logo.png" alt="Rotaract IUGB Club" width={220} height={141} />
            </header>
            <div className="mail-body">
              <p className="mail-kicker">Rotaract IUGB Club</p>
              <h2>{view.heading || t("campaign.heading")}</h2>
              {view.blocks.length ? (
                view.blocks.map((block, index) => (
                  <p key={index}>
                    {block.map((line, lineIndex) => (
                      <span key={lineIndex}>
                        {lineIndex ? <br /> : null}
                        {line}
                      </span>
                    ))}
                  </p>
                ))
              ) : (
                <p className="mail-placeholder">{t("campaign.body")}</p>
              )}
              {inline.map((file) => (
                <img
                  key={file.id}
                  className="mail-photo"
                  src={attachmentUrl(campaignId, file.id)}
                  alt={file.filename}
                />
              ))}
            </div>
            {view.ctaLabel && view.ctaUrl ? (
              <div className="mail-cta">
                <a href={view.ctaUrl} target="_blank" rel="noreferrer">
                  {view.ctaLabel}
                </a>
              </div>
            ) : null}
            <footer>
              Rotaract IUGB Club · Côte d’Ivoire
              <br />
              On se retrouve au club — et à la prochaine tombola.
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}


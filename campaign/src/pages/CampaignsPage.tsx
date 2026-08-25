import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { adhesionCampaignDraft } from "../formTemplate";
import type { Campaign, CampaignMeta } from "../types";

function statusClass(status: Campaign["status"]) {
  if (status === "sent") return "badge ok";
  if (status === "failed") return "badge";
  return "badge wait";
}

export function CampaignsPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [meta, setMeta] = useState<CampaignMeta | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"blank" | "adhesion" | "">("");
  const [pendingId, setPendingId] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([api.list(), api.meta()])
      .then(([list, info]) => {
        setCampaigns(list.campaigns);
        setMeta(info);
      })
      .catch(() => setMessage(t("errors.generic")));
  }, [t]);

  async function create(kind: "blank" | "adhesion" = "blank") {
    setBusy(kind);
    setMessage("");
    try {
      const draft =
        kind === "adhesion"
          ? adhesionCampaignDraft(lang ?? "fr", t)
          : {
              name: "",
              subject: t("campaign.new"),
              preheader: "",
              heading: "",
              body: "",
              ctaLabel: "",
              ctaUrl: "",
              includeMembers: true,
              includeBuyers: false,
              optedInOnly: true,
              extraEmails: "",
            };
      const { campaign } = await api.create(draft);
      navigate(`/${lang}/${campaign.id}`, { state: { created: true } });
    } catch {
      setMessage(t("errors.generic"));
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!pendingId) return;
    setDeleting(true);
    setMessage("");
    try {
      await api.remove(pendingId);
      setCampaigns((current) => current?.filter((item) => item.id !== pendingId) ?? null);
      setPendingId("");
    } catch {
      setMessage(t("errors.generic"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="campaign-head">
        <div>
          <p className="eyebrow">{t("home.kicker")}</p>
          <h1>{t("campaign.title")}</h1>
          <p className="lede mt-3">{t("campaign.lede")}</p>
          {meta ? (
            <p className="hint">
              {t("campaign.counts", {
                members: meta.audience.members,
                optedIn: meta.audience.optedIn,
                buyers: meta.audience.buyers,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={Boolean(busy)} onClick={() => void create("adhesion")}>
            {busy === "adhesion" ? t("campaign.saving") : t("form.newCampaign")}
          </button>
          <button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={() => void create("blank")}>
            {busy === "blank" ? t("campaign.saving") : t("campaign.new")}
          </button>
        </div>
      </div>
      {meta && !meta.brevo ? <p className="lede mt-4 text-ticket">{t("campaign.brevoOff")}</p> : null}
      {message ? <p className="mt-4 text-sm text-ticket">{message}</p> : null}
      {!campaigns ? (
        <p className="lede mt-6">…</p>
      ) : !campaigns.length ? (
        <p className="lede mt-6">{t("campaign.empty")}</p>
      ) : (
        <div className="mt-6">
          {campaigns.map((item) => (
            <article key={item.id} className="pillar flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3>{item.name || item.subject}</h3>
                <p>{item.subject}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass(item.status)}>{t(`campaign.${item.status}`)}</span>
                <span className="hint">
                  {t("campaign.recipients", { count: item.recipientCount || item.sentCount })}
                </span>
                <Link className="btn-outline" to={`/${lang}/${item.id}`}>
                  {t("campaign.open")}
                </Link>
                {item.status !== "sending" ? (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={deleting}
                    onClick={() => setPendingId(item.id)}
                  >
                    {t("campaign.delete")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      {pendingId ? (
        <ConfirmModal
          title={t("campaign.delete")}
          body={t("campaign.deleteConfirm")}
          confirmLabel={deleting ? t("campaign.deleting") : t("campaign.delete")}
          cancelLabel={t("campaign.cancel")}
          busy={deleting}
          onConfirm={() => void remove()}
          onCancel={() => {
            if (!deleting) setPendingId("");
          }}
        />
      ) : null}
    </section>
  );
}

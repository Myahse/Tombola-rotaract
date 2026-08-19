import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.list(), api.meta()])
      .then(([list, info]) => {
        setCampaigns(list.campaigns);
        setMeta(info);
      })
      .catch(() => setMessage(t("errors.generic")));
  }, [t]);

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const { campaign } = await api.create({
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
      });
      navigate(`/${lang}/${campaign.id}`);
    } catch {
      setMessage(t("errors.generic"));
    } finally {
      setBusy(false);
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
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void create()}>
          {t("campaign.new")}
        </button>
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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

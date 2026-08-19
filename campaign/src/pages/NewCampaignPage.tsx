import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export function NewCampaignPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .create({
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
      })
      .then(({ campaign }) => navigate(`/${lang}/${campaign.id}`, { replace: true }))
      .catch(() => navigate(`/${lang}`, { replace: true }));
  }, [lang, navigate, t]);

  return <p className="lede">…</p>;
}

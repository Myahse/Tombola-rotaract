import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageSkeleton } from "../components/PageSkeleton";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, loading } = useAuth();
  const [error, setError] = useState("");
  const token = params.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setError("invalid_token");
      return;
    }
    let cancelled = false;
    api
      .verifyEmail(token)
      .then(async () => {
        await refresh();
        if (!cancelled) navigate(`/${lang}/account`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof Error ? err.message : "";
        setError(code === "too_many_requests" ? "too_many_requests" : "invalid_token");
      });
    return () => {
      cancelled = true;
    };
  }, [token, lang, navigate, refresh]);

  if (loading && !error) return <PageSkeleton kind="auth" />;

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("auth.verifyTitle")}</h1>
      {error ? (
        <>
          <p>
            {error === "too_many_requests" ? t("errors.tooMany") : t("errors.invalidToken")}
          </p>
          <p className="auth-switch">
            <Link to={`/${lang}/account`}>{t("auth.forgotBack")}</Link>
          </p>
        </>
      ) : (
        <p>{t("auth.verifyWait")}</p>
      )}
    </section>
  );
}

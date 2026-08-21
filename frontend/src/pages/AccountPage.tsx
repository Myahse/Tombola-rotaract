import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/Avatar";
import { StatusPill } from "../components/ScratchTicket";
import { PageSkeleton } from "../components/PageSkeleton";
import { resizeImage } from "../resizeImage";
import type { MemberTombola } from "../types";
import {
  disablePush,
  enablePush,
  getPushSubscription,
  isIosDevice,
  isStandaloneDisplay,
  pushSupported,
} from "../pwa";

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const { member, loading, refresh } = useAuth();
  const [tombolas, setTombolas] = useState<MemberTombola[] | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubRole, setClubRole] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [pushTested, setPushTested] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    if (!member) return;
    setAvatarUrl(member.avatarUrl ?? "");
    setName(member.name);
    setPhone(member.phone ?? "");
    setClubName(member.clubName ?? "");
    setClubRole(member.clubRole ?? "");
    api
      .myTombolas()
      .then((data) => setTombolas(data.tombolas))
      .catch(() => setTombolas([]));
    if (pushSupported()) {
      void (async () => {
        try {
          const local = await getPushSubscription();
          const data = await api.pushStatus(local?.endpoint);
          setPushConfigured(data.configured);
          setPushOn(data.subscribed);
        } catch {
          setPushConfigured(false);
          setPushOn(false);
        }
      })();
    }
  }, [member]);

  if (loading) return <PageSkeleton kind="account" />;
  if (!member) return <Navigate to={`/${lang}/login?next=/${lang}/account`} replace />;

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    const dataUrl = await resizeImage(file);
    if (dataUrl) setAvatarUrl(dataUrl);
  }

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileSaved(false);
    if (password || confirm) {
      if (password !== confirm) {
        setProfileError(t("errors.passwordMismatch"));
        return;
      }
      if (!currentPassword) {
        setProfileError(t("errors.currentRequired"));
        return;
      }
    }
    setProfileBusy(true);
    setProfileError("");
    try {
      await api.updateProfile({
        name,
        phone,
        avatarUrl,
        clubName,
        clubRole,
        ...(password ? { currentPassword, password } : {}),
      });
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setProfileSaved(true);
      await refresh();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setProfileError(
        code === "invalid_password"
          ? t("errors.invalidPassword")
          : code === "current_required"
            ? t("errors.currentRequired")
            : code === "invalid_form"
              ? t("errors.invalidRegister")
              : t("errors.generic"),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function onTogglePush() {
    setPushError("");
    setPushBusy(true);
    try {
      if (pushOn) {
        const endpoint = await disablePush();
        await api.pushUnsubscribe(endpoint ?? undefined);
        setPushOn(false);
        return;
      }
      const { publicKey } = await api.pushKey();
      if (!publicKey) {
        setPushError(t("pwa.unavailable"));
        return;
      }
      const subscription = await enablePush(publicKey);
      if (!subscription) {
        setPushError(
          Notification.permission === "denied" ? t("pwa.blocked") : t("pwa.unavailable"),
        );
        return;
      }
      await api.pushSubscribe(subscription);
      setPushOn(true);
    } catch {
      setPushError(t("pwa.subscribeFailed"));
    } finally {
      setPushBusy(false);
    }
  }

  async function onTestPush() {
    setPushError("");
    setPushTested(false);
    setPushBusy(true);
    try {
      await api.pushTest();
      setPushTested(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setPushError(code === "not_subscribed" ? t("pwa.subscribeFailed") : t("errors.generic"));
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("account.title")}</h1>
      <div className="account-hello">
        <Avatar name={member.name} src={member.avatarUrl} size={56} />
        <p>
          {t("account.hello", { name: member.name })} {t("account.lede")}
        </p>
      </div>
      {!member.emailVerified ? (
        <article className="account-card">
          <h2>{t("account.verifyTitle")}</h2>
          <p className="field-hint" style={{ margin: 0 }}>
            {t("account.verifyLead")}
          </p>
          {verifySent ? <p className="field-ok">{t("account.verifySent")}</p> : null}
          <button
            type="button"
            className="btn-primary"
            disabled={verifyBusy}
            onClick={() => {
              setVerifyBusy(true);
              api
                .resendVerifyEmail()
                .then(() => setVerifySent(true))
                .catch(() => setProfileError(t("errors.generic")))
                .finally(() => setVerifyBusy(false));
            }}
          >
            {verifyBusy ? t("auth.submitting") : t("account.verifyResend")}
          </button>
        </article>
      ) : null}

      {pushSupported() && pushConfigured ? (
        <article className="account-card account-profile">
          <h2>{t("pwa.notifyTitle")}</h2>
          <p className="field-hint" style={{ margin: 0 }}>
            {isIosDevice() && !isStandaloneDisplay()
              ? t("pwa.notifyIos")
              : t("pwa.notifyAccount")}
          </p>
          {pushError ? <p className="text-sm text-ticket">{pushError}</p> : null}
          {pushTested ? <p className="field-ok">{t("pwa.testSent")}</p> : null}
          <div className="pwa-banner-actions" style={{ marginLeft: 0 }}>
            <button
              type="button"
              className={pushOn ? "btn-outline" : "btn-primary"}
              disabled={pushBusy || (isIosDevice() && !isStandaloneDisplay())}
              onClick={() => void onTogglePush()}
            >
              {pushBusy ? t("auth.submitting") : pushOn ? t("pwa.disable") : t("pwa.notifyCta")}
            </button>
            {pushOn && !import.meta.env.PROD ? (
              <button type="button" className="btn-primary" disabled={pushBusy} onClick={() => void onTestPush()}>
                {t("pwa.testCta")}
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      <article className="account-card account-profile">
        <h2>{t("account.profileTitle")}</h2>
        <form className="grid gap-4" onSubmit={(e) => void onSaveProfile(e)}>
          <label className="avatar-picker">
            <span>{t("auth.photo")}</span>
            <span className="avatar-picker-row">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="person-avatar" width={72} height={72} />
              ) : (
                <span className="person-avatar fallback" style={{ width: 72, height: 72, fontSize: 22 }}>
                  +
                </span>
              )}
              <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </span>
          </label>
          {avatarUrl ? (
            <button type="button" className="btn-ghost" onClick={() => setAvatarUrl("")}>
              {t("account.removePhoto")}
            </button>
          ) : null}
          <label>
            {t("auth.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
          </label>
          <label>
            {t("auth.email")}
            <input value={member.email} type="email" disabled autoComplete="email" />
            <em className="field-hint">{t("account.emailLocked")}</em>
          </label>
          <label>
            {t("auth.phone")}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              required
              minLength={8}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label>
            {t("auth.clubName")}
            <input
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              minLength={2}
              placeholder={t("auth.clubNameHint")}
              autoComplete="organization"
            />
          </label>
          <label>
            {t("auth.clubRole")}
            <input
              value={clubRole}
              onChange={(e) => setClubRole(e.target.value)}
              minLength={2}
              list="club-roles"
              placeholder={t("auth.clubRoleHint")}
            />
            <datalist id="club-roles">
              <option value="Membre" />
              <option value="Président" />
              <option value="Vice-président" />
              <option value="Secrétaire" />
              <option value="Trésorier" />
              <option value="Sergent d’armes" />
              <option value="Directeur" />
              <option value="Past President" />
              <option value="Ami du club" />
            </datalist>
          </label>
          <label>
            {t("account.currentPassword")}
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <label>
            {t("account.newPassword")}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t("auth.confirmPassword")}
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {profileError ? <p className="text-sm text-ticket">{profileError}</p> : null}
          {profileSaved ? <p className="field-ok">{t("account.saved")}</p> : null}
          <button disabled={profileBusy} className="btn-primary">
            {profileBusy ? t("auth.submitting") : t("account.saveProfile")}
          </button>
        </form>
      </article>

      {tombolas === undefined ? (
        <PageSkeleton kind="list" />
      ) : tombolas.length === 0 ? (
        <div className="mt-6 grid gap-3">
          <p>{t("account.empty")}</p>
          <Link to={`/${lang}/buy`} className="btn-primary">
            {t("nav.buy")}
          </Link>
        </div>
      ) : (
        <div className="account-list page-appear">
          {tombolas.map((tombola) => {
            const title = localized(tombola, i18n.language, "title");
            const statusLabel =
              tombola.status === "on_sale"
                ? t("home.onSale")
                : tombola.status === "drawn"
                  ? t("home.drawn")
                  : t("home.closed");
            const ticketCount = tombola.orders.reduce((sum, order) => sum + order.quantity, 0);
            const reservedCount = tombola.orders
              .filter((order) => order.status === "reserved")
              .reduce((sum, order) => sum + order.quantity, 0);
            return (
              <article key={tombola.eventId} className="account-card">
                <div className="account-card-head">
                  <h2>{title}</h2>
                  <StatusPill tone={tombola.status === "drawn" ? "ok" : "wait"}>{statusLabel}</StatusPill>
                </div>
                <p>{t("account.ticketCount", { count: ticketCount })}</p>
                {reservedCount > 0 ? (
                  <p className="field-hint">{t("account.reservedSummary", { count: reservedCount })}</p>
                ) : null}
                <Link to={`/${lang}/my-tickets/${tombola.eventId}`} className="btn-primary">
                  {t("account.openAllTickets")}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

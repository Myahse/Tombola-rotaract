import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/Avatar";
import { StatusPill } from "../components/ScratchTicket";
import { WaveLogo } from "../components/WaveLogo";
import { PageSkeleton } from "../components/PageSkeleton";
import { resizeImage } from "../resizeImage";
import type { MemberTombola } from "../types";

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const { member, loading, refresh } = useAuth();
  const [tombolas, setTombolas] = useState<MemberTombola[] | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    if (!member) return;
    setAvatarUrl(member.avatarUrl ?? "");
    setName(member.name);
    setPhone(member.phone ?? "");
    api
      .myTombolas()
      .then((data) => setTombolas(data.tombolas))
      .catch(() => setTombolas([]));
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
        <div className="account-list">
          {tombolas.map((tombola) => {
            const title = localized(tombola, i18n.language, "title");
            const statusLabel =
              tombola.status === "on_sale"
                ? t("home.onSale")
                : tombola.status === "drawn"
                  ? t("home.drawn")
                  : t("home.closed");
            const ticketCount = tombola.orders.reduce((sum, order) => sum + order.quantity, 0);
            return (
              <article key={tombola.eventId} className="account-card">
                <div className="account-card-head">
                  <h2>{title}</h2>
                  <StatusPill tone={tombola.status === "drawn" ? "ok" : "wait"}>{statusLabel}</StatusPill>
                </div>
                <p>
                  {t("account.ticketCount", { count: ticketCount })}
                </p>
                {tombola.orders.map((order) => (
                  <div key={order.token} className="account-order">
                    <p>
                      {order.status === "paid" ? t("confirm.statusPaid") : t("confirm.statusReserved")}
                      {" · "}
                      {order.paymentMethod === "wave" ? (
                        <span className="pay-label">
                          <WaveLogo />
                          {t("pay.wave")}
                        </span>
                      ) : (
                        t("pay.cash")
                      )}
                      {order.tickets.length
                        ? ` · ${order.tickets.map((ticket) => ticket.number).join(", ")}`
                        : ` · ${t("account.waitingNumbers", { count: order.quantity })}`}
                    </p>
                    <Link to={`/${lang}/tickets/${order.token}`} className="btn-outline">
                      {t("account.openTickets")}
                    </Link>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

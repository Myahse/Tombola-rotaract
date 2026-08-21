import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { isLanguage } from "../i18n";
import { LangSwitcher } from "./LangSwitcher";
import { BrandLogo } from "./BrandLogo";
import { LiveProvider } from "../live";
import { LoginModal } from "./LoginModal";
import { PageSkeleton } from "./PageSkeleton";
import { PwaPrompts } from "./PwaPrompts";
import { OrganizerEventProvider, useOrganizerEvent } from "../eventContext";

const publicSite = import.meta.env.VITE_PUBLIC_SITE ?? "http://localhost:5173";

export function OrganizerLayout() {
  return (
    <LiveProvider>
      <OrganizerEventProvider>
        <OrganizerShell />
      </OrganizerEventProvider>
    </LiveProvider>
  );
}

function OrganizerShell() {
  const { lang } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState<"loading" | "yes" | "no">("loading");
  const { eventId, events, setEventId } = useOrganizerEvent();

  useEffect(() => {
    if (!isLanguage(lang)) {
      navigate("/fr", { replace: true });
      return;
    }
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang, i18n, navigate]);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed("yes"))
      .catch(() => setAuthed("no"));
  }, []);

  const base = `/${lang}`;
  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  const loggedIn = authed === "yes";

  async function onLogout() {
    await api.logout();
    setAuthed("no");
    navigate(base);
  }

  const tabs = [
    { to: base, end: true, label: t("admin.dashboardShort") },
    { to: `${base}/tombola`, end: false, label: t("admin.tombola") },
    { to: `${base}/buyers`, end: false, label: t("admin.buyers"), short: t("admin.buyersShort") },
    { to: `${base}/donations`, end: false, label: t("admin.donations"), short: t("admin.donationsShort") },
    { to: `${base}/qr`, end: false, label: t("admin.qr"), short: t("admin.qrShort") },
    { to: `${base}/draw`, end: false, label: t("admin.draw") },
  ];

  const navLinks = (id: string, compact = false) =>
    tabs.map((item) => (
      <NavLink key={`${id}-${item.to}`} to={item.to} end={item.end} className={navClass}>
        {compact ? (item.short ?? item.label) : item.label}
      </NavLink>
    ));

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <NavLink to={base} className="brand-row">
          <BrandLogo />
        </NavLink>
        {loggedIn ? (
          <nav className="site-nav hide-mobile" aria-label="Organizers">
            {navLinks("top")}
            <a href={`${publicSite}/${lang ?? "fr"}`} target="_blank" rel="noreferrer">
              {t("nav.viewSite")}
            </a>
          </nav>
        ) : null}
        <div className="header-end">
          {loggedIn && events.length ? (
            <label className="event-switch">
              <select
                aria-label={t("admin.currentTombola")}
                value={eventId ?? ""}
                onChange={(e) => setEventId(e.target.value || null)}
              >
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.titleFr}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {loggedIn ? (
            <>
              <a
                href={`${publicSite}/${lang ?? "fr"}`}
                target="_blank"
                rel="noreferrer"
                className="header-auth show-mobile"
              >
                {t("nav.viewSiteShort")}
              </a>
              <button type="button" className="header-auth" onClick={() => void onLogout()}>
                <span className="hide-mobile">{t("admin.logout")}</span>
                <span className="show-mobile">{t("admin.logoutShort")}</span>
              </button>
            </>
          ) : null}
          <LangSwitcher />
        </div>
      </header>
      <main className="page">
        {loggedIn ? <PwaPrompts authed={loggedIn} /> : null}
        <div key={`${authed}-${location.pathname}-${eventId ?? ""}`} className="page-appear">
          {authed === "loading" ? <PageSkeleton kind="page" /> : loggedIn ? <Outlet /> : null}
        </div>
      </main>
      {loggedIn ? (
        <nav className="bottom-nav nav-6 show-mobile no-print" aria-label="Mobile">
          {navLinks("bottom", true)}
        </nav>
      ) : null}
      {authed === "no" ? <LoginModal onSuccess={() => setAuthed("yes")} /> : null}
    </div>
  );
}

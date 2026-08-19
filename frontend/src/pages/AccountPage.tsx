import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, localized } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/Avatar";
import { StatusPill } from "../components/ScratchTicket";
import { WaveLogo } from "../components/WaveLogo";
import { PageSkeleton } from "../components/PageSkeleton";
import type { MemberTombola } from "../types";

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams();
  const { member, loading } = useAuth();
  const [tombolas, setTombolas] = useState<MemberTombola[] | undefined>(undefined);

  useEffect(() => {
    if (!member) return;
    api
      .myTombolas()
      .then((data) => setTombolas(data.tombolas))
      .catch(() => setTombolas([]));
  }, [member]);

  if (loading) return <PageSkeleton kind="account" />;
  if (!member) return <Navigate to={`/${lang}/login?next=/${lang}/account`} replace />;

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

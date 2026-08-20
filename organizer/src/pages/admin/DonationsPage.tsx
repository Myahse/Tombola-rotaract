import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, formatMoney } from "../../api";
import { useLiveTick } from "../../live";
import type { AdminDonation } from "../../types";
import { WaveLogo } from "../../components/WaveLogo";
import { PageSkeleton } from "../../components/PageSkeleton";
import { ConfirmModal } from "../../components/ConfirmModal";

export function DonationsPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<AdminDonation[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<AdminDonation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tick = useLiveTick();

  async function load() {
    const data = await api.donations();
    setRows(data.donations);
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => setReady(true));
  }, [tick]);

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const sorted = [...rows].sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === "pending") return -1;
    return 1;
  });

  async function confirmReceived() {
    if (!pending) return;
    setBusyId(pending.id);
    setError("");
    try {
      await api.markDonationReceived(pending.id);
      setPending(null);
      await load();
    } catch {
      setError(t("errors.generic"));
      setPending(null);
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <PageSkeleton kind="list" />;

  return (
    <section className="buyers-page">
      <div className="buyers-head">
        <div>
          <h1>{t("admin.donations")}</h1>
          {rows.length ? (
            <p className="buyers-count">
              {t("admin.donationsPending", { count: pendingCount })} · {rows.length}
            </p>
          ) : null}
        </div>
      </div>
      <p className="lede mt-3">{t("admin.donationsHelp")}</p>
      {error ? <p className="text-sm text-ticket mt-3">{error}</p> : null}

      {!sorted.length ? (
        <p className="lede mt-6">{t("admin.noDonations")}</p>
      ) : (
        <>
          <div className="buyers-cards">
            {sorted.map((row) => (
              <article key={row.id} className={`buyer-card ${row.status === "pending" ? "is-wait" : ""}`}>
                <div className="buyer-card-top">
                  <strong>{row.donorName}</strong>
                  <span className={`badge ${row.status === "received" ? "ok" : "wait"}`}>
                    {row.status === "received" ? t("admin.donationReceived") : t("admin.donationPending")}
                  </span>
                </div>
                <p className="buyer-meta">{row.donorEmail || t("admin.noAccount")}</p>
                {row.donorPhone ? (
                  <a className="buyer-meta" href={`tel:${row.donorPhone}`}>
                    {row.donorPhone}
                  </a>
                ) : null}
                <dl className="buyer-facts">
                  <div>
                    <dt>{t("admin.amount")}</dt>
                    <dd>{formatMoney(row.amountCents, "XOF", i18n.language)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.payment")}</dt>
                    <dd>
                      <span className="pay-label">
                        <WaveLogo />
                        {t("admin.payWave")}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.waveId")}</dt>
                    <dd className="wave-ref">{row.paymentRef}</dd>
                  </div>
                </dl>
                {row.status === "pending" ? (
                  <div className="buyer-actions">
                    <button
                      className="btn-primary"
                      disabled={busyId === row.id}
                      onClick={() => setPending(row)}
                    >
                      {t("admin.markReceived")}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="buyers-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("buy.name")}</th>
                  <th>{t("buy.email")}</th>
                  <th>{t("buy.phone")}</th>
                  <th>{t("admin.amount")}</th>
                  <th>{t("admin.waveId")}</th>
                  <th>{t("admin.reserved")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <td>{row.donorName}</td>
                    <td className="cell-clip">{row.donorEmail || t("admin.noAccount")}</td>
                    <td>{row.donorPhone ? <a href={`tel:${row.donorPhone}`}>{row.donorPhone}</a> : "—"}</td>
                    <td>{formatMoney(row.amountCents, "XOF", i18n.language)}</td>
                    <td className="wave-ref">{row.paymentRef}</td>
                    <td>
                      <span className={`badge ${row.status === "received" ? "ok" : "wait"}`}>
                        {row.status === "received" ? t("admin.donationReceived") : t("admin.donationPending")}
                      </span>
                    </td>
                    <td>
                      {row.status === "pending" ? (
                        <button
                          className="btn-primary"
                          disabled={busyId === row.id}
                          onClick={() => setPending(row)}
                        >
                          {t("admin.markReceived")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pending ? (
        <ConfirmModal
          title={t("admin.markReceivedTitle")}
          body={t("admin.markReceivedBody", {
            name: pending.donorName,
            amount: formatMoney(pending.amountCents, "XOF", i18n.language),
            ref: pending.paymentRef,
          })}
          confirmLabel={t("admin.markReceived")}
          cancelLabel={t("admin.back")}
          busy={busyId === pending.id}
          onConfirm={() => void confirmReceived()}
          onCancel={() => {
            if (!busyId) setPending(null);
          }}
        />
      ) : null}
    </section>
  );
}

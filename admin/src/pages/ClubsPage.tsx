import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, type ClubRow } from "../api";
import { NoticeModal } from "../components/NoticeModal";

export function ClubsPage() {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    slug: "",
    name: "",
    organizerEmail: "",
    organizerPassword: "",
  });

  async function load() {
    const data = await api.clubs();
    setClubs(data.clubs);
  }

  useEffect(() => {
    void load().catch(() => setError(t("errors.generic")));
  }, [t]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createClub(form);
      setForm({ slug: "", name: "", organizerEmail: "", organizerPassword: "" });
      setNotice(t("clubs.created"));
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "slug_taken"
          ? t("errors.slugTaken")
          : code === "invalid_slug"
            ? t("errors.invalidSlug")
            : code === "invalid_form"
              ? t("errors.invalidForm")
              : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(club: ClubRow) {
    const status = club.status === "suspended" ? "active" : "suspended";
    await api.patchClub(club.id, { status });
    await load();
  }

  function statusLabel(status: string) {
    if (status === "suspended") return t("clubs.statusSuspended");
    if (status === "trial") return t("clubs.statusTrial");
    return t("clubs.statusActive");
  }

  return (
    <section className="stack">
      <h1>{t("clubs.title")}</h1>
      <p className="lede">{t("clubs.lead")}</p>

      <form className="card grid gap-4" onSubmit={onCreate}>
        <h2>{t("clubs.create")}</h2>
        <label>
          {t("clubs.slug")}
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="rotaract-abidjan"
            required
          />
          <em>{t("clubs.slugHint")}</em>
        </label>
        <label>
          {t("clubs.name")}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          {t("clubs.organizerEmail")}
          <input
            type="email"
            value={form.organizerEmail}
            onChange={(e) => setForm({ ...form, organizerEmail: e.target.value })}
            required
          />
        </label>
        <label>
          {t("clubs.organizerPassword")}
          <input
            type="password"
            value={form.organizerPassword}
            onChange={(e) => setForm({ ...form, organizerPassword: e.target.value })}
            required
            minLength={8}
          />
        </label>
        {error ? <p className="text-sm text-ticket">{error}</p> : null}
        <button className="btn-primary" disabled={busy}>
          {busy ? t("clubs.busy") : t("clubs.submit")}
        </button>
      </form>

      {clubs.length === 0 ? (
        <p className="lede">{t("clubs.empty")}</p>
      ) : (
        <ul className="stack">
          {clubs.map((club) => (
            <li key={club.id} className="card">
              <strong>{club.name}</strong>
              <p className="lede">
                {club.slug} · {statusLabel(club.status)}
                {club.organizerEmails ? ` · ${club.organizerEmails}` : ""}
              </p>
              <div className="modal-actions" style={{ marginTop: 12 }}>
                {club.publicUrl ? (
                  <a className="btn-primary" href={club.publicUrl} target="_blank" rel="noreferrer">
                    {t("clubs.openSite")}
                  </a>
                ) : null}
                <button type="button" className="header-auth" onClick={() => void toggle(club)}>
                  {club.status === "suspended" ? t("clubs.activate") : t("clubs.suspend")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notice ? (
        <NoticeModal title={t("clubs.create")} body={notice} okLabel={t("clubs.ok")} onClose={() => setNotice("")} />
      ) : null}
    </section>
  );
}

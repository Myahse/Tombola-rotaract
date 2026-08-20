import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { NoticeModal } from "../../components/NoticeModal";

export function ClubSettingsPage() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    wavePayUrl: "",
    senderName: "",
    organizerEmails: "",
    publicUrl: "",
    logoUrl: "",
    logoDarkUrl: "",
    password: "",
  });

  useEffect(() => {
    void api.clubSettings().then(({ club }) => {
      setForm({
        name: club.name,
        wavePayUrl: club.wavePayUrl,
        senderName: club.senderName,
        organizerEmails: club.organizerEmails,
        publicUrl: club.publicUrl,
        logoUrl: club.logoUrl ?? "",
        logoDarkUrl: club.logoDarkUrl ?? "",
        password: "",
      });
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveClub({
        name: form.name,
        wavePayUrl: form.wavePayUrl,
        senderName: form.senderName,
        organizerEmails: form.organizerEmails,
        publicUrl: form.publicUrl,
        logoUrl: form.logoUrl || null,
        logoDarkUrl: form.logoDarkUrl || null,
        password: form.password || undefined,
      });
      setForm((current) => ({ ...current, password: "" }));
      setNotice(t("admin.clubSaved"));
    } catch {
      setNotice(t("errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h1>{t("admin.clubSettings")}</h1>
      <p className="lede">{t("admin.clubSettingsLead")}</p>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label>
          {t("admin.clubName")}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          {t("admin.waveUrl")}
          <input value={form.wavePayUrl} onChange={(e) => setForm({ ...form, wavePayUrl: e.target.value })} />
        </label>
        <label>
          {t("admin.senderName")}
          <input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
        </label>
        <label>
          {t("admin.organizerEmails")}
          <input value={form.organizerEmails} onChange={(e) => setForm({ ...form, organizerEmails: e.target.value })} />
        </label>
        <label>
          {t("admin.publicUrl")}
          <input value={form.publicUrl} onChange={(e) => setForm({ ...form, publicUrl: e.target.value })} />
        </label>
        <label>
          {t("admin.logoUrl")}
          <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
        </label>
        <label>
          {t("admin.logoDarkUrl")}
          <input value={form.logoDarkUrl} onChange={(e) => setForm({ ...form, logoDarkUrl: e.target.value })} />
        </label>
        <label>
          {t("admin.newPassword")}
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
          />
        </label>
        <button className="btn-primary" disabled={busy}>
          {busy ? t("admin.saving") : t("admin.save")}
        </button>
      </form>
      {notice ? (
        <NoticeModal title={t("admin.clubSettings")} body={notice} okLabel={t("admin.ok")} onClose={() => setNotice("")} />
      ) : null}
    </section>
  );
}

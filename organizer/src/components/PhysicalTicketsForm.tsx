import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { NoticeModal } from "./NoticeModal";

export function PhysicalTicketsForm({
  onSaved,
  className,
}: {
  onSaved?: () => Promise<void> | void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.addPhysical({ name, quantity, phone });
      setName("");
      setPhone("");
      setQuantity(1);
      setNotice(t("admin.physicalSaved"));
      await onSaved?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "not_enough_tickets"
          ? t("errors.notEnough")
          : code === "event_locked"
            ? t("admin.locked")
            : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`grid gap-3${className ? ` ${className}` : ""}`} onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("admin.physicalTitle")}</h2>
      <p className="lede">{t("admin.physicalHelp")}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label>
          {t("buy.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          {t("buy.phone")}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </label>
        <label>
          {t("buy.quantity")}
          <input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-ticket">{error}</p> : null}
      <button className="btn-primary" disabled={busy}>
        {busy ? t("admin.physicalSaving") : t("admin.physicalCta")}
      </button>
      {notice ? (
        <NoticeModal
          title={t("admin.physicalTitle")}
          body={notice}
          okLabel={t("admin.ok")}
          onClose={() => setNotice("")}
        />
      ) : null}
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { NoticeModal } from "./NoticeModal";
import { PhysicalTicketsSheet } from "./PhysicalTicketsSheet";

function PhysicalTicketFields({
  name,
  phone,
  quantity,
  busy,
  onNameChange,
  onPhoneChange,
  onQuantityChange,
  t,
}: {
  name: string;
  phone: string;
  quantity: number;
  busy: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label>
        {t("buy.name")}
        <input value={name} onChange={(e) => onNameChange(e.target.value)} required minLength={2} disabled={busy} />
      </label>
      <label>
        {t("buy.phone")}
        <input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          type="tel"
          required
          minLength={8}
          autoComplete="tel"
          inputMode="tel"
          disabled={busy}
        />
      </label>
      <label>
        {t("buy.quantity")}
        <input
          type="number"
          min={1}
          max={50}
          value={quantity}
          onChange={(e) => onQuantityChange(Number(e.target.value) || 1)}
          disabled={busy}
        />
      </label>
    </div>
  );
}

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
  const [sheetOpen, setSheetOpen] = useState(false);

  async function submitPhysical() {
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
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitInline(e: FormEvent) {
    e.preventDefault();
    await submitPhysical();
  }

  const fields = (
    <PhysicalTicketFields
      name={name}
      phone={phone}
      quantity={quantity}
      busy={busy}
      onNameChange={setName}
      onPhoneChange={setPhone}
      onQuantityChange={setQuantity}
      t={t}
    />
  );

  return (
    <div className={className}>
      <div className="hide-mobile">
        <form className="grid gap-3" onSubmit={(e) => void onSubmitInline(e)}>
          <h2>{t("admin.physicalTitle")}</h2>
          <p className="lede">{t("admin.physicalHelp")}</p>
          {fields}
          {error && !sheetOpen ? <p className="text-sm text-ticket">{error}</p> : null}
          <button className="btn-primary" disabled={busy}>
            {busy ? t("admin.physicalSaving") : t("admin.physicalCta")}
          </button>
        </form>
      </div>

      <div className="show-mobile physical-tickets-mobile">
        <h2>{t("admin.physicalTitle")}</h2>
        <p className="lede">{t("admin.physicalHelp")}</p>
        {error && !sheetOpen ? <p className="text-sm text-ticket">{error}</p> : null}
        <button type="button" className="btn-primary btn-block mt-3" onClick={() => setSheetOpen(true)}>
          {t("admin.physicalOpen")}
        </button>
      </div>

      {sheetOpen ? (
        <PhysicalTicketsSheet
          title={t("admin.physicalTitle")}
          help={t("admin.physicalHelp")}
          confirmLabel={busy ? t("admin.physicalSaving") : t("admin.physicalCta")}
          cancelLabel={t("admin.physicalClose")}
          busy={busy}
          onConfirm={() => submitPhysical()}
          onClose={() => {
            setSheetOpen(false);
            setError("");
          }}
        >
          {fields}
          {error ? <p className="text-sm text-ticket modal-error">{error}</p> : null}
        </PhysicalTicketsSheet>
      ) : null}

      {notice ? (
        <NoticeModal
          title={t("admin.physicalTitle")}
          body={notice}
          okLabel={t("admin.ok")}
          onClose={() => setNotice("")}
        />
      ) : null}
    </div>
  );
}

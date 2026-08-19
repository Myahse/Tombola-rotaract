import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminEvent, Prize } from "../../types";

const emptyPrize = (rank: number): Prize => ({
  rank,
  nameFr: "",
  nameEn: "",
  descriptionFr: "",
  descriptionEn: "",
});

const emptyForm = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  paymentInstructionsFr: "",
  paymentInstructionsEn: "",
  ticketPriceCents: 1000,
  currency: "XOF",
  totalTickets: 50,
};

export function TombolaPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<AdminEvent | null | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [prizes, setPrizes] = useState<Prize[]>([emptyPrize(1)]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvent() {
    const data = await api.adminEvent();
    setEvent(data.event);
    if (data.event) {
      setForm({
        titleFr: data.event.titleFr,
        titleEn: data.event.titleEn,
        descriptionFr: data.event.descriptionFr,
        descriptionEn: data.event.descriptionEn,
        paymentInstructionsFr: data.event.paymentInstructionsFr,
        paymentInstructionsEn: data.event.paymentInstructionsEn,
        ticketPriceCents: data.event.ticketPriceCents,
        currency: data.event.currency,
        totalTickets: data.event.totalTickets,
      });
    }
    if (data.prizes.length) setPrizes(data.prizes);
  }

  useEffect(() => {
    loadEvent().catch(() => {
      setEvent(null);
      setMessage(t("errors.apiDown"));
    });
  }, [t]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const namedPrizes = prizes
      .map((prize) => prize.nameFr.trim())
      .filter(Boolean)
      .map((nameFr, index) => ({
        rank: index + 1,
        nameFr,
        nameEn: nameFr,
        descriptionFr: "",
        descriptionEn: "",
      }));
    const payload = {
      ...form,
      titleFr: form.titleFr.trim(),
      titleEn: form.titleFr.trim(),
      descriptionEn: form.descriptionFr,
      paymentInstructionsEn: form.paymentInstructionsFr,
      ticketPriceCents: Number.isFinite(form.ticketPriceCents) ? form.ticketPriceCents : 0,
      totalTickets: Number.isFinite(form.totalTickets) ? form.totalTickets : 1,
      prizes: namedPrizes,
    };
    try {
      if (!event || event.status === "drawn") {
        const created = await api.createEvent(payload);
        setEvent(created.event);
        setPrizes(namedPrizes.length ? namedPrizes : [emptyPrize(1)]);
        setMessage(namedPrizes.length ? t("admin.createdVisible") : t("admin.createdDraft"));
        navigate(`/${lang ?? "fr"}`);
        return;
      }
      const saved = await api.saveEvent(payload);
      setEvent(saved.event);
      setPrizes(namedPrizes.length ? namedPrizes : [emptyPrize(1)]);
      setMessage(t("admin.save"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "active_event_exists") {
        setMessage(t("errors.activeEvent"));
        loadEvent().catch(() => undefined);
      } else if (code === "invalid_form") {
        setMessage(t("errors.invalidForm"));
      } else if (code === "Failed to fetch" || code === "request_failed") {
        setMessage(t("errors.apiDown"));
      } else {
        setMessage(t("errors.generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (event === undefined) return <p>…</p>;
  const locked = event?.status === "drawn";

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <h1>{event ? t("admin.tombola") : t("admin.newTombola")}</h1>
      {event?.status === "draft" ? (
        <p className="lede">
          {t("admin.draftHelp")}{" "}
          <button
            type="button"
            className="link-ok"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              api
                .setStatus("on_sale")
                .then(() => loadEvent())
                .then(() => setMessage(t("admin.createdVisible")))
                .catch((error) =>
                  setMessage(
                    error instanceof Error && error.message === "need_prizes"
                      ? t("admin.needPrizes")
                      : t("errors.generic"),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {t("admin.openSales")}
          </button>
        </p>
      ) : null}
      {locked ? <p className="text-sm text-ink/70">{t("admin.locked")}</p> : null}
      <div className="grid gap-4">
        <Field label={t("admin.title")} value={form.titleFr} onChange={(v) => update("titleFr", v)} disabled={locked} />
        <Area label={t("admin.description")} value={form.descriptionFr} onChange={(v) => update("descriptionFr", v)} disabled={locked} />
        <Area label={t("admin.pay")} value={form.paymentInstructionsFr} onChange={(v) => update("paymentInstructionsFr", v)} disabled={locked} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t("admin.price")}
            type="number"
            value={String(form.ticketPriceCents)}
            onChange={(v) => update("ticketPriceCents", Number(v))}
            disabled={locked}
          />
          <Field
            label={t("admin.totalTickets")}
            type="number"
            value={String(form.totalTickets)}
            onChange={(v) => update("totalTickets", Number(v))}
            disabled={locked}
          />
        </div>
      </div>
      <div>
        <h2>{t("admin.prizes")}</h2>
        <div className="mt-3 space-y-3">
          {prizes.map((prize, index) => (
            <div key={index} className="grid gap-2 border-b border-line py-3 md:grid-cols-[auto_1fr_auto]">
              <span className="text-2xl font-semibold text-primary">{index + 1}</span>
              <input
                disabled={locked}
                placeholder={t("admin.prizeName")}
                value={prize.nameFr}
                onChange={(e) =>
                  setPrizes((rows) => rows.map((row, i) => (i === index ? { ...row, nameFr: e.target.value } : row)))
                }
              />
              {!locked ? (
                <button type="button" className="link-err" onClick={() => setPrizes((rows) => rows.filter((_, i) => i !== index))}>
                  {t("admin.remove")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {!locked ? (
          <button type="button" className="btn-ghost mt-3" onClick={() => setPrizes((rows) => [...rows, emptyPrize(rows.length + 1)])}>
            {t("admin.addPrize")}
          </button>
        ) : null}
      </div>
      {!locked ? (
        <button disabled={busy} className="btn-primary">
          {event ? t("admin.save") : t("admin.create")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEvent(null);
            setForm(emptyForm);
            setPrizes([emptyPrize(1)]);
          }}
        >
          {t("admin.newTombola")}
        </button>
      )}
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea
        disabled={disabled}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </label>
  );
}

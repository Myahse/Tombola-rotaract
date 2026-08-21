import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminEvent, Prize } from "../../types";
import { PageSkeleton } from "../../components/PageSkeleton";
import { NoticeModal } from "../../components/NoticeModal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { PhysicalTicketsForm } from "../../components/PhysicalTicketsForm";
import { useOrganizerEvent } from "../../eventContext";

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
  drawMode: "scratch" as "scratch" | "roulette",
  salesOpensAt: "",
};

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TombolaPage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId, setEventId, refreshEvents } = useOrganizerEvent();
  const composing = Boolean((location.state as { compose?: boolean } | null)?.compose);
  const [event, setEvent] = useState<AdminEvent | null | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [prizes, setPrizes] = useState<Prize[]>([emptyPrize(1)]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string; next?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        drawMode: data.event.drawMode === "roulette" ? "roulette" : "scratch",
        salesOpensAt: toDatetimeLocal(data.event.salesOpensAt),
      });
    } else {
      setForm(emptyForm);
      setPrizes([emptyPrize(1)]);
    }
    if (data.prizes.length) setPrizes(data.prizes);
  }

  useEffect(() => {
    if (composing) {
      setEvent(null);
      setForm(emptyForm);
      setPrizes([emptyPrize(1)]);
      return;
    }
    loadEvent().catch(() => {
      setEvent(null);
      setMessage(t("errors.apiDown"));
    });
  }, [t, eventId, composing]);

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
      salesOpensAt: form.salesOpensAt.trim() ? new Date(form.salesOpensAt).toISOString() : null,
      prizes: namedPrizes,
    };
    try {
      if (!event || event.status === "drawn" || composing) {
        const created = await api.createEvent(payload);
        setEventId(created.event.id);
        await refreshEvents();
        setEvent(created.event);
        setPrizes(namedPrizes.length ? namedPrizes : [emptyPrize(1)]);
        setNotice({
          title: t("admin.createdTitle"),
          body: created.event.status === "on_sale" ? t("admin.createdVisible") : t("admin.createdDraft"),
          next: payload.drawMode === "scratch" && namedPrizes.length ? `/${lang ?? "fr"}/draw` : undefined,
        });
        navigate(`/${lang ?? "fr"}/tombola`, { replace: true, state: {} });
        return;
      }
      const saved = await api.saveEvent(payload);
      setEvent(saved.event);
      setPrizes(namedPrizes.length ? namedPrizes : [emptyPrize(1)]);
      setNotice({
        title: t("admin.savedTitle"),
        body: t("admin.savedBody"),
        next: payload.drawMode === "scratch" && namedPrizes.length ? `/${lang ?? "fr"}/draw` : undefined,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "another_on_sale") {
        setMessage(t("errors.anotherOnSale"));
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

  async function onDelete() {
    setBusy(true);
    setMessage("");
    try {
      await api.deleteEvent();
      setConfirmDelete(false);
      await refreshEvents();
      await loadEvent();
      setNotice({ title: t("admin.deletedTitle"), body: t("admin.deletedBody") });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setConfirmDelete(false);
      setMessage(code === "event_not_finished" ? t("errors.eventNotFinished") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (event === undefined && !composing) return <PageSkeleton kind="tombola" />;
  const locked = Boolean(event?.status === "drawn" && !composing);
  const canDelete = Boolean(event && !composing && (event.status === "closed" || event.status === "drawn"));

  return (
    <>
    <form className="grid gap-5" onSubmit={onSubmit}>
      <h1>{event && !composing ? t("admin.tombola") : t("admin.newTombola")}</h1>
      {event && !composing ? (
        <p>
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate(`/${lang ?? "fr"}/tombola`, { state: { compose: true } })}
          >
            {t("admin.newTombola")}
          </button>
        </p>
      ) : null}
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
                      : error instanceof Error && error.message === "another_on_sale"
                        ? t("errors.anotherOnSale")
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
        <Field
          label={t("admin.salesOpensAt")}
          type="datetime-local"
          value={form.salesOpensAt}
          onChange={(v) => update("salesOpensAt", v)}
          disabled={locked}
        />
        <p className="text-sm text-ink/70">{t("admin.salesOpensAtHelp")}</p>
        <fieldset className="pay-options">
          <legend>{t("admin.drawMode")}</legend>
          <label className={`pay-option ${form.drawMode === "scratch" ? "active" : ""}`}>
            <input
              type="radio"
              name="drawMode"
              value="scratch"
              disabled={locked}
              checked={form.drawMode === "scratch"}
              onChange={() => update("drawMode", "scratch")}
            />
            <span>
              <strong>{t("admin.drawModeScratch")}</strong>
              <em>{t("admin.drawModeScratchHelp")}</em>
            </span>
          </label>
          <label className={`pay-option ${form.drawMode === "roulette" ? "active" : ""}`}>
            <input
              type="radio"
              name="drawMode"
              value="roulette"
              disabled={locked}
              checked={form.drawMode === "roulette"}
              onChange={() => update("drawMode", "roulette")}
            />
            <span>
              <strong>{t("admin.drawModeRoulette")}</strong>
              <em>{t("admin.drawModeRouletteHelp")}</em>
            </span>
          </label>
        </fieldset>
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
          {event && !composing ? t("admin.save") : t("admin.create")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/${lang ?? "fr"}/tombola`, { state: { compose: true } })}
        >
          {t("admin.newTombola")}
        </button>
      )}
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
    {event && !composing && event.status !== "drawn" ? <PhysicalTicketsForm className="mt-8" /> : null}
    {canDelete ? (
      <div className="mt-8 grid gap-3">
        <h2>{t("admin.deleteTitle")}</h2>
        <p className="lede">{t("admin.deleteHelp")}</p>
        <p>
          <button type="button" className="btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            {t("admin.deleteTombola")}
          </button>
        </p>
      </div>
    ) : null}
    {confirmDelete ? (
      <ConfirmModal
        title={t("admin.deleteTitle")}
        body={t("admin.deleteBody")}
        confirmLabel={t("admin.deleteTombola")}
        cancelLabel={t("admin.back")}
        busy={busy}
        danger
        onConfirm={() => void onDelete()}
        onCancel={() => {
          if (!busy) setConfirmDelete(false);
        }}
      />
    ) : null}
    {notice ? (
      <NoticeModal
        title={notice.title}
        body={notice.body}
        okLabel={t("admin.ok")}
        onClose={() => {
          const next = notice.next;
          setNotice(null);
          if (next) navigate(next);
        }}
      />
    ) : null}
    </>
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

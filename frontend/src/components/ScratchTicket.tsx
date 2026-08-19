import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ScratchTicketProps = {
  number: number;
  title: string;
  buyerName: string;
  token: string;
  canScratch: boolean;
  lockedLabel: string;
  prizeName?: string | null;
  prizeRank?: number | null;
  alreadyOpen?: boolean;
  onReveal?: () => void;
  onStart?: () => void;
};

export function StatusPill({
  children,
  tone = "wait",
}: {
  children: string;
  tone?: "ok" | "wait" | "red";
}) {
  const cls = tone === "ok" ? "badge ok" : tone === "red" ? "badge" : "badge wait";
  return <span className={cls}>{children}</span>;
}

export function ScratchTicket({
  number,
  title,
  buyerName,
  token,
  canScratch,
  lockedLabel,
  prizeName,
  prizeRank,
  alreadyOpen,
  onReveal,
  onStart,
}: ScratchTicketProps) {
  const { t } = useTranslation();
  const padded = String(number).padStart(3, "0");
  const won = Boolean(prizeName);

  return (
    <article className="scratch-card">
      <header className="scratch-card-head">
        <span className="brand-dot" aria-hidden />
        <span>{title}</span>
      </header>
      <p className="scratch-card-kicker">{t("scratch.ticket")}</p>
      <p className="scratch-card-number">N° {padded}</p>
      <p className="scratch-card-name">{buyerName}</p>
      <ScratchPanel
        enabled={canScratch}
        storageKey={`scratch:${token}:${number}`}
        label={canScratch ? t("scratch.here") : lockedLabel}
        alreadyOpen={alreadyOpen}
        onReveal={onReveal}
        onStart={onStart}
      >
        {canScratch ? (
          won ? (
            <div className="scratch-win">
              <span className="eyebrow">{t("scratch.win", { rank: prizeRank ?? 0 })}</span>
              <strong>{prizeName}</strong>
            </div>
          ) : alreadyOpen ? (
            <div className="scratch-lose">
              <strong>{t("scratch.lose")}</strong>
            </div>
          ) : (
            <div className="scratch-lose">
              <strong>…</strong>
            </div>
          )
        ) : (
          <div className="scratch-lose">
            <strong>{lockedLabel}</strong>
          </div>
        )}
      </ScratchPanel>
      <footer className="scratch-card-foot">{t("scratch.instruction")}</footer>
    </article>
  );
}

export function NumberedTicket({
  number,
  title,
  buyerName,
  prizeName,
  prizeRank,
  drawn,
  paid,
  waitLabel,
}: {
  number: number;
  title: string;
  buyerName: string;
  prizeName?: string | null;
  prizeRank?: number | null;
  drawn: boolean;
  paid: boolean;
  waitLabel: string;
}) {
  const { t } = useTranslation();
  const padded = String(number).padStart(3, "0");
  const won = Boolean(prizeName);

  return (
    <article className="scratch-card">
      <header className="scratch-card-head">
        <span className="brand-dot" aria-hidden />
        <span>{title}</span>
      </header>
      <p className="scratch-card-kicker">{t("ticket.plain")}</p>
      <p className="scratch-card-number">N° {padded}</p>
      <p className="scratch-card-name">{buyerName}</p>
      <div className="ticket-result">
        {drawn && paid ? (
          won ? (
            <div className="scratch-win">
              <span className="eyebrow">{t("scratch.win", { rank: prizeRank ?? 0 })}</span>
              <strong>{prizeName}</strong>
            </div>
          ) : (
            <div className="scratch-lose">
              <strong>{t("scratch.lose")}</strong>
            </div>
          )
        ) : (
          <div className="scratch-lose">
            <strong>{waitLabel}</strong>
          </div>
        )}
      </div>
    </article>
  );
}

function ScratchPanel({
  enabled,
  storageKey,
  label,
  alreadyOpen,
  onReveal,
  onStart,
  children,
}: {
  enabled: boolean;
  storageKey: string;
  label: string;
  alreadyOpen?: boolean;
  onReveal?: () => void;
  onStart?: () => void;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cleared, setCleared] = useState(
    () => Boolean(alreadyOpen) || localStorage.getItem(storageKey) === "1",
  );
  const last = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const revealed = useRef(Boolean(alreadyOpen));
  const started = useRef(false);

  useEffect(() => {
    if (alreadyOpen) {
      setCleared(true);
      revealed.current = true;
    }
  }, [alreadyOpen]);

  useEffect(() => {
    if (!cleared || revealed.current || !enabled) return;
    revealed.current = true;
    onReveal?.();
  }, [cleared, enabled, onReveal]);

  useEffect(() => {
    if (cleared) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const paint = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#c8c8d0");
      gradient.addColorStop(0.28, "#f4f4f7");
      gradient.addColorStop(0.52, "#b8b8c2");
      gradient.addColorStop(0.78, "#ececf1");
      gradient.addColorStop(1, "#9a9aa8");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      for (let i = -rect.height; i < rect.width; i += 11) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + rect.height, rect.height);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(20,20,22,0.72)";
      ctx.font = "700 15px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label.toUpperCase(), rect.width / 2, rect.height / 2);
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [cleared, label]);

  function pos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function scratchAt(x: number, y: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 44;
    const prev = last.current;
    if (prev) {
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    last.current = { x, y };
  }

  function measureClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 20) transparent += 1;
    }
    if (transparent / (width * height) > 0.28) {
      setCleared(true);
      localStorage.setItem(storageKey, "1");
    }
  }

  return (
    <div ref={wrapRef} className={`scratch-panel${cleared ? " is-open" : ""}`}>
      <div className="scratch-result">{children}</div>
      {!cleared ? (
        <canvas
          ref={canvasRef}
          className="scratch-foil"
          style={{ pointerEvents: enabled ? "auto" : "none" }}
          onPointerDown={(event) => {
            if (!enabled) return;
            if (!started.current) {
              started.current = true;
              onStart?.();
            }
            drawing.current = true;
            last.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = pos(event);
            if (point) scratchAt(point.x, point.y);
          }}
          onPointerMove={(event) => {
            if (!enabled || !drawing.current) return;
            const point = pos(event);
            if (point) scratchAt(point.x, point.y);
          }}
          onPointerUp={() => {
            if (!enabled) return;
            drawing.current = false;
            last.current = null;
            measureClear();
          }}
        />
      ) : null}
    </div>
  );
}

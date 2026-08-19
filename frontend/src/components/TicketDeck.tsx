import { Children, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function TicketDeck({ children, hint }: { children: ReactNode; hint: string }) {
  const { t } = useTranslation();
  const cards = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const total = cards.length;

  function reset() {
    setIndex(0);
    setDx(0);
    setLeaving(null);
    setDragging(false);
  }

  function goNext(dir: "left" | "right") {
    if (leaving || index >= total) return;
    setDragging(false);
    setLeaving(dir);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDx(0);
      setLeaving(null);
    }, 280);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    const target = event.target as HTMLElement;
    if (target.closest(".scratch-foil")) return;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !start.current || leaving) return;
    const mx = event.clientX - start.current.x;
    const my = event.clientY - start.current.y;
    if (Math.abs(mx) < 8 && Math.abs(my) > Math.abs(mx)) return;
    setDx(mx);
  }

  function onPointerUp() {
    if (!dragging) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) > 88) {
      goNext(dx > 0 ? "right" : "left");
      return;
    }
    setDx(0);
  }

  if (!total) return null;

  if (index >= total) {
    return (
      <div className="ticket-deck-done">
        <p>{t("deck.done")}</p>
        <button type="button" className="btn-outline" onClick={reset}>
          {t("deck.replay")}
        </button>
      </div>
    );
  }

  const visible = cards.slice(index, index + 3);

  return (
    <div className="ticket-deck-wrap">
      <p className="ticket-deck-meta">
        {t("deck.count", { current: index + 1, total })}
        <span>{hint}</span>
      </p>
      <div className="ticket-deck">
        {visible.map((card, offset) => {
          const front = offset === 0;
          const fly = front && leaving ? (leaving === "right" ? 460 : -460) : front ? dx : 0;
          const rot = front && leaving ? (leaving === "right" ? 16 : -16) : front ? dx / 18 : 0;
          return (
            <div
              key={index + offset}
              className={`ticket-deck-card${front ? " is-front" : ""}`}
              style={{
                zIndex: 5 - offset,
                transform: front
                  ? `translateX(${fly}px) rotate(${rot}deg)`
                  : `translateY(${offset * 10}px) scale(${1 - offset * 0.045})`,
                opacity: leaving && front ? 0 : 1,
                transition: dragging && front ? "none" : "transform 0.28s ease, opacity 0.28s ease",
              }}
              onPointerDown={front ? onPointerDown : undefined}
              onPointerMove={front ? onPointerMove : undefined}
              onPointerUp={front ? onPointerUp : undefined}
              onPointerCancel={front ? onPointerUp : undefined}
            >
              {card}
            </div>
          );
        })}
      </div>
      <div className="ticket-deck-actions">
        <button type="button" className="btn-outline btn-block" disabled={Boolean(leaving)} onClick={() => goNext("left")}>
          {t("deck.next")}
        </button>
      </div>
    </div>
  );
}

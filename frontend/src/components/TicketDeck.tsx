import { Children, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function TicketDeck({ children, hint }: { children: ReactNode; hint: string }) {
  const { t } = useTranslation();
  const cards = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const total = cards.length;

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= total) {
      setDx(0);
      return;
    }
    setIndex(next);
    setDx(0);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".scratch-foil")) return;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !start.current) return;
    const mx = event.clientX - start.current.x;
    const my = event.clientY - start.current.y;
    if (Math.abs(mx) < 8 && Math.abs(my) > Math.abs(mx)) return;
    setDx(mx);
  }

  function onPointerUp() {
    if (!dragging) return;
    start.current = null;
    setDragging(false);
    if (dx > 88) go(-1);
    else if (dx < -88) go(1);
    else setDx(0);
  }

  if (!total) return null;

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
          const rot = front ? dx / 18 : 0;
          return (
            <div
              key={index + offset}
              className={`ticket-deck-card${front ? " is-front" : ""}`}
              style={{
                zIndex: 5 - offset,
                transform: front
                  ? `translateX(${dx}px) rotate(${rot}deg)`
                  : `translateY(${offset * 10}px) scale(${1 - offset * 0.045})`,
                transition: dragging && front ? "none" : "transform 0.28s ease",
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
        <button type="button" className="btn-outline" disabled={index === 0} onClick={() => go(-1)}>
          {t("deck.prev")}
        </button>
        <button type="button" className="btn-outline" disabled={index >= total - 1} onClick={() => go(1)}>
          {t("deck.next")}
        </button>
      </div>
    </div>
  );
}

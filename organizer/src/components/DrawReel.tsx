import { useMemo } from "react";
import type { Contestant } from "../types";
import { Avatar } from "./Avatar";

const ITEM = 84;

export function DrawReel({
  contestants,
  winnerTicket,
  spinning,
  offset,
  numbersOnly = false,
}: {
  contestants: Contestant[];
  winnerTicket?: number;
  spinning: boolean;
  offset: number;
  numbersOnly?: boolean;
}) {
  const reel = useMemo(() => {
    const base = contestants.length ? contestants : [{ ticketNumber: 0, buyerName: "…", avatarUrl: null }];
    const copies = Math.max(8, Math.ceil(24 / base.length));
    return Array.from({ length: copies }, () => base).flat();
  }, [contestants]);

  return (
    <div className="draw-window" aria-live="polite">
      <div className="draw-window-marker" />
      <div
        className={`draw-reel ${spinning ? "is-spinning" : ""}`}
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {reel.map((person, index) => (
          <div
            key={`${person.ticketNumber}-${index}`}
            className={`draw-reel-item ${numbersOnly ? "is-number" : ""} ${person.ticketNumber === winnerTicket && !spinning ? "is-winner" : ""}`}
            style={{ height: ITEM }}
          >
            {numbersOnly ? (
              <strong>n° {String(person.ticketNumber).padStart(3, "0")}</strong>
            ) : (
              <>
                <Avatar name={person.buyerName} src={person.avatarUrl} size={52} />
                <div>
                  <strong>{person.buyerName}</strong>
                  <p>n° {person.ticketNumber}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function reelOffsetForWinner(contestants: Contestant[], ticketNumber: number) {
  if (!contestants.length) return 0;
  const copies = Math.max(8, Math.ceil(24 / contestants.length));
  const indexInCopy = contestants.findIndex((person) => person.ticketNumber === ticketNumber);
  const safeIndex = indexInCopy >= 0 ? indexInCopy : 0;
  const targetCopy = Math.max(copies - 2, 1);
  const targetIndex = targetCopy * contestants.length + safeIndex;
  return targetIndex * ITEM - 40;
}

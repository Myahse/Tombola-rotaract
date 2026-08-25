import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Point = { x: number; y: number };

function viewBox() {
  const view = window.visualViewport;
  return {
    left: view?.offsetLeft ?? 0,
    top: view?.offsetTop ?? 0,
    width: view?.width ?? window.innerWidth,
    height: view?.height ?? window.innerHeight,
  };
}

function clampToScreen(point: Point, width: number, height: number): Point {
  const margin = 8;
  const box = viewBox();
  const maxX = box.left + box.width - width - margin;
  const maxY = box.top + box.height - height - margin;
  const minX = box.left + margin;
  const minY = box.top + margin;
  return {
    x: Math.min(Math.max(point.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(point.y, minY), Math.max(minY, maxY)),
  };
}

export function DraggableCallDock({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Point | null>(null);
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);

  function clampEl(point: Point) {
    const el = ref.current;
    if (!el) return point;
    return clampToScreen(point, el.offsetWidth, el.offsetHeight);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos((prev) => clampEl(prev ?? { x: rect.left, y: rect.top }));
    const observer = new ResizeObserver(() => {
      const next = el.getBoundingClientRect();
      setPos((prev) => clampEl(prev ?? { x: next.left, y: next.top }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onResize() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos((prev) => clampEl(prev ?? { x: rect.left, y: rect.top }));
    }
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDragging(true);
    el.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(clampEl({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    setDragging(false);
    if (ref.current?.hasPointerCapture(event.pointerId)) {
      ref.current.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={ref}
      className={`call-dock${dragging ? " is-dragging" : ""}${pos ? " is-placed" : ""}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  );
}

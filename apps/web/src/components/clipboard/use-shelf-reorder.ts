"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVATE_PX = 10;

export type ShelfDragState = {
  id: string;
  fromIndex: number;
  /** Insert index among remaining items (0..length after removal). */
  insertIndex: number;
  width: number;
  height: number;
  x: number;
  y: number;
  grabX: number;
};

type Pending = {
  id: string;
  fromIndex: number;
  startX: number;
  startY: number;
  grabX: number;
  width: number;
  height: number;
  originTop: number;
};

type Args = {
  ids: string[];
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onReorder: (nextIds: string[]) => void;
  onDragActiveChange?: (active: boolean) => void;
  onClickItem?: (id: string) => void;
};

/**
 * Horizontal shelf reorder:
 * - dragged card stays visible under the cursor
 * - others only open a single gap (no live swap thrash)
 * - order commits once on drop
 */
export function useShelfReorder({
  ids,
  scrollerRef,
  onReorder,
  onDragActiveChange,
  onClickItem,
}: Args) {
  const [drag, setDrag] = useState<ShelfDragState | null>(null);
  const dragRef = useRef<ShelfDragState | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  /** Document-space centers of non-dragged cards, frozen at drag start. */
  const centersRef = useRef<number[]>([]);
  const scrollBaseRef = useRef(0);

  const setDragBoth = useCallback(
    (next: ShelfDragState | null) => {
      dragRef.current = next;
      setDrag(next);
      onDragActiveChange?.(next !== null);
    },
    [onDragActiveChange],
  );

  const snapshotCenters = useCallback(
    (draggedId: string) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        centersRef.current = [];
        return;
      }
      scrollBaseRef.current = scroller.scrollLeft;
      const centers: number[] = [];
      for (const el of scroller.querySelectorAll<HTMLElement>("[data-clip-id]")) {
        if (el.dataset.clipId === draggedId) continue;
        const rect = el.getBoundingClientRect();
        // Scroll-invariant: viewport left + current scrollLeft
        centers.push(rect.left + rect.width / 2 + scroller.scrollLeft);
      }
      centersRef.current = centers;
    },
    [scrollerRef],
  );

  const computeInsertIndex = useCallback(
    (clientX: number) => {
      const scroller = scrollerRef.current;
      const scroll = scroller?.scrollLeft ?? scrollBaseRef.current;
      const pointer = clientX + scroll;
      const centers = centersRef.current;
      if (centers.length === 0) return 0;
      for (let i = 0; i < centers.length; i++) {
        if (pointer < centers[i]!) return i;
      }
      return centers.length;
    },
    [scrollerRef],
  );

  const onPointerDown = useCallback((e: React.PointerEvent, id: string, fromIndex: number) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    pendingRef.current = {
      id,
      fromIndex,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - rect.left,
      width: rect.width,
      height: rect.height,
      originTop: rect.top,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      const active = dragRef.current;

      if (!active && pending) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (dx * dx + dy * dy < ACTIVATE_PX * ACTIVATE_PX) return;

        snapshotCenters(pending.id);
        setDragBoth({
          id: pending.id,
          fromIndex: pending.fromIndex,
          insertIndex: computeInsertIndex(e.clientX),
          width: pending.width,
          height: pending.height,
          x: e.clientX - pending.grabX,
          y: pending.originTop,
          grabX: pending.grabX,
        });
        pendingRef.current = null;
        return;
      }

      if (!active) return;

      const next: ShelfDragState = {
        ...active,
        x: e.clientX - active.grabX,
        insertIndex: computeInsertIndex(e.clientX),
      };
      dragRef.current = next;
      setDrag(next);

      const scroller = scrollerRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const edge = 56;
        if (e.clientX < r.left + edge) scroller.scrollLeft -= 16;
        else if (e.clientX > r.right - edge) scroller.scrollLeft += 16;
      }
    };

    const onUp = (e: PointerEvent) => {
      const pending = pendingRef.current;
      const active = dragRef.current;
      pendingRef.current = null;

      if (!active) {
        if (pending && e.type === "pointerup") onClickItem?.(pending.id);
        return;
      }

      const from = active.fromIndex;
      const to = active.insertIndex;
      setDragBoth(null);
      centersRef.current = [];

      const original = idsRef.current;
      const next = [...original];
      const [item] = next.splice(from, 1);
      if (!item) return;
      next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
      if (next.every((id, i) => id === original[i])) return;
      onReorder(next);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [computeInsertIndex, onClickItem, onReorder, scrollerRef, setDragBoth, snapshotCenters]);

  useEffect(() => {
    if (!drag) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setDragBoth(null);
        pendingRef.current = null;
        centersRef.current = [];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag, setDragBoth]);

  return { drag, onPointerDown };
}

/** Items + a single gap where the drag will land (dragged id omitted from row). */
export function shelfSlots(
  ids: string[],
  drag: ShelfDragState | null,
): Array<{ type: "item"; id: string; index: number } | { type: "gap" }> {
  if (!drag) {
    return ids.map((id, index) => ({ type: "item" as const, id, index }));
  }

  const rest = ids.filter((id) => id !== drag.id);
  const insertAt = Math.max(0, Math.min(drag.insertIndex, rest.length));
  const slots: Array<{ type: "item"; id: string; index: number } | { type: "gap" }> = [];

  for (let i = 0; i <= rest.length; i++) {
    if (i === insertAt) slots.push({ type: "gap" });
    if (i < rest.length) {
      const id = rest[i]!;
      slots.push({ type: "item", id, index: ids.indexOf(id) });
    }
  }
  return slots;
}

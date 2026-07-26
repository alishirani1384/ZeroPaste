"use client";

import type { Pinboard } from "@paste/clipboard-core";
import { Palette, Pencil, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PinboardMenuAction = "rename" | "recolor" | "delete";

type Props = {
  x: number;
  y: number;
  board: Pinboard;
  onAction: (action: PinboardMenuAction) => void;
  onClose: () => void;
};

export function PinboardContextMenu({ x, y, board, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let left = Math.min(x, window.innerWidth - rect.width - pad);
    let top = y;
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, y - rect.height);
    }
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const run = (action: PinboardMenuAction) => {
    onAction(action);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="zp-ctx"
      role="menu"
      aria-label={`Pinboard “${board.name}”`}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="zp-ctx-label">{board.name}</div>
      <button type="button" role="menuitem" className="zp-ctx-item" onClick={() => run("rename")}>
        <Pencil className="size-3.5" aria-hidden />
        Rename…
      </button>
      <button type="button" role="menuitem" className="zp-ctx-item" onClick={() => run("recolor")}>
        <Palette className="size-3.5" aria-hidden />
        Change color…
      </button>
      <div className="zp-ctx-sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="zp-ctx-item zp-ctx-item--danger"
        onClick={() => run("delete")}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Delete pinboard
      </button>
    </div>,
    document.body,
  );
}

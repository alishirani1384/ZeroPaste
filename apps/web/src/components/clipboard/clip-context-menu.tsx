"use client";

import type { ClipItem, Pinboard } from "@paste/clipboard-core";
import { Check, ClipboardPaste, Copy, Eye, Plus, Trash2, Type } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ClipMenuAction =
  | "preview"
  | "paste"
  | "pastePlain"
  | "copy"
  | "delete"
  | "newPinboard"
  | { pin: string };

type Props = {
  x: number;
  y: number;
  clip: ClipItem;
  boards: Pinboard[];
  onAction: (action: ClipMenuAction) => void;
  onClose: () => void;
};

function canPastePlain(kind: ClipItem["kind"]) {
  return kind === "text" || kind === "link" || kind === "code" || kind === "other";
}

export function ClipContextMenu({ x, y, clip, boards, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const pinTargets = boards.filter((b) => b.id !== "history");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - pad);
    const top = Math.min(y, window.innerHeight - rect.height - pad);
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
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("wheel", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("wheel", onScroll, true);
    };
  }, [onClose]);

  const run = (action: ClipMenuAction) => {
    onAction(action);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="zp-ctx"
      role="menu"
      aria-label="Clip actions"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" className="zp-ctx-item" onClick={() => run("preview")}>
        <Eye className="size-3.5" aria-hidden />
        Preview
      </button>
      <button type="button" role="menuitem" className="zp-ctx-item" onClick={() => run("paste")}>
        <ClipboardPaste className="size-3.5" aria-hidden />
        Paste
      </button>
      {canPastePlain(clip.kind) ? (
        <button
          type="button"
          role="menuitem"
          className="zp-ctx-item"
          onClick={() => run("pastePlain")}
        >
          <Type className="size-3.5" aria-hidden />
          Paste as plain text
        </button>
      ) : null}
      <button type="button" role="menuitem" className="zp-ctx-item" onClick={() => run("copy")}>
        <Copy className="size-3.5" aria-hidden />
        Copy
      </button>

      <div className="zp-ctx-sep" role="separator" />
      <div className="zp-ctx-label">Pin to</div>
      {pinTargets.map((b) => {
        const pinned = clip.pinnedBoardIds.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            role="menuitem"
            className="zp-ctx-item"
            onClick={() => run({ pin: b.id })}
            disabled={pinned}
          >
            <span className="zp-ctx-pin-dot" style={{ background: b.color }} aria-hidden />
            <span className="zp-ctx-item-label">{b.name}</span>
            {pinned ? <Check className="size-3.5 zp-ctx-check" aria-label="Pinned" /> : null}
          </button>
        );
      })}
      <button
        type="button"
        role="menuitem"
        className="zp-ctx-item"
        onClick={() => run("newPinboard")}
      >
        <Plus className="size-3.5" aria-hidden />
        New pinboard…
      </button>

      <div className="zp-ctx-sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="zp-ctx-item zp-ctx-item--danger"
        onClick={() => run("delete")}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Delete
      </button>
    </div>,
    document.body,
  );
}

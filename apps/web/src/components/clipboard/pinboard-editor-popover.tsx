"use client";

import type { Pinboard } from "@paste/clipboard-core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { setDesktopKeyboardFocus } from "@/lib/bridge";

import { PINBOARD_COLORS, type NewPinboardAnchor } from "./new-pinboard-popover";

type Props = {
  board: Pinboard;
  /** When "recolor", focus the color row; name still editable. */
  focus?: "name" | "color";
  anchor: NewPinboardAnchor;
  onClose: () => void;
  onSave: (name: string, color: string) => void | Promise<void>;
};

export function PinboardEditorPopover({
  board,
  focus = "name",
  anchor,
  onClose,
  onSave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(board.name);
  const [color, setColor] = useState(board.color);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let left: number;
    let top: number;
    if (anchor.kind === "element") {
      left = anchor.rect.left;
      top = anchor.rect.bottom + 6;
      if (top + rect.height > window.innerHeight - pad) {
        top = anchor.rect.top - rect.height - 6;
      }
    } else {
      left = anchor.x;
      top = anchor.y;
    }
    left = Math.min(Math.max(pad, left), window.innerWidth - rect.width - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - rect.height - pad);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    void setDesktopKeyboardFocus(true);
    const t = window.setTimeout(() => {
      if (focus === "name") inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => {
      window.clearTimeout(t);
      void setDesktopKeyboardFocus(false);
    };
  }, [focus]);

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

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSave(trimmed, color);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      ref={ref}
      className="zp-pin-pop"
      role="dialog"
      aria-label="Edit pinboard"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="zp-pin-pop-head">
        <h3>Edit pinboard</h3>
        <p>Rename or pick a new color</p>
      </header>

      <label className="zp-pin-pop-field">
        <span>Name</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </label>

      <div className="zp-pin-pop-colors" role="listbox" aria-label="Color">
        {PINBOARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="option"
            aria-selected={color === c}
            className={color === c ? "zp-pin-swatch zp-pin-swatch--on" : "zp-pin-swatch"}
            style={{ background: c }}
            title={c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="zp-pin-pop-actions">
        <button type="button" className="zp-pin-pop-cancel" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="zp-pin-pop-create"
          disabled={busy || !name.trim()}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

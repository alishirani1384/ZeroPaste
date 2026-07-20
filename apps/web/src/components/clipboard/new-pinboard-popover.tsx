"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { setDesktopKeyboardFocus } from "@/lib/bridge";

export const PINBOARD_COLORS = [
  "#E85D4C",
  "#E8A838",
  "#4CAF7A",
  "#4A90A4",
  "#9B6B4A",
  "#7A7A7A",
  "#C75B39",
  "#5B7C99",
] as const;

export type NewPinboardAnchor =
  | { kind: "point"; x: number; y: number }
  | { kind: "element"; rect: DOMRect };

type Props = {
  anchor: NewPinboardAnchor;
  /** When set, the new board will pin this clip after create. */
  pinClipTitle?: string | null;
  onClose: () => void;
  onCreate: (name: string, color: string) => void | Promise<void>;
};

export function NewPinboardPopover({ anchor, pinClipTitle, onClose, onCreate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PINBOARD_COLORS[0]);
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
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      void setDesktopKeyboardFocus(false);
    };
  }, []);

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
      await onCreate(trimmed, color);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      ref={ref}
      className="zp-pin-pop"
      role="dialog"
      aria-label="New pinboard"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="zp-pin-pop-head">
        <h3>New pinboard</h3>
        {pinClipTitle ? (
          <p>
            Will pin <strong>{pinClipTitle}</strong>
          </p>
        ) : (
          <p>Group clips you want to keep handy</p>
        )}
      </header>

      <label className="zp-pin-pop-field">
        <span>Name</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Snippets, Links, Work"
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
          {busy ? "Creating…" : pinClipTitle ? "Create & pin" : "Create"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

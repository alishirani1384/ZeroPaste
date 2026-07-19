"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { formatRelativeTime } from "@paste/clipboard-core";
import { Code2, FileText, ImageIcon, Link2, Palette } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { cancelDragPaste, dragPaste } from "@/lib/bridge";

const kindIcon = {
  text: FileText,
  link: Link2,
  image: ImageIcon,
  code: Code2,
  file: FileText,
  color: Palette,
  other: FileText,
} as const;

type Props = {
  clip: ClipItem;
  index: number;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
  onPaste: () => void;
  onQuickLook: () => void;
  /** True while this card (or any) is in host drag-paste. */
  onDraggingChange: (dragging: boolean) => void;
};

const DRAG_THRESHOLD_SQ = 100;

export function ClipCard({
  clip,
  index,
  selected,
  compact,
  onSelect,
  onPaste,
  onQuickLook,
  onDraggingChange,
}: Props) {
  const Icon = kindIcon[clip.kind];
  const quick = index < 9 ? index + 1 : null;
  const [imgFailed, setImgFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imageSrc = clip.preview || clip.body;
  const rootRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);
  const modeRef = useRef<"idle" | "pending" | "drag">("idle");
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const dragSessionRef = useRef(0);

  const endDrag = () => {
    modeRef.current = "idle";
    downRef.current = null;
    setDragging(false);
    onDraggingChange(false);
  };

  const beginHostDragPaste = () => {
    const session = ++dragSessionRef.current;
    onDraggingChange(true);
    void dragPaste(clip.id).finally(() => {
      if (dragSessionRef.current === session) endDrag();
    });
  };

  useEffect(() => {
    return () => {
      if (modeRef.current === "drag") void cancelDragPaste();
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    modeRef.current = "pending";
    downRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!downRef.current || modeRef.current === "idle") return;
    const dx = e.clientX - downRef.current.x;
    const dy = e.clientY - downRef.current.y;

    if (modeRef.current === "pending" && dx * dx + dy * dy > DRAG_THRESHOLD_SQ) {
      modeRef.current = "drag";
      setDragging(true);
      lastClickRef.current = 0;
      onSelect();
      // No free-floating ghost — CEF can't leave the window and it gets stuck.
      // Host watches OS mouse-up and pastes on release (works over other apps).
      beginHostDragPaste();
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (modeRef.current === "drag") {
      // Host pastes on OS button release; just drop local pending state.
      // Don't endDrag here — wait for dragPaste() to finish so banner stays.
      downRef.current = null;
      return;
    }

    modeRef.current = "idle";
    downRef.current = null;

    const now = Date.now();
    onSelect();

    if (now - lastClickRef.current < 320) {
      lastClickRef.current = 0;
      onQuickLook();
      return;
    }

    lastClickRef.current = now;
    onPaste();
  };

  return (
    <div
      ref={rootRef}
      role="option"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (modeRef.current === "drag") void cancelDragPaste();
        endDrag();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect();
          onPaste();
        }
        if (e.key === " ") {
          e.preventDefault();
          onSelect();
          onQuickLook();
        }
      }}
      className={[
        "zp-card group relative flex shrink-0 flex-col overflow-hidden text-left outline-none transition-[transform,box-shadow,background,opacity] duration-200 ease-out cursor-grab active:cursor-grabbing touch-none select-none",
        compact ? "h-[148px] w-[132px]" : "h-[220px] w-[200px]",
        selected ? "zp-card--selected" : "",
        dragging ? "opacity-40 scale-[0.98]" : "",
      ].join(" ")}
      aria-selected={selected}
      title="Click to paste · drag then release to paste · double-click Quick Look"
    >
      {quick !== null ? <span className="zp-quick" aria-hidden>{`#${quick}`}</span> : null}

      <div className={["zp-card-preview", compact ? "min-h-0 flex-1" : "h-[132px]"].join(" ")}>
        {clip.kind === "image" ? (
          imgFailed || !imageSrc ? (
            <div className="zp-image-fallback">
              <ImageIcon className="size-8 opacity-40" />
              <span>Image</span>
              <span className="opacity-60">{Math.round(clip.byteSize / 1024)} KB</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imageSrc}
              src={imageSrc}
              alt=""
              className="h-full w-full object-cover pointer-events-none"
              draggable={false}
              onError={() => setImgFailed(true)}
              onLoad={() => setImgFailed(false)}
            />
          )
        ) : clip.kind === "color" ? (
          <div className="flex h-full w-full items-end p-3" style={{ background: clip.body }}>
            <span className="rounded bg-black/35 px-2 py-0.5 font-mono text-[11px] text-white">
              {clip.body}
            </span>
          </div>
        ) : clip.kind === "code" ? (
          <pre className="zp-code">{clip.preview}</pre>
        ) : clip.kind === "link" ? (
          <div className="flex h-full flex-col justify-between p-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--zp-link-wash)] text-[var(--zp-crimson)]">
              <Link2 className="size-4" />
            </div>
            <p className="line-clamp-3 text-[13px] leading-snug text-[var(--zp-ink)]">{clip.preview}</p>
          </div>
        ) : (
          <p className="zp-text-preview">{clip.preview}</p>
        )}
      </div>

      <div className="zp-card-meta">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 opacity-55" />
          <span className="truncate text-[12px] font-medium text-[var(--zp-ink)]">{clip.title}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--zp-muted)]">
          <span className="truncate">{clip.source.appName}</span>
          <span className="shrink-0 tabular-nums">{formatRelativeTime(clip.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

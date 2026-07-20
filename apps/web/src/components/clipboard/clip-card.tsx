"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { formatRelativeTime } from "@paste/clipboard-core";
import { Code2, FileText, ImageIcon, Link2, Palette } from "lucide-react";
import { useState, type PointerEvent as ReactPointerEvent } from "react";

const kindIcon = {
  text: FileText,
  link: Link2,
  image: ImageIcon,
  code: Code2,
  file: FileText,
  color: Palette,
  other: FileText,
} as const;

export function ClipCardFace({
  clip,
  index,
  compact,
  showIndex = true,
}: {
  clip: ClipItem;
  index: number;
  compact: boolean;
  showIndex?: boolean;
}) {
  const Icon = kindIcon[clip.kind];
  const quick = showIndex && index < 9 ? index + 1 : null;
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc = clip.preview || clip.body;

  return (
    <>
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
    </>
  );
}

type Props = {
  clip: ClipItem;
  index: number;
  selected: boolean;
  compact: boolean;
  sorting: boolean;
  onPointerDown: (e: ReactPointerEvent, id: string, index: number) => void;
  onSelect: () => void;
  onContextMenu: (clientX: number, clientY: number) => void;
};

export function ClipCard({
  clip,
  index,
  selected,
  compact,
  sorting,
  onPointerDown,
  onSelect,
  onContextMenu,
}: Props) {
  return (
    <div
      data-clip-id={clip.id}
      role="option"
      tabIndex={-1}
      onPointerDown={(e) => onPointerDown(e, clip.id, index)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        onContextMenu(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "zp-card group relative flex shrink-0 flex-col overflow-hidden text-left outline-none cursor-grab active:cursor-grabbing select-none touch-none",
        compact ? "h-[148px] w-[132px]" : "h-[220px] w-[200px]",
        selected && !sorting ? "zp-card--selected" : "",
      ].join(" ")}
      aria-selected={selected}
      title="Click to paste · drag to reorder · right-click for more"
    >
      <ClipCardFace clip={clip} index={index} compact={compact} showIndex={!sorting} />
    </div>
  );
}

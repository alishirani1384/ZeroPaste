"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { formatRelativeTime } from "@paste/clipboard-core";
import { Code2, FileText, ImageIcon, Link2, Palette } from "lucide-react";

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
  onActivate: () => void;
};

export function ClipCard({ clip, index, selected, compact, onSelect, onActivate }: Props) {
  const Icon = kindIcon[clip.kind];
  const quick = index < 9 ? index + 1 : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onActivate}
      className={[
        "zp-card group relative flex shrink-0 flex-col overflow-hidden text-left outline-none transition-[transform,box-shadow,background] duration-200 ease-out",
        compact ? "h-[148px] w-[132px]" : "h-[220px] w-[200px]",
        selected ? "zp-card--selected" : "",
      ].join(" ")}
      aria-selected={selected}
    >
      {quick !== null ? <span className="zp-quick" aria-hidden>{`#${quick}`}</span> : null}

      <div className={["zp-card-preview", compact ? "min-h-0 flex-1" : "h-[132px]"].join(" ")}>
        {clip.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.preview || clip.body} alt="" className="h-full w-full object-cover" />
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
    </button>
  );
}

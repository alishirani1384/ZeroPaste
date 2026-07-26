"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { contrastingInk, paintColorForNative } from "@paste/clipboard-core";
import { Cloud, CloudOff, Smartphone } from "lucide-react";
import { useState, type PointerEvent as ReactPointerEvent } from "react";

import { CodeHighlight } from "@/components/clipboard/code-highlight";
import { useSyncStatus } from "@/components/vault/sync-status";
import { useLinkPreview } from "@/hooks/use-link-preview";
import { useAuth } from "@/lib/auth-session";
import {
  TYPE_ICON_SRC,
  characterCountLabel,
  detectCodeLanguage,
  imageSizeLabel,
  kindChrome,
  linkPathLabel,
  pasteRelativeTime,
} from "@/lib/clip-card-meta";

function cloudBadgeFor(
  phase: string,
  offline: boolean,
  signedIn: boolean,
): "synced" | "local_only" | "pending" {
  if (offline || !signedIn) return "local_only";
  if (phase === "synced") return "synced";
  return "pending";
}

function CloudBadge({
  badge,
  onDark,
}: {
  badge: "synced" | "local_only" | "pending";
  onDark?: boolean;
}) {
  const Icon = badge === "synced" ? Cloud : badge === "local_only" ? Smartphone : CloudOff;
  const color =
    badge === "synced"
      ? "#34C759"
      : badge === "local_only"
        ? "#FF9F0A"
        : onDark
          ? "rgba(255,255,255,0.7)"
          : "#8E8E93";

  return (
    <div
      className={["zp-mcard-cloud", onDark ? "zp-mcard-cloud--dark" : "zp-mcard-cloud--light"].join(
        " ",
      )}
      aria-hidden
    >
      <Icon className="size-3.5" style={{ color }} strokeWidth={2.25} />
    </div>
  );
}

function KindTypeIcon({ kind }: { kind: ClipItem["kind"] }) {
  const src = TYPE_ICON_SRC[kind] ?? TYPE_ICON_SRC.text!;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="zp-mcard-type" src={src} alt="" draggable={false} />
  );
}

function LinkBody({ clip }: { clip: ClipItem }) {
  const { preview } = useLinkPreview(clip.body, true);
  const title = preview?.title?.trim() || clip.title;
  const image = preview?.image;
  const path = linkPathLabel(clip.body);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="zp-mcard-link">
      {image && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="zp-mcard-link-image"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="zp-mcard-link-fallback">
          <span>{path}</span>
        </div>
      )}
      <div className="zp-mcard-link-foot">
        <p className="zp-mcard-link-title">{title}</p>
        <p className="zp-mcard-link-url">{path}</p>
      </div>
    </div>
  );
}

function TextBody({ clip }: { clip: ClipItem }) {
  const body = clip.body || clip.preview || "";
  return (
    <div className="zp-mcard-text">
      <div className="zp-mcard-text-pad">
        <p className="zp-mcard-text-content">{body}</p>
        <div className="zp-mcard-text-fade" aria-hidden />
      </div>
      <p className="zp-mcard-chars">{characterCountLabel(body)}</p>
    </div>
  );
}

function ImageBody({ clip }: { clip: ClipItem }) {
  const [failed, setFailed] = useState(false);
  const src = clip.preview || clip.body;
  const label = imageSizeLabel(clip.imageWidth, clip.imageHeight);

  return (
    <div className="zp-mcard-image">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="zp-mcard-image-fill"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="zp-mcard-image-missing">Image</div>
      )}
      {label ? (
        <div className="zp-mcard-size-wrap">
          <span className="zp-mcard-size">{label}</span>
        </div>
      ) : null}
    </div>
  );
}

function CodeBody({ clip }: { clip: ClipItem }) {
  const code = clip.body || clip.preview || "";
  const { label } = detectCodeLanguage(code, clip.language);
  return (
    <div className="zp-mcard-code">
      <CodeHighlight code={code} language={clip.language} maxLines={9} className="zp-mcard-code-pad" />
      <p className="zp-mcard-lang">{label}</p>
    </div>
  );
}

function ColorBody({ clip }: { clip: ClipItem }) {
  const raw = (clip.body || clip.preview || "").trim();
  const paint = paintColorForNative(raw);
  const ink = paint ? contrastingInk(paint) : "#1C1C1E";

  return (
    <div
      className={["zp-mcard-color", paint ? "" : "zp-mcard-color--fallback"].join(" ")}
      style={paint ? { backgroundColor: paint } : undefined}
    >
      <span
        className="zp-mcard-color-label"
        style={{
          color: ink,
          backgroundColor: paint ? "rgba(0,0,0,0.22)" : "transparent",
        }}
      >
        {raw}
      </span>
    </div>
  );
}

function FileBody({ clip }: { clip: ClipItem }) {
  return (
    <div className="zp-mcard-file">
      <p className="zp-mcard-file-title">{clip.title || clip.preview}</p>
    </div>
  );
}

/** Visual face — used by shelf cards and the drag ghost. */
export function ClipCardFace({
  clip,
  compact,
}: {
  clip: ClipItem;
  compact: boolean;
}) {
  const chrome = kindChrome(clip.kind);
  const when = pasteRelativeTime(clip.createdAt);
  const auth = useAuth();
  const { phase } = useSyncStatus();
  const badge = cloudBadgeFor(
    phase,
    auth.offlineChosen || !auth.configured,
    Boolean(auth.session),
  );
  const onDark = clip.kind === "image" || clip.kind === "code" || clip.kind === "color";

  return (
    <div className={["zp-mcard-face", compact ? "zp-mcard-face--compact" : ""].join(" ")}>
      <div className="zp-mcard-header" style={{ backgroundColor: chrome.header }}>
        <div className="zp-mcard-header-text">
          <span className="zp-mcard-kind">{chrome.label}</span>
          <span className="zp-mcard-when">{when}</span>
        </div>
        <div className="zp-mcard-type-wrap">
          <KindTypeIcon kind={clip.kind} />
        </div>
      </div>

      <div className="zp-mcard-body">
        {clip.kind === "link" ? <LinkBody clip={clip} /> : null}
        {clip.kind === "text" || clip.kind === "other" ? <TextBody clip={clip} /> : null}
        {clip.kind === "image" ? <ImageBody clip={clip} /> : null}
        {clip.kind === "code" ? <CodeBody clip={clip} /> : null}
        {clip.kind === "color" ? <ColorBody clip={clip} /> : null}
        {clip.kind === "file" ? <FileBody clip={clip} /> : null}
        <CloudBadge badge={badge} onDark={onDark} />
      </div>
    </div>
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
        "zp-mcard",
        compact ? "zp-mcard--compact" : "",
        selected && !sorting ? "zp-mcard--selected" : "",
      ].join(" ")}
      aria-selected={selected}
      title="Click to paste · drag to reorder · right-click for more"
    >
      <ClipCardFace clip={clip} compact={compact} />
    </div>
  );
}

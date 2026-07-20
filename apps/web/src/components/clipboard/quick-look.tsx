"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { formatByteSize, formatRelativeTime } from "@paste/clipboard-core";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { setDesktopKeyboardFocus } from "@/lib/bridge";

type Props = {
  clip: ClipItem;
  onClose: () => void;
  onSave?: (body: string) => Promise<boolean> | boolean;
};

function isEditableKind(kind: ClipItem["kind"]) {
  return kind === "text" || kind === "link" || kind === "code" || kind === "other";
}

export function QuickLook({ clip, onClose, onSave }: Props) {
  const editable = isEditableKind(clip.kind);
  const [draft, setDraft] = useState(clip.body);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dirty = editable && draft !== clip.body;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setDraft(clip.body);
  }, [clip.id, clip.body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (dirty && !window.confirm("Discard unsaved changes?")) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirty]);

  const save = async () => {
    if (!onSave || !dirty) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  // Portal to body so the modal covers the full Electrobun window (1280×560),
  // not only the 320px shelf strip.
  return createPortal(
    <div className="zp-ql" role="dialog" aria-modal="true" aria-label="Quick Look">
      <button
        type="button"
        className="zp-ql-backdrop"
        aria-label="Close preview"
        onClick={() => {
          if (dirty && !window.confirm("Discard unsaved changes?")) return;
          onClose();
        }}
      />
      <div className="zp-ql-sheet">
        <header className="zp-ql-head">
          <div className="min-w-0">
            <h2>{clip.title}</h2>
            <p>
              {clip.kind} · {clip.source.appName} · {formatRelativeTime(clip.createdAt)} ·{" "}
              {formatByteSize(clip.byteSize)}
            </p>
          </div>
          <button
            type="button"
            className="zp-icon-btn"
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes?")) return;
              onClose();
            }}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="zp-ql-body">
          {clip.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.preview || clip.body} alt="" className="zp-ql-image" />
          ) : clip.kind === "color" ? (
            <div className="zp-ql-color" style={{ background: clip.body }}>
              <span>{clip.body}</span>
            </div>
          ) : editable ? (
            <textarea
              className={clip.kind === "code" ? "zp-ql-editor zp-ql-editor--code" : "zp-ql-editor"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={clip.kind !== "code"}
              aria-label="Edit clip"
              onFocus={() => void setDesktopKeyboardFocus(true)}
              onBlur={() => void setDesktopKeyboardFocus(false)}
            />
          ) : (
            <p className="zp-ql-text">{clip.body}</p>
          )}
        </div>

        <dl className="zp-ql-meta">
          <div>
            <dt>App</dt>
            <dd>{clip.source.appName}</dd>
          </div>
          {clip.source.windowTitle && clip.source.windowTitle !== clip.source.appName ? (
            <div>
              <dt>Window</dt>
              <dd>{clip.source.windowTitle}</dd>
            </div>
          ) : null}
          <div>
            <dt>Device</dt>
            <dd>
              {clip.source.deviceName} ({clip.source.devicePlatform})
            </dd>
          </div>
          <div>
            <dt>Copied</dt>
            <dd>{new Date(clip.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>MIME</dt>
            <dd>{clip.mimeType}</dd>
          </div>
        </dl>

        <footer className="zp-ql-foot">
          <div className="zp-ql-foot-actions">
            {editable ? (
              <button
                type="button"
                className="zp-gate-primary"
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            ) : (
              <span className="zp-ql-hint">Preview only — click a card to paste</span>
            )}
          </div>
          <span className="zp-ql-hint">
            <kbd>Esc</kbd> close · click card to paste
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

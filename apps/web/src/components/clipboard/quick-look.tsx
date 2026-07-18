"use client";

import type { ClipItem } from "@paste/clipboard-core";
import { formatByteSize, formatRelativeTime } from "@paste/clipboard-core";
import { X } from "lucide-react";

type Props = {
  clip: ClipItem;
  onClose: () => void;
  onPaste: () => void;
};

export function QuickLook({ clip, onClose, onPaste }: Props) {
  return (
    <div className="zp-ql" role="dialog" aria-label="Quick Look">
      <div className="zp-ql-backdrop" onClick={onClose} />
      <div className="zp-ql-sheet">
        <header className="zp-ql-head">
          <div>
            <h2>{clip.title}</h2>
            <p>
              {clip.kind} · {clip.source.appName} · {formatRelativeTime(clip.createdAt)} ·{" "}
              {formatByteSize(clip.byteSize)}
            </p>
          </div>
          <button type="button" className="zp-icon-btn" onClick={onClose} aria-label="Close">
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
          ) : clip.kind === "code" ? (
            <pre className="zp-ql-code">{clip.body}</pre>
          ) : (
            <p className="zp-ql-text">{clip.body}</p>
          )}
        </div>

        <dl className="zp-ql-meta">
          <div>
            <dt>Source</dt>
            <dd>{clip.source.appName}</dd>
          </div>
          <div>
            <dt>Device</dt>
            <dd>
              {clip.source.deviceName} ({clip.source.devicePlatform})
            </dd>
          </div>
          {clip.source.windowTitle ? (
            <div>
              <dt>Window</dt>
              <dd>{clip.source.windowTitle}</dd>
            </div>
          ) : null}
          {clip.source.url ? (
            <div>
              <dt>URL</dt>
              <dd>{clip.source.url}</dd>
            </div>
          ) : null}
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
          <button type="button" className="zp-gate-primary" onClick={onPaste}>
            Paste
          </button>
          <span className="zp-ql-hint">
            <kbd>Space</kbd> toggle · <kbd>Esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
}

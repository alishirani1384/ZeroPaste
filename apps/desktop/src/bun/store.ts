import {
  SEED_CLIPS,
  SEED_PINBOARDS,
  type ClipItem,
  type Pinboard,
} from "@paste/clipboard-core";

export type DesktopState = {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
};

const listeners = new Set<(state: DesktopState) => void>();

let state: DesktopState = {
  clips: [...SEED_CLIPS],
  pinboards: [...SEED_PINBOARDS],
  pausedUntil: null,
  compact: false,
};

export function getState(): DesktopState {
  return state;
}

export function subscribe(fn: (state: DesktopState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function isPaused(): boolean {
  return state.pausedUntil !== null && Date.now() < state.pausedUntil;
}

/** Ignore clipboard changes we caused ourselves (paste write → would bump card to #1). */
let suppressCaptureUntil = 0;

export function suppressCapture(ms = 2000) {
  suppressCaptureUntil = Date.now() + ms;
}

export function isCaptureSuppressed(): boolean {
  return Date.now() < suppressCaptureUntil;
}

/** Keep poller fingerprint in sync after we write the OS clipboard. */
let externalFingerprint: string | null = null;

export function noteClipboardFingerprint(
  formats: string[],
  text: string | null,
  imageLen: number,
) {
  externalFingerprint = `${formats.sort().join(",")}|${text?.slice(0, 2000) ?? ""}|img:${imageLen}`;
}

export function takeExternalFingerprint(): string | null {
  const v = externalFingerprint;
  externalFingerprint = null;
  return v;
}

export function setPaused(durationMs: number | null) {
  state = {
    ...state,
    pausedUntil: durationMs === null ? null : Date.now() + durationMs,
  };
  emit();
}

export function setCompact(compact: boolean) {
  state = { ...state, compact };
  emit();
}

export function upsertClip(clip: ClipItem) {
  const existing = state.clips.findIndex(
    (c) => c.contentHash === clip.contentHash && !c.deletedAt,
  );
  if (existing >= 0) {
    // Refresh recency for duplicate copy
    const prev = state.clips[existing]!;
    const updated: ClipItem = {
      ...prev,
      createdAt: clip.createdAt,
      updatedAt: clip.createdAt,
      source: clip.source,
    };
    const rest = state.clips.filter((_, i) => i !== existing);
    state = { ...state, clips: [updated, ...rest] };
  } else {
    state = { ...state, clips: [clip, ...state.clips] };
  }
  emit();
}

export function removeClip(id: string) {
  const now = new Date().toISOString();
  state = {
    ...state,
    clips: state.clips.map((c) =>
      c.id === id ? { ...c, deletedAt: now, updatedAt: now } : c,
    ),
  };
  emit();
}

/** Update editable clip body (text / link / code) from Quick Look. */
export function updateClipBody(id: string, body: string) {
  const now = new Date().toISOString();
  const clip = state.clips.find((c) => c.id === id && !c.deletedAt);
  if (!clip) return false;
  if (clip.kind === "image" || clip.kind === "color") return false;

  const preview = body.length > 280 ? `${body.slice(0, 277)}…` : body;
  const title =
    body
      .trim()
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.slice(0, 80) || clip.title;

  state = {
    ...state,
    clips: state.clips.map((c) =>
      c.id === id
        ? {
            ...c,
            body,
            preview,
            title,
            byteSize: new TextEncoder().encode(body).byteLength,
            updatedAt: now,
          }
        : c,
    ),
  };
  emit();
  return true;
}

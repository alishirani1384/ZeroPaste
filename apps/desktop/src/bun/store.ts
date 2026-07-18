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

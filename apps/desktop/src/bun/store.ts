import { contentHash, type ClipItem, type Pinboard } from "@paste/clipboard-core";

import { loadPersistedState, removePersistedMedia, schedulePersist } from "./persist";

export type DesktopState = {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
  /** When false, clipboard poller skips capture (vault locked). */
  captureEnabled: boolean;
  /** Non-fatal host issues shown in the UI (hotkey/tray failures, Linux paste tools). */
  hostWarnings: string[];
};

const listeners = new Set<(state: DesktopState) => void>();

let state: DesktopState = {
  clips: [],
  pinboards: [
    {
      id: "history",
      name: "History",
      color: "#888888",
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    },
  ],
  pausedUntil: null,
  compact: false,
  captureEnabled: false,
  hostWarnings: [],
};

let hydrated = false;

export async function hydrateStoreFromDisk() {
  if (hydrated) return;
  hydrated = true;
  const saved = await loadPersistedState();
  if (!saved) {
    console.log("[ZeroPaste] no persisted history — starting empty");
    return;
  }
  state = {
    ...state,
    clips: saved.clips,
    pinboards: saved.pinboards.length > 0 ? saved.pinboards : state.pinboards,
    pausedUntil: saved.pausedUntil,
    compact: saved.compact,
  };
  console.log("[ZeroPaste] restored history", {
    clips: state.clips.filter((c) => !c.deletedAt).length,
    pinboards: state.pinboards.length,
  });
  emit();
}

export function getState(): DesktopState {
  return state;
}

export function subscribe(fn: (state: DesktopState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
  schedulePersist(state);
}

export function isPaused(): boolean {
  return state.pausedUntil !== null && Date.now() < state.pausedUntil;
}

let suppressCaptureUntil = 0;

export function suppressCapture(ms = 2000) {
  suppressCaptureUntil = Date.now() + ms;
}

export function isCaptureSuppressed(): boolean {
  return Date.now() < suppressCaptureUntil;
}

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

export function setCaptureEnabled(enabled: boolean) {
  state = { ...state, captureEnabled: enabled };
  emit();
}

export function setHostWarnings(warnings: string[]) {
  state = { ...state, hostWarnings: warnings };
  emit();
}

export function addHostWarning(warning: string) {
  if (state.hostWarnings.includes(warning)) return;
  state = { ...state, hostWarnings: [...state.hostWarnings, warning] };
  emit();
}

export function upsertClip(clip: ClipItem) {
  const existing = state.clips.findIndex(
    (c) => c.contentHash === clip.contentHash && !c.deletedAt,
  );
  if (existing >= 0) {
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

/** Merge a cloud/local clip by id (pull / realtime / edit). */
export function mergeClip(clip: ClipItem) {
  const idx = state.clips.findIndex((c) => c.id === clip.id);
  if (idx < 0) {
    state = { ...state, clips: [clip, ...state.clips] };
  } else {
    const prev = state.clips[idx]!;
    const prefer =
      new Date(clip.updatedAt).getTime() >= new Date(prev.updatedAt).getTime() ? clip : prev;
    const next = state.clips.slice();
    next[idx] = prefer;
    // Preserve shelf manual order — do not re-sort by updatedAt.
    state = { ...state, clips: next };
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
  void removePersistedMedia(id);
  emit();
}

export async function updateClipBody(id: string, body: string) {
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

  const hash = await contentHash(body);
  state = {
    ...state,
    clips: state.clips.map((c) =>
      c.id === id
        ? {
            ...c,
            body,
            preview,
            title,
            contentHash: hash,
            byteSize: new TextEncoder().encode(body).byteLength,
            updatedAt: now,
          }
        : c,
    ),
  };
  emit();
  return true;
}

export function createPinboard(name: string, color = "#E85D4C"): Pinboard {
  const board: Pinboard = {
    id: crypto.randomUUID(),
    name: name.trim() || "Pinboard",
    color,
    createdAt: new Date().toISOString(),
    sortOrder: state.pinboards.length,
  };
  state = { ...state, pinboards: [...state.pinboards, board] };
  emit();
  return board;
}

export function pinClipToBoard(clipId: string, boardId: string) {
  state = {
    ...state,
    clips: state.clips.map((c) => {
      if (c.id !== clipId || c.deletedAt) return c;
      if (c.pinnedBoardIds.includes(boardId)) return c;
      return {
        ...c,
        pinnedBoardIds: [...c.pinnedBoardIds, boardId],
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  emit();
}

/**
 * Reorder shelf clips. `visibleOrderedIds` is the new order of the currently
 * visible subset; other live clips keep their relative slots.
 */
export function reorderClips(visibleOrderedIds: string[]) {
  if (visibleOrderedIds.length === 0) return;
  const visibleSet = new Set(visibleOrderedIds);
  const byId = new Map(state.clips.map((c) => [c.id, c]));
  for (const id of visibleOrderedIds) {
    if (!byId.has(id)) return;
  }

  const live = state.clips.filter((c) => !c.deletedAt);
  const deleted = state.clips.filter((c) => c.deletedAt);
  let vi = 0;
  const reorderedLive = live.map((c) => {
    if (!visibleSet.has(c.id)) return c;
    const id = visibleOrderedIds[vi++]!;
    return byId.get(id)!;
  });

  state = { ...state, clips: [...reorderedLive, ...deleted] };
  emit();
}

export function replaceClipsFromCloud(clips: ClipItem[]) {
  const byId = new Map(state.clips.map((c) => [c.id, c]));
  for (const clip of clips) {
    const prev = byId.get(clip.id);
    if (!prev || new Date(clip.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      byId.set(clip.id, clip);
    }
  }
  const merged = [...byId.values()].sort((a, b) => {
    const ad = a.deletedAt ? 1 : 0;
    const bd = b.deletedAt ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  state = { ...state, clips: merged };
  emit();
}

/** Merge cloud pinboards; always keep the local History board. */
export function replacePinboardsFromCloud(boards: Pinboard[]) {
  const history =
    state.pinboards.find((b) => b.id === "history") ??
    ({
      id: "history",
      name: "History",
      color: "#888888",
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    } satisfies Pinboard);

  const byId = new Map<string, Pinboard>();
  byId.set("history", history);
  for (const board of state.pinboards) {
    if (board.id !== "history") byId.set(board.id, board);
  }
  for (const board of boards) {
    if (board.id === "history") continue;
    byId.set(board.id, board);
  }

  const merged = [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  state = { ...state, pinboards: merged };
  emit();
}

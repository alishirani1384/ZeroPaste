/**
 * Persist clipboard history + pinboards + media across restarts.
 * Path: ~/.zeropaste/desktop-state.json (+ media/)
 */

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ClipItem, Pinboard } from "@paste/clipboard-core";

import { mediaUrlFor, putClipMedia, getClipMedia } from "./media-store";

const ROOT = join(homedir(), ".zeropaste");
const STATE_FILE = join(ROOT, "desktop-state.json");
const MEDIA_DIR = join(ROOT, "media");

type PersistedState = {
  version: 1;
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureDirs() {
  await mkdir(MEDIA_DIR, { recursive: true });
}

export async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    await ensureDirs();
    const raw = await readFile(STATE_FILE, "utf8");
    const data = JSON.parse(raw) as PersistedState;
    if (data.version !== 1 || !Array.isArray(data.clips)) return null;

    // Rehydrate image media from disk and rewrite preview URLs for this session.
    for (const clip of data.clips) {
      if (clip.kind !== "image" || clip.deletedAt) continue;
      try {
        const metaRaw = await readFile(join(MEDIA_DIR, `${clip.id}.json`), "utf8");
        const meta = JSON.parse(metaRaw) as { mime: string };
        const bytes = new Uint8Array(await readFile(join(MEDIA_DIR, `${clip.id}.bin`)));
        putClipMedia(clip.id, bytes, meta.mime, bytes);
        const url = mediaUrlFor(clip.id);
        clip.preview = url;
        clip.body = url;
      } catch {
        /* media missing — clip may fail paste */
      }
    }
    return data;
  } catch {
    return null;
  }
}

export function schedulePersist(state: {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
}) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persistNow(state);
  }, 400);
}

export async function persistNow(state: {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
}) {
  try {
    await ensureDirs();
    const payload: PersistedState = {
      version: 1,
      clips: state.clips,
      pinboards: state.pinboards,
      pausedUntil: state.pausedUntil,
      compact: state.compact,
    };
    await writeFile(STATE_FILE, JSON.stringify(payload), "utf8");

    for (const clip of state.clips) {
      if (clip.kind !== "image" || clip.deletedAt) continue;
      const media = getClipMedia(clip.id);
      if (!media) continue;
      await writeFile(join(MEDIA_DIR, `${clip.id}.bin`), media.display);
      await writeFile(
        join(MEDIA_DIR, `${clip.id}.json`),
        JSON.stringify({ mime: media.displayMime }),
        "utf8",
      );
    }
  } catch (err) {
    console.warn("[ZeroPaste] persist failed", err);
  }
}

export async function removePersistedMedia(id: string) {
  try {
    await unlink(join(MEDIA_DIR, `${id}.bin`));
    await unlink(join(MEDIA_DIR, `${id}.json`));
  } catch {
    /* ignore */
  }
}

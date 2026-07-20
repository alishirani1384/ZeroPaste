import type { ClipItem, Pinboard } from "@paste/clipboard-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { readJson, writeJson } from "@/lib/rn-storage";

const CLIPS_KEY = "zeropaste.clips";
const BOARDS_KEY = "zeropaste.pinboards";

type ClipStoreValue = {
  ready: boolean;
  clips: ClipItem[];
  pinboards: Pinboard[];
  upsertClip: (clip: ClipItem) => void;
  upsertClips: (clips: ClipItem[]) => void;
  softDeleteClip: (id: string) => void;
  updateClip: (id: string, patch: Partial<ClipItem>) => void;
  setPinboards: (boards: Pinboard[]) => void;
  upsertPinboard: (board: Pinboard) => void;
  pinClipToBoard: (clipId: string, boardId: string) => void;
};

const ClipStoreContext = createContext<ClipStoreValue | null>(null);

function mergeClips(existing: ClipItem[], incoming: ClipItem[]): ClipItem[] {
  const map = new Map(existing.map((c) => [c.id, c]));
  for (const clip of incoming) {
    const prev = map.get(clip.id);
    if (!prev) {
      map.set(clip.id, clip);
      continue;
    }
    if (new Date(clip.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      map.set(clip.id, clip);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function ClipStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [pinboards, setPinboardsState] = useState<Pinboard[]>([]);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedClips, storedBoards] = await Promise.all([
        readJson<ClipItem[]>(CLIPS_KEY),
        readJson<Pinboard[]>(BOARDS_KEY),
      ]);
      if (cancelled) return;
      if (storedClips?.length) setClips(storedClips);
      if (storedBoards?.length) setPinboardsState(storedBoards);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schedulePersist = useCallback((nextClips: ClipItem[], nextBoards: Pinboard[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void writeJson(CLIPS_KEY, nextClips);
      void writeJson(BOARDS_KEY, nextBoards);
    }, 200);
  }, []);

  const upsertClip = useCallback(
    (clip: ClipItem) => {
      setClips((prev) => {
        const next = mergeClips(prev, [clip]);
        schedulePersist(next, pinboards);
        return next;
      });
    },
    [pinboards, schedulePersist],
  );

  const upsertClips = useCallback(
    (incoming: ClipItem[]) => {
      setClips((prev) => {
        const next = mergeClips(prev, incoming);
        schedulePersist(next, pinboards);
        return next;
      });
    },
    [pinboards, schedulePersist],
  );

  const softDeleteClip = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setClips((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, deletedAt: now, updatedAt: now } : c,
        );
        schedulePersist(next, pinboards);
        return next;
      });
    },
    [pinboards, schedulePersist],
  );

  const updateClip = useCallback(
    (id: string, patch: Partial<ClipItem>) => {
      setClips((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
        );
        schedulePersist(next, pinboards);
        return next;
      });
    },
    [pinboards, schedulePersist],
  );

  const setPinboards = useCallback(
    (boards: Pinboard[]) => {
      setPinboardsState(boards);
      schedulePersist(clips, boards);
    },
    [clips, schedulePersist],
  );

  const upsertPinboard = useCallback(
    (board: Pinboard) => {
      setPinboardsState((prev) => {
        const next = [...prev.filter((b) => b.id !== board.id), board].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        schedulePersist(clips, next);
        return next;
      });
    },
    [clips, schedulePersist],
  );

  const pinClipToBoard = useCallback(
    (clipId: string, boardId: string) => {
      setClips((prev) => {
        const next = prev.map((c) => {
          if (c.id !== clipId) return c;
          const pinned = Array.from(new Set([...(c.pinnedBoardIds ?? []), boardId]));
          return { ...c, pinnedBoardIds: pinned, updatedAt: new Date().toISOString() };
        });
        schedulePersist(next, pinboards);
        return next;
      });
    },
    [pinboards, schedulePersist],
  );

  const value = useMemo(
    () => ({
      ready,
      clips,
      pinboards,
      upsertClip,
      upsertClips,
      softDeleteClip,
      updateClip,
      setPinboards,
      upsertPinboard,
      pinClipToBoard,
    }),
    [
      ready,
      clips,
      pinboards,
      upsertClip,
      upsertClips,
      softDeleteClip,
      updateClip,
      setPinboards,
      upsertPinboard,
      pinClipToBoard,
    ],
  );

  return <ClipStoreContext.Provider value={value}>{children}</ClipStoreContext.Provider>;
}

export function useClipStore() {
  const ctx = useContext(ClipStoreContext);
  if (!ctx) throw new Error("useClipStore must be used within ClipStoreProvider");
  return ctx;
}

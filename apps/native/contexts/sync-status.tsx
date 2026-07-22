import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CloudSyncPhase = "idle" | "pulling" | "synced" | "error" | "unsigned" | "offline";

/** Per-clip cloud presence for card badges. */
export type ClipCloudBadge = "synced" | "unsynced" | "local_only";

type SyncStatusContextValue = {
  phase: CloudSyncPhase;
  detail?: string;
  setPhase: (phase: CloudSyncPhase, detail?: string) => void;
  /** clipId → badge; missing id treated as unsynced when signed-in sync is active */
  clipBadge: ReadonlyMap<string, ClipCloudBadge>;
  markClipSynced: (id: string) => void;
  markClipLocalOnly: (id: string) => void;
  markClipsSynced: (ids: string[]) => void;
  clearClipBadges: () => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<CloudSyncPhase>("idle");
  const [detail, setDetail] = useState<string | undefined>();
  const [clipBadge, setClipBadge] = useState<Map<string, ClipCloudBadge>>(() => new Map());

  const setPhase = useCallback((next: CloudSyncPhase, nextDetail?: string) => {
    setPhaseState(next);
    setDetail(nextDetail);
  }, []);

  const markClipSynced = useCallback((id: string) => {
    setClipBadge((prev) => {
      if (prev.get(id) === "synced") return prev;
      const next = new Map(prev);
      next.set(id, "synced");
      return next;
    });
  }, []);

  const markClipLocalOnly = useCallback((id: string) => {
    setClipBadge((prev) => {
      if (prev.get(id) === "local_only") return prev;
      const next = new Map(prev);
      next.set(id, "local_only");
      return next;
    });
  }, []);

  const markClipsSynced = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setClipBadge((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of ids) {
        if (next.get(id) === "synced") continue;
        next.set(id, "synced");
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const clearClipBadges = useCallback(() => {
    setClipBadge(new Map());
  }, []);

  const value = useMemo(
    () => ({
      phase,
      detail,
      setPhase,
      clipBadge,
      markClipSynced,
      markClipLocalOnly,
      markClipsSynced,
      clearClipBadges,
    }),
    [
      phase,
      detail,
      setPhase,
      clipBadge,
      markClipSynced,
      markClipLocalOnly,
      markClipsSynced,
      clearClipBadges,
    ],
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error("useSyncStatus must be used within SyncStatusProvider");
  return ctx;
}

export function clipCloudBadgeFor(
  clipBadge: ReadonlyMap<string, ClipCloudBadge>,
  clipId: string,
  phase: CloudSyncPhase,
): ClipCloudBadge {
  const known = clipBadge.get(clipId);
  if (known) return known;
  // Offline / unsigned — nothing is in the cloud from this session's POV.
  if (phase === "offline" || phase === "unsigned" || phase === "idle") return "unsynced";
  return "unsynced";
}

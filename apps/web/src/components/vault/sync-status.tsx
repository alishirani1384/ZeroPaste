"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CloudSyncPhase = "idle" | "pulling" | "synced" | "error" | "unsigned" | "offline";

type RefreshHandler = () => Promise<void>;

type SyncStatusContextValue = {
  phase: CloudSyncPhase;
  detail?: string;
  setPhase: (phase: CloudSyncPhase, detail?: string) => void;
  /** Pull encrypted clips/pinboards from the cloud (manual refresh). */
  refreshFromCloud: () => Promise<void>;
  /** CloudSync registers the real pull implementation here. */
  registerRefreshHandler: (handler: RefreshHandler | null) => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue>({
  phase: "idle",
  setPhase: () => {},
  refreshFromCloud: async () => {},
  registerRefreshHandler: () => {},
});

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<CloudSyncPhase>("idle");
  const [detail, setDetail] = useState<string | undefined>();
  const handlerRef = useRef<RefreshHandler | null>(null);

  const setPhase = useCallback((next: CloudSyncPhase, nextDetail?: string) => {
    setPhaseState(next);
    setDetail(nextDetail);
  }, []);

  const registerRefreshHandler = useCallback((handler: RefreshHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const refreshFromCloud = useCallback(async () => {
    const fn = handlerRef.current;
    if (!fn) return;
    await fn();
  }, []);

  const value = useMemo(
    () => ({ phase, detail, setPhase, refreshFromCloud, registerRefreshHandler }),
    [phase, detail, setPhase, refreshFromCloud, registerRefreshHandler],
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  return useContext(SyncStatusContext);
}

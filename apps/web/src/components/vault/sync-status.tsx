"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type CloudSyncPhase = "idle" | "pulling" | "synced" | "error" | "unsigned" | "offline";

type SyncStatusContextValue = {
  phase: CloudSyncPhase;
  detail?: string;
  setPhase: (phase: CloudSyncPhase, detail?: string) => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue>({
  phase: "idle",
  setPhase: () => {},
});

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<CloudSyncPhase>("idle");
  const [detail, setDetail] = useState<string | undefined>();

  const setPhase = useCallback((next: CloudSyncPhase, nextDetail?: string) => {
    setPhaseState(next);
    setDetail(nextDetail);
  }, []);

  const value = useMemo(() => ({ phase, detail, setPhase }), [phase, detail, setPhase]);

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  return useContext(SyncStatusContext);
}

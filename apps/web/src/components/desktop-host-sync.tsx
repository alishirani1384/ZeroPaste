"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const BRIDGE = "http://127.0.0.1:47821";

/** Proves the Electrobun host bridge is the new build; surfaces errors in the UI. */
export function DesktopHostSync() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${BRIDGE}/health`, { cache: "no-store" });
        const data = (await res.json()) as { hostBuild?: string; ok?: boolean };
        if (cancelled) return;
        if (!data.hostBuild?.includes("zeropaste-host")) {
          toast.error("Desktop host is outdated — fully quit Electrobun and restart bun run dev:desktop");
          console.error("[ZeroPaste] unexpected health", data);
          return;
        }
        console.info("[ZeroPaste] host OK", data);
        toast.message(`Host: ${data.hostBuild}`, { duration: 2500 });
      } catch {
        if (!cancelled) {
          console.warn("[ZeroPaste] bridge offline (browser-only preview)");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

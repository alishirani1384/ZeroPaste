import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  addClipboardCaptureListener,
  drainPendingCaptures,
  isClipboardWatchAvailable,
  isClipboardWatchEnabled,
  startClipboardWatch,
  stopClipboardWatch,
} from "zeropaste-source";

import { useClipStore } from "@/contexts/clip-store";
import { useVault } from "@/contexts/vault-context";
import { clipFromNativeCapture } from "@/lib/clipboard-capture";

/**
 * Keeps the Android clipboard foreground service aligned with vault unlock,
 * and ingests captures that happened while the UI was backgrounded.
 */
export function ClipboardWatchController() {
  const vault = useVault();
  const store = useClipStore();

  const ingestNative = useCallback(
    async (raw: Parameters<typeof clipFromNativeCapture>[0]) => {
      if (!vault.unlocked || vault.recoveryKeyOnce) return;
      try {
        const clip = await clipFromNativeCapture(raw);
        if (clip) store.upsertClip(clip);
      } catch (err) {
        console.warn("[clipboard-watch] ingest", err);
      }
    },
    [store, vault.recoveryKeyOnce, vault.unlocked],
  );

  const drain = useCallback(() => {
    if (!isClipboardWatchAvailable()) return;
    for (const pending of drainPendingCaptures()) {
      void ingestNative(pending);
    }
  }, [ingestNative]);

  useEffect(() => {
    if (Platform.OS !== "android" || !isClipboardWatchAvailable()) return;
    if (!vault.unlocked || vault.recoveryKeyOnce) {
      // Keep preference, but stop the service while locked so we don't capture into a locked vault.
      void stopClipboardWatch().catch(() => undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!isClipboardWatchEnabled()) return;
      const ok = await startClipboardWatch();
      if (cancelled || !ok) return;
      drain();
    })();

    const sub = addClipboardCaptureListener((capture) => {
      void ingestNative(capture);
    });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") drain();
    });

    return () => {
      cancelled = true;
      sub.remove();
      appSub.remove();
    };
  }, [drain, ingestNative, vault.recoveryKeyOnce, vault.unlocked]);

  return null;
}

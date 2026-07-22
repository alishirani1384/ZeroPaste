import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  addClipboardCaptureListener,
  drainPendingCaptures,
  isClipboardWatchAvailable,
  isClipboardWatchEnabled,
  startClipboardWatch,
} from "zeropaste-source";

import { useClipStore } from "@/contexts/clip-store";
import { useVault } from "@/contexts/vault-context";
import { clipFromNativeCapture } from "@/lib/clipboard-capture";

/**
 * Keeps the Android clipboard foreground service running whenever the user
 * left background watch on. Captures queue natively while the vault is locked;
 * JS drains them on unlock / foreground.
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
    if (!vault.unlocked || vault.recoveryKeyOnce) return;
    for (const pending of drainPendingCaptures()) {
      void ingestNative(pending);
    }
  }, [ingestNative, vault.recoveryKeyOnce, vault.unlocked]);

  // Keep the FGS alive based on preference — do not stop it when the vault locks
  // or the UI unmounts; otherwise swiping the app away kills capture.
  useEffect(() => {
    if (Platform.OS !== "android" || !isClipboardWatchAvailable()) return;

    let cancelled = false;
    void (async () => {
      if (!isClipboardWatchEnabled()) return;
      await startClipboardWatch();
      if (cancelled) return;
      drain();
    })();

    const sub = addClipboardCaptureListener((capture) => {
      void ingestNative(capture);
    });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (isClipboardWatchEnabled()) {
          void startClipboardWatch().then(() => drain());
        } else {
          drain();
        }
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      appSub.remove();
    };
  }, [drain, ingestNative]);

  // Drain queued captures whenever the vault becomes unlocked.
  useEffect(() => {
    if (!vault.unlocked || vault.recoveryKeyOnce) return;
    drain();
  }, [drain, vault.recoveryKeyOnce, vault.unlocked]);

  return null;
}

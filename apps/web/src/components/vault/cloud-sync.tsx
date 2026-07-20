"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-session";
import {
  fetchBridgeState,
  mergeClipsFromCloud,
  mergePinboardsFromCloud,
  setCaptureEnabled,
  subscribeBridge,
  upsertClipFromCloud,
} from "@/lib/bridge";
import {
  tryPullEncryptedClips,
  tryPullEncryptedPinboards,
  tryPushEncryptedClip,
  tryPushEncryptedPinboard,
  tryRegisterDevice,
  trySubscribeEncryptedClips,
} from "@/lib/sync-session";

import { useSyncStatus } from "./sync-status";
import { useVault } from "./vault-context";

/** Survives React remounts / Strict Mode so empty-cloud toasts cannot loop. */
const pulledUsers = new Set<string>();

/**
 * Full sync after the vault is ready for the shelf (unlocked AND recovery key dismissed).
 */
export function CloudSync() {
  const { vaultKey, unlocked, recoveryKeyOnce } = useVault();
  const auth = useAuth();
  const { setPhase } = useSyncStatus();
  const userId = auth.session?.user?.id ?? null;

  const seenRef = useRef<Set<string>>(new Set());
  const deletedPushRef = useRef<Set<string>>(new Set());
  const bodyHashRef = useRef<Map<string, string>>(new Map());
  const pinboardSeenRef = useRef<Set<string>>(new Set());
  const pulledRef = useRef(false);
  const signedOutWarned = useRef(false);
  const skipToastOnce = useRef(false);

  // Shelf-ready: unlocked and past the recovery-key screen
  const shelfReady = unlocked && !recoveryKeyOnce && !!vaultKey;

  useEffect(() => {
    void setCaptureEnabled(shelfReady);
    return () => {
      void setCaptureEnabled(false);
    };
  }, [shelfReady]);

  // Pull + realtime once per user unlock session
  useEffect(() => {
    if (!shelfReady || !vaultKey) {
      pulledRef.current = false;
      setPhase(auth.offlineChosen || !auth.configured ? "offline" : "idle");
      return;
    }

    if (!userId) {
      pulledRef.current = true;
      setPhase("unsigned");
      if (auth.configured && !auth.offlineChosen && !signedOutWarned.current) {
        signedOutWarned.current = true;
        toast.message("Not signed in — clips stay on this device until you sign in", {
          duration: 4000,
        });
      }
      return;
    }

    // Already pulled for this account in this JS session — don't loop toasts.
    if (pulledUsers.has(userId)) {
      pulledRef.current = true;
      setPhase("synced");
      return;
    }

    signedOutWarned.current = false;

    const key = vaultKey;
    let cancelled = false;
    let toastId: string | number | undefined;
    setPhase("pulling", "Restoring from cloud…");

    void (async () => {
      try {
        void tryRegisterDevice();

        const [remote, remoteBoards] = await Promise.all([
          tryPullEncryptedClips(key),
          tryPullEncryptedPinboards(key),
        ]);
        if (cancelled) return;

        pulledRef.current = true;
        pulledUsers.add(userId);

        for (const c of remote) {
          seenRef.current.add(c.id);
          bodyHashRef.current.set(c.id, c.contentHash);
          if (c.deletedAt) deletedPushRef.current.add(c.id);
        }
        for (const b of remoteBoards) {
          pinboardSeenRef.current.add(b.id);
        }

        if (remoteBoards.length > 0) {
          await mergePinboardsFromCloud(remoteBoards);
        }

        // Upload any local custom boards that are not yet in the cloud.
        const local = await fetchBridgeState();
        for (const board of local?.pinboards ?? []) {
          if (board.id === "history" || pinboardSeenRef.current.has(board.id)) continue;
          pinboardSeenRef.current.add(board.id);
          void tryPushEncryptedPinboard(board, key);
        }

        const liveCount = remote.filter((c) => !c.deletedAt).length;

        if (remote.length > 0) {
          toastId = toast.loading("Restoring clips from cloud…");
          const ok = await mergeClipsFromCloud(remote);
          if (cancelled) {
            if (toastId !== undefined) toast.dismiss(toastId);
            return;
          }
          if (!ok) {
            setPhase("error", "Could not apply cloud clips to this device");
            toast.error("Cloud clips fetched but failed to show on this device", {
              id: toastId,
              duration: 6000,
            });
            return;
          }
          if (liveCount > 0) {
            setPhase("synced", `Restored ${liveCount} clips`);
            toast.success(`Restored ${liveCount} clip${liveCount === 1 ? "" : "s"} from cloud`, {
              id: toastId,
            });
          } else {
            setPhase("synced", "Up to date");
            toast.dismiss(toastId);
          }
        } else {
          setPhase("synced", "Cloud ready");
        }
      } catch (err) {
        console.warn("[ZeroPaste] pull failed", err);
        pulledRef.current = true;
        pulledUsers.add(userId);
        if (cancelled) return;
        setPhase("error", "Cloud pull failed");
        toast.error(
          "Cloud pull failed — apply the vault_meta migration and check Supabase RLS",
          { duration: 6000 },
        );
      }
    })();

    const unsub = trySubscribeEncryptedClips(key, (clip) => {
      seenRef.current.add(clip.id);
      bodyHashRef.current.set(clip.id, clip.contentHash);
      if (clip.deletedAt) deletedPushRef.current.add(clip.id);
      void upsertClipFromCloud(clip);
    });

    return () => {
      cancelled = true;
      unsub?.();
      if (toastId !== undefined) toast.dismiss(toastId);
    };
  }, [shelfReady, vaultKey, userId, auth.configured, auth.offlineChosen, setPhase]);

  // Push new / edited / deleted clips + pinboards
  useEffect(() => {
    if (!shelfReady || !vaultKey) {
      seenRef.current.clear();
      bodyHashRef.current.clear();
      deletedPushRef.current.clear();
      pinboardSeenRef.current.clear();
      skipToastOnce.current = false;
      return;
    }
    const key = vaultKey;

    return subscribeBridge((state) => {
      if (userId && !pulledRef.current) return;

      for (const board of state.pinboards) {
        if (board.id === "history") continue;
        if (pinboardSeenRef.current.has(board.id)) continue;
        pinboardSeenRef.current.add(board.id);
        void tryPushEncryptedPinboard(board, key).then((result) => {
          if (result === "pushed") {
            console.info("[ZeroPaste] synced pinboard", board.name);
          } else if (result === "error") {
            pinboardSeenRef.current.delete(board.id);
          }
        });
      }

      for (const clip of state.clips) {
        if (clip.deletedAt) {
          if (deletedPushRef.current.has(clip.id)) continue;
          deletedPushRef.current.add(clip.id);
          void tryPushEncryptedClip(clip, key).then((result) => {
            if (result === "pushed") {
              console.info("[ZeroPaste] synced delete", clip.id.slice(0, 8));
            } else if (result === "error" || result === "local_only") {
              deletedPushRef.current.delete(clip.id);
              toast.error("Failed to sync delete to cloud");
            } else if (result === "skipped") {
              deletedPushRef.current.delete(clip.id);
            }
          });
          continue;
        }

        const prevHash = bodyHashRef.current.get(clip.id);
        const isNew = !seenRef.current.has(clip.id);
        const edited = prevHash !== undefined && prevHash !== clip.contentHash;
        if (!isNew && !edited) continue;

        seenRef.current.add(clip.id);
        bodyHashRef.current.set(clip.id, clip.contentHash);

        void tryPushEncryptedClip(clip, key).then((result) => {
          if (result === "pushed") {
            console.info("[ZeroPaste] synced", clip.id.slice(0, 8), edited ? "edit" : "new");
          } else if (result === "local_only") {
            toast.message("Large image kept local only (>2MB)", { duration: 2200 });
          } else if (result === "skipped") {
            if (auth.configured && !userId && !auth.offlineChosen && !skipToastOnce.current) {
              skipToastOnce.current = true;
              toast.message("Not signed in — clips stay local only", { duration: 2800 });
            }
          } else if (result === "error") {
            seenRef.current.delete(clip.id);
            toast.error("Cloud sync failed");
          }
        });
      }
    });
  }, [shelfReady, vaultKey, userId, auth.configured, auth.offlineChosen]);

  return null;
}

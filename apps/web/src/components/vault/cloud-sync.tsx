"use client";

import { useCallback, useEffect, useRef } from "react";
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
  trySoftDeletePinboard,
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
  const { setPhase, registerRefreshHandler } = useSyncStatus();
  const userId = auth.session?.user?.id ?? null;

  const seenRef = useRef<Set<string>>(new Set());
  const deletedPushRef = useRef<Set<string>>(new Set());
  const bodyHashRef = useRef<Map<string, string>>(new Map());
  const pinboardSeenRef = useRef<Set<string>>(new Set());
  const pinboardDeletedPushRef = useRef<Set<string>>(new Set());
  const pulledRef = useRef(false);
  const signedOutWarned = useRef(false);
  const skipToastOnce = useRef(false);
  const pullInFlight = useRef(false);
  const vaultKeyRef = useRef(vaultKey);
  const userIdRef = useRef(userId);
  const prevUserIdRef = useRef<string | null>(null);

  vaultKeyRef.current = vaultKey;
  userIdRef.current = userId;

  // Sign-out clears this account's "already pulled" mark so the next sign-in re-pulls.
  useEffect(() => {
    const prev = prevUserIdRef.current;
    if (prev && !userId) pulledUsers.delete(prev);
    prevUserIdRef.current = userId;
  }, [userId]);

  // Shelf-ready: unlocked and past the recovery-key screen
  const shelfReady = unlocked && !recoveryKeyOnce && !!vaultKey;

  const pullFromCloud = useCallback(
    async (opts: { reason: "initial" | "manual" }) => {
      const key = vaultKeyRef.current;
      const uid = userIdRef.current;
      if (!key || !uid) {
        if (opts.reason === "manual") {
          toast.message("Sign in to refresh from the cloud", { duration: 2800 });
        }
        return;
      }
      if (pullInFlight.current) return;
      pullInFlight.current = true;

      const busyLabel =
        opts.reason === "manual" ? "Checking cloud…" : "Restoring in background…";
      setPhase("pulling", busyLabel);
      if (opts.reason === "initial") {
        toast.message("Restoring your library in the background — you can keep working", {
          duration: 3200,
        });
      }

      try {
        void tryRegisterDevice();

        const beforeIds = new Set(seenRef.current);
        const beforeHashes = new Map(bodyHashRef.current);
        let applied = 0;

        const [clipsResult, boardsResult] = await Promise.all([
          tryPullEncryptedClips(key, {
            onFirstPage: () => {
              // Unlock local push / realtime apply as soon as the newest page lands.
              pulledRef.current = true;
            },
            onPage: (page) => {
              if (page.length === 0) return;
              applied += page.length;
              void mergeClipsFromCloud(page);
              setPhase(
                "pulling",
                opts.reason === "manual"
                  ? `Updating… ${applied} clips`
                  : applied <= 80
                    ? `Restoring… ${applied} clips`
                    : `Library ready — restoring older clips (${applied})…`,
              );
            },
          }),
          tryPullEncryptedPinboards(key),
        ]);
        const remote = clipsResult.items;
        const remoteBoards = boardsResult.boards;
        const failedCount = clipsResult.failedCount + boardsResult.failedCount;

        pulledRef.current = true;
        pulledUsers.add(uid);

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

        if (failedCount > 0) {
          toast.error(
            `Could not decrypt ${failedCount} item${failedCount === 1 ? "" : "s"} from the cloud`,
            { duration: 5000 },
          );
        }

        // Upload any local custom boards that are not yet in the cloud.
        const local = await fetchBridgeState();
        for (const board of local?.pinboards ?? []) {
          if (board.id === "history" || pinboardSeenRef.current.has(board.id)) continue;
          pinboardSeenRef.current.add(board.id);
          if (board.deletedAt) {
            void trySoftDeletePinboard(board, key);
          } else {
            void tryPushEncryptedPinboard(board, key);
          }
        }

        const live = remote.filter((c) => !c.deletedAt);
        const newLive = live.filter((c) => !beforeIds.has(c.id));
        const updatedLive = live.filter(
          (c) => beforeIds.has(c.id) && beforeHashes.get(c.id) !== c.contentHash,
        );

        // Pages already merged via onPage; still merge once if nothing streamed.
        if (remote.length > 0 && applied === 0) {
          const ok = await mergeClipsFromCloud(remote);
          if (!ok) {
            setPhase("error", "Could not apply cloud clips to this device");
            toast.error("Cloud clips fetched but failed to show on this device", {
              duration: 6000,
            });
            return;
          }
        }

        if (opts.reason === "manual") {
          if (newLive.length > 0) {
            setPhase(
              "synced",
              `Fetched ${newLive.length} new clip${newLive.length === 1 ? "" : "s"}`,
            );
            toast.success(
              `Fetched ${newLive.length} new clip${newLive.length === 1 ? "" : "s"} from cloud`,
              { duration: 3200 },
            );
          } else if (updatedLive.length > 0) {
            setPhase("synced", "Cloud updates applied");
            toast.success(
              `Updated ${updatedLive.length} clip${updatedLive.length === 1 ? "" : "s"} from cloud`,
              { duration: 2800 },
            );
          } else {
            setPhase("synced", "Up to date");
            toast.message("You're up to date — nothing new in the cloud", { duration: 2400 });
          }
        } else if (live.length > 0) {
          setPhase("synced", `Restored ${live.length} clips`);
          toast.success(
            `Library restored — ${live.length} clip${live.length === 1 ? "" : "s"}`,
            { duration: 2800 },
          );
        } else {
          setPhase("synced", remote.length > 0 ? "Up to date" : "Cloud ready");
        }
      } catch (err) {
        console.warn("[ZeroPaste] pull failed", err);
        // Don't mark this account as "pulled" on failure — retry on the next mount/unlock.
        pulledRef.current = true;
        setPhase("error", "Cloud pull failed");
        toast.error(
          opts.reason === "manual"
            ? "Could not refresh from cloud"
            : "Cloud pull failed — apply the vault_meta migration and check Supabase RLS",
          { duration: 6000 },
        );
      } finally {
        pullInFlight.current = false;
      }
    },
    [setPhase],
  );

  useEffect(() => {
    registerRefreshHandler(() => pullFromCloud({ reason: "manual" }));
    return () => registerRefreshHandler(null);
  }, [pullFromCloud, registerRefreshHandler]);

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

    signedOutWarned.current = false;

    // Already pulled for this account in this JS session — don't loop toasts.
    // Manual refresh still works via the toolbar button.
    if (pulledUsers.has(userId)) {
      pulledRef.current = true;
      setPhase("synced");
    } else {
      void pullFromCloud({ reason: "initial" });
    }

    const key = vaultKey;
    const unsub = trySubscribeEncryptedClips(key, (clip) => {
      seenRef.current.add(clip.id);
      bodyHashRef.current.set(clip.id, clip.contentHash);
      if (clip.deletedAt) deletedPushRef.current.add(clip.id);
      void upsertClipFromCloud(clip);
    });

    return () => {
      unsub?.();
    };
  }, [shelfReady, vaultKey, userId, auth.configured, auth.offlineChosen, setPhase, pullFromCloud]);

  // Push new / edited / deleted clips + pinboards
  useEffect(() => {
    if (!shelfReady || !vaultKey) {
      seenRef.current.clear();
      bodyHashRef.current.clear();
      deletedPushRef.current.clear();
      pinboardSeenRef.current.clear();
      pinboardDeletedPushRef.current.clear();
      skipToastOnce.current = false;
      return;
    }
    const key = vaultKey;

    return subscribeBridge((state) => {
      if (userId && !pulledRef.current) return;

      for (const board of state.pinboards) {
        if (board.id === "history") continue;
        if (board.deletedAt) {
          if (pinboardDeletedPushRef.current.has(board.id)) continue;
          pinboardDeletedPushRef.current.add(board.id);
          void trySoftDeletePinboard(board, key).then((result) => {
            if (result === "pushed") {
              console.info("[ZeroPaste] synced pinboard delete", board.name);
            } else if (result === "error") {
              pinboardDeletedPushRef.current.delete(board.id);
            }
          });
          continue;
        }
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
            seenRef.current.delete(clip.id);
            if (prevHash === undefined) bodyHashRef.current.delete(clip.id);
            else bodyHashRef.current.set(clip.id, prevHash);
          } else if (result === "error") {
            seenRef.current.delete(clip.id);
            if (prevHash === undefined) bodyHashRef.current.delete(clip.id);
            else bodyHashRef.current.set(clip.id, prevHash);
            toast.error("Cloud sync failed");
          }
        });
      }
    });
  }, [shelfReady, vaultKey, userId, auth.configured, auth.offlineChosen]);

  return null;
}

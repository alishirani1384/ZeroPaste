import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import type { ClipItem } from "@paste/clipboard-core";
import { fetchVaultMetaBlob, upsertVaultMetaBlob } from "@paste/sync";

import { useAuth } from "@/contexts/auth-context";
import { useClipStore } from "@/contexts/clip-store";
import { useSyncStatus } from "@/contexts/sync-status";
import { useVault } from "@/contexts/vault-context";
import {
  tryPullEncryptedClips,
  tryPullEncryptedPinboards,
  tryPushEncryptedClip,
  tryPushEncryptedPinboard,
  tryRegisterDevice,
  trySoftDeletePinboard,
  trySubscribeEncryptedClips,
} from "@/lib/sync-session";

const pulledUsers = new Set<string>();

/** Pull/push encrypted clips after vault is shelf-ready. */
export function CloudSync() {
  const { vaultKey, unlocked, recoveryKeyOnce, meta } = useVault();
  const auth = useAuth();
  const store = useClipStore();
  const {
    setPhase,
    markClipSynced,
    markClipLocalOnly,
    markClipsSynced,
    clearClipBadges,
  } = useSyncStatus();
  const userId = auth.session?.user?.id ?? null;
  const seenRef = useRef(new Set<string>());
  const bodyHashRef = useRef(new Map<string, string>());
  const deletedPushRef = useRef(new Set<string>());
  const pinboardSeenRef = useRef(new Set<string>());
  const pulledRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  const shelfReady = unlocked && !recoveryKeyOnce && !!vaultKey;

  useEffect(() => {
    if (!shelfReady) {
      setPhase(auth.offlineChosen || !auth.configured ? "offline" : "idle");
      return;
    }
    if (!userId) {
      setPhase("unsigned");
      return;
    }
    if (pulledUsers.has(userId)) {
      setPhase("synced");
    }
  }, [shelfReady, userId, auth.offlineChosen, auth.configured, setPhase]);

  // Sign-out clears this account's "already pulled" mark so the next sign-in re-pulls.
  useEffect(() => {
    const prev = prevUserIdRef.current;
    if (prev && !userId) pulledUsers.delete(prev);
    prevUserIdRef.current = userId;
  }, [userId]);

  // Upload vault meta wraps once unlocked
  useEffect(() => {
    if (!shelfReady || !meta || !auth.session || !auth.client) return;
    void upsertVaultMetaBlob(auth.client, auth.session.user.id, meta).catch((err) => {
      console.warn("[ZeroPaste] vault meta upload failed", err);
    });
  }, [shelfReady, meta, auth.session, auth.client]);

  // Initial pull + realtime
  useEffect(() => {
    if (!shelfReady || !vaultKey || !userId) {
      pulledRef.current = false;
      return;
    }

    let cancelled = false;
    const key = vaultKey;
    const alreadyPulled = pulledUsers.has(userId);

    if (!alreadyPulled) {
      setPhase("pulling", "Restoring from cloud…");
    } else {
      setPhase("synced");
    }

    void (async () => {
      try {
        void tryRegisterDevice();
        const [clipsResult, boardsResult] = await Promise.all([
          tryPullEncryptedClips(key),
          tryPullEncryptedPinboards(key),
        ]);
        if (cancelled) return;
        const remote = clipsResult.items;
        const remoteBoards = boardsResult.boards;
        const failedCount = clipsResult.failedCount + boardsResult.failedCount;

        pulledUsers.add(userId);
        pulledRef.current = true;

        for (const c of remote) {
          seenRef.current.add(c.id);
          bodyHashRef.current.set(c.id, c.contentHash);
          if (c.deletedAt) deletedPushRef.current.add(c.id);
        }
        for (const b of remoteBoards) pinboardSeenRef.current.add(b.id);

        markClipsSynced(remote.map((c) => c.id));

        if (remote.length) store.upsertClips(remote);
        if (remoteBoards.length) {
          const merged = [
            ...store.pinboards.filter((b) => !remoteBoards.some((r) => r.id === b.id)),
            ...remoteBoards,
          ].sort((a, b) => a.sortOrder - b.sortOrder);
          store.setPinboards(merged);
        }

        if (!alreadyPulled) {
          for (const board of store.pinboards) {
            if (board.id === "history" || pinboardSeenRef.current.has(board.id)) continue;
            pinboardSeenRef.current.add(board.id);
            if (board.deletedAt) {
              void trySoftDeletePinboard(board, key);
            } else {
              void tryPushEncryptedPinboard(board, key);
            }
          }
        }

        setPhase("synced");

        if (failedCount > 0) {
          Alert.alert(
            "Sync",
            `Could not decrypt ${failedCount} item${failedCount === 1 ? "" : "s"} from the cloud.`,
          );
        }
      } catch (err) {
        console.warn("[sync] initial pull failed", err);
        pulledRef.current = true;
        setPhase("error", "Could not restore clips from cloud");
        if (!alreadyPulled) {
          Alert.alert("Sync", "Could not restore clips from cloud. Local history still works.");
        }
      }
    })();

    const unsub = trySubscribeEncryptedClips(key, (clip) => {
      seenRef.current.add(clip.id);
      bodyHashRef.current.set(clip.id, clip.contentHash);
      if (clip.deletedAt) deletedPushRef.current.add(clip.id);
      markClipSynced(clip.id);
      store.upsertClip(clip);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pull once per unlock session
  }, [shelfReady, vaultKey, userId]);

  // Push local changes — wait for the initial pull so we don't race a fresh cloud restore.
  useEffect(() => {
    if (!shelfReady || !vaultKey || !userId || !pulledRef.current) return;
    const key = vaultKey;

    // Pinboards: push creates + soft-deletes
    for (const board of store.pinboards) {
      if (board.id === "history") continue;
      if (board.deletedAt) {
        if (pinboardSeenRef.current.has(`del:${board.id}`)) continue;
        pinboardSeenRef.current.add(`del:${board.id}`);
        void trySoftDeletePinboard(board, key).then((result) => {
          if (result === "error") pinboardSeenRef.current.delete(`del:${board.id}`);
        });
        continue;
      }
      if (pinboardSeenRef.current.has(board.id)) continue;
      pinboardSeenRef.current.add(board.id);
      void tryPushEncryptedPinboard(board, key).then((result) => {
        if (result === "error") pinboardSeenRef.current.delete(board.id);
      });
    }

    const pending = store.clips.filter((clip) =>
      clip.deletedAt
        ? !deletedPushRef.current.has(clip.id)
        : bodyHashRef.current.get(clip.id) !== clip.contentHash,
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const pushOne = async (clip: ClipItem) => {
      if (clip.deletedAt) {
        deletedPushRef.current.add(clip.id);
        const result = await tryPushEncryptedClip(clip, key);
        if (!cancelled && result === "pushed") markClipSynced(clip.id);
        return;
      }
      bodyHashRef.current.set(clip.id, clip.contentHash);
      const result = await tryPushEncryptedClip(clip, key);
      if (cancelled) return;
      if (result === "pushed") {
        seenRef.current.add(clip.id);
        markClipSynced(clip.id);
      } else if (result === "local_only") {
        markClipLocalOnly(clip.id);
      }
    };

    // Limit concurrent pushes so a burst of new clips doesn't flood Supabase.
    const CONCURRENCY = 3;
    let cursor = 0;
    const worker = async () => {
      while (!cancelled && cursor < pending.length) {
        const clip = pending[cursor++]!;
        await pushOne(clip);
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

    return () => {
      cancelled = true;
    };
  }, [store.clips, store.pinboards, shelfReady, vaultKey, userId, markClipSynced, markClipLocalOnly]);

  // Reset badge map when signing out
  useEffect(() => {
    if (userId) return;
    clearClipBadges();
    seenRef.current.clear();
    bodyHashRef.current.clear();
    deletedPushRef.current.clear();
    pinboardSeenRef.current.clear();
  }, [userId, clearClipBadges]);

  return null;
}

export async function probeCloudVaultMeta(
  client: NonNullable<ReturnType<typeof useAuth>["client"]>,
  userId: string,
) {
  return fetchVaultMetaBlob(client, userId);
}

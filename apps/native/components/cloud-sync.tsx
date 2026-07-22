import { useEffect, useRef } from "react";
import { Alert } from "react-native";
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

  // Upload vault meta wraps once unlocked
  useEffect(() => {
    if (!shelfReady || !meta || !auth.session || !auth.client) return;
    void upsertVaultMetaBlob(auth.client, auth.session.user.id, meta).catch((err) => {
      console.warn("[ZeroPaste] vault meta upload failed", err);
    });
  }, [shelfReady, meta, auth.session, auth.client]);

  // Initial pull + realtime
  useEffect(() => {
    if (!shelfReady || !vaultKey || !userId) return;

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
        const [remote, remoteBoards] = await Promise.all([
          tryPullEncryptedClips(key),
          tryPullEncryptedPinboards(key),
        ]);
        if (cancelled) return;
        pulledUsers.add(userId);

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
            void tryPushEncryptedPinboard(board, key);
          }
        }

        setPhase("synced");
      } catch (err) {
        console.warn("[sync] initial pull failed", err);
        if (!alreadyPulled) {
          setPhase("error", "Could not restore clips from cloud");
          Alert.alert("Sync", "Could not restore clips from cloud. Local history still works.");
        } else {
          setPhase("synced");
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

  // Push local changes
  useEffect(() => {
    if (!shelfReady || !vaultKey || !userId) return;
    for (const clip of store.clips) {
      if (clip.deletedAt) {
        if (deletedPushRef.current.has(clip.id)) continue;
        deletedPushRef.current.add(clip.id);
        void tryPushEncryptedClip(clip, vaultKey).then((result) => {
          if (result === "pushed") markClipSynced(clip.id);
        });
        continue;
      }
      const prevHash = bodyHashRef.current.get(clip.id);
      if (prevHash === clip.contentHash) continue;
      bodyHashRef.current.set(clip.id, clip.contentHash);
      void tryPushEncryptedClip(clip, vaultKey).then((result) => {
        if (result === "pushed") {
          seenRef.current.add(clip.id);
          markClipSynced(clip.id);
        } else if (result === "local_only") {
          markClipLocalOnly(clip.id);
        }
      });
    }
  }, [store.clips, shelfReady, vaultKey, userId, markClipSynced, markClipLocalOnly]);

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

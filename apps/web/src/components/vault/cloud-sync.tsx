"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { subscribeBridge } from "@/lib/bridge";
import { tryPushEncryptedClip } from "@/lib/sync-session";

import { useVault } from "./vault-context";

/**
 * Desktop captures → local bridge store. This component encrypts new clips and
 * upserts them to Supabase when the vault is unlocked and the user is signed in.
 */
export function CloudSync() {
  const { vaultKey, unlocked } = useVault();
  const seenRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const pushedToastRef = useRef(false);

  useEffect(() => {
    if (!unlocked || !vaultKey) {
      bootstrappedRef.current = false;
      seenRef.current.clear();
      return;
    }

    const key = vaultKey;

    return subscribeBridge((state) => {
      const live = state.clips.filter((c) => !c.deletedAt);

      if (!bootstrappedRef.current) {
        for (const c of live) seenRef.current.add(c.id);
        bootstrappedRef.current = true;
        return;
      }

      for (const clip of live) {
        if (seenRef.current.has(clip.id)) continue;
        seenRef.current.add(clip.id);

        void tryPushEncryptedClip(clip, key).then((result) => {
          if (result === "pushed") {
            console.info("[ZeroPaste] synced clip → Supabase", clip.id.slice(0, 8));
            if (!pushedToastRef.current) {
              pushedToastRef.current = true;
              toast.success("Encrypted clip synced to cloud");
            }
          } else if (result === "local_only") {
            toast.message("Large image kept local only (>2MB)", { duration: 2200 });
          } else if (result === "skipped") {
            console.warn(
              "[ZeroPaste] sync skipped — sign in at Account (/account) while unlocked",
            );
          } else {
            toast.error("Cloud sync failed — check browser console");
          }
        });
      }
    });
  }, [unlocked, vaultKey]);

  return null;
}

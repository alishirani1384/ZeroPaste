import type { ClipItem } from "@paste/clipboard-core";
import { decryptClip, pullClips, pushClip, subscribeClips, type ClipRow } from "@paste/sync";

import { getSupabaseBrowser } from "./supabase";

/** Push a clip when vault + Supabase auth are available. Failures are soft. */
export async function tryPushEncryptedClip(
  clip: ClipItem,
  vaultKey: Uint8Array,
): Promise<"pushed" | "skipped" | "error"> {
  const client = getSupabaseBrowser();
  if (!client) return "skipped";
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return "skipped";

  try {
    await pushClip(client, session.user.id, null, clip, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] push failed", err);
    return "error";
  }
}

export async function tryPullEncryptedClips(vaultKey: Uint8Array): Promise<ClipItem[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return [];
  return pullClips(client, session.user.id, vaultKey);
}

export function trySubscribeEncryptedClips(
  vaultKey: Uint8Array,
  onClip: (clip: ClipItem) => void,
): (() => void) | null {
  const client = getSupabaseBrowser();
  if (!client) return null;

  let unsub: (() => void) | null = null;

  void client.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    const channel = subscribeClips(client, session.user.id, (row: ClipRow) => {
      if (row.deleted_at) return;
      try {
        onClip(
          decryptClip(vaultKey, {
            version: 1,
            ciphertext: row.ciphertext,
            nonce: row.nonce,
            wrappedKey: row.wrapped_key,
          }),
        );
      } catch (err) {
        console.warn("[sync] realtime decrypt failed", err);
      }
    });
    unsub = () => {
      void client.removeChannel(channel);
    };
  });

  return () => unsub?.();
}

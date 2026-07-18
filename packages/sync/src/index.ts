import type { ClipItem } from "@paste/clipboard-core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { decryptClip, encryptClip } from "./clip-crypto";
import type { ClipRow } from "./types";

export type { ClipRow } from "./types";
export { encryptClip, decryptClip } from "./clip-crypto";

export function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}

export function isSupabaseConfigured(url?: string, anonKey?: string): boolean {
  return Boolean(url && anonKey && url.startsWith("http"));
}

export async function pushClip(
  client: SupabaseClient,
  userId: string,
  deviceId: string | null,
  clip: ClipItem,
  vaultKey: Uint8Array,
) {
  const envelope = encryptClip(vaultKey, clip);
  const { error } = await client.from("clips").upsert({
    id: clip.id,
    user_id: userId,
    device_id: deviceId,
    kind: clip.kind,
    byte_size: clip.byteSize,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
    wrapped_key: envelope.wrappedKey,
    created_at: clip.createdAt,
    updated_at: clip.updatedAt,
    deleted_at: clip.deletedAt ?? null,
  });
  if (error) throw error;
}

export function subscribeClips(
  client: SupabaseClient,
  userId: string,
  onChange: (row: ClipRow) => void,
) {
  return client
    .channel(`clips:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clips", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as ClipRow | undefined;
        if (row) onChange(row);
      },
    )
    .subscribe();
}

export { pullClips } from "./pull";
export {
  createLocalVault,
  unlockWithPassphrase,
  unlockWithRecovery,
  upsertVaultProfile,
  fetchVaultSalt,
  generateRecoveryKey,
  type LocalVaultMeta,
} from "./vault-profile";

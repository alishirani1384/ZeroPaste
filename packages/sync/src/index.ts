import type { ClipItem } from "@paste/clipboard-core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { decryptClip, encryptClip } from "./clip-crypto";
import { getSyncStorage, type SyncStorage } from "./storage";
import type { ClipRow } from "./types";

export type { ClipRow } from "./types";
export { encryptClip, decryptClip } from "./clip-crypto";
export { setSyncStorage, getSyncStorage, type SyncStorage } from "./storage";

export function createSupabase(
  url: string,
  anonKey: string,
  opts?: { storage?: SyncStorage; detectSessionInUrl?: boolean },
): SupabaseClient {
  const storage = opts?.storage ?? getSyncStorage() ?? undefined;
  return createClient(url, anonKey, {
    auth: {
      // Keep the account signed in across launches; refresh tokens renew the session
      // until revoked or the project’s refresh-token lifetime ends (configure in Supabase).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: opts?.detectSessionInUrl ?? true,
      storage,
    },
  });
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

/**
 * Soft-delete a clip that already exists remotely. Returns true if a row was updated.
 * Prefer this for deletes so we don't need local media to re-encrypt.
 */
export async function softDeleteRemoteClip(
  client: SupabaseClient,
  userId: string,
  clipId: string,
  deletedAt: string,
  updatedAt: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("clips")
    .update({ deleted_at: deletedAt, updated_at: updatedAt })
    .eq("id", clipId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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
  upsertVaultMetaBlob,
  fetchVaultMetaBlob,
  generateRecoveryKey,
  type LocalVaultMeta,
} from "./vault-profile";
export {
  registerDevice,
  loadLocalDeviceId,
  saveLocalDeviceId,
  detectDevicePlatform,
  defaultDeviceName,
  type DevicePlatform,
} from "./device";
export {
  pushPinboard,
  pullPinboards,
  isSyncablePinboard,
  type PinboardRow,
} from "./pinboard-sync";

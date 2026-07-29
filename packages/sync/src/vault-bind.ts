import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createLocalVault,
  fetchVaultMetaBlob,
  upsertVaultMetaBlob,
  type LocalVaultMeta,
} from "./vault-profile";

/** Stamp (or clear) which Supabase user owns this local vault meta. */
export function withVaultOwner(
  meta: LocalVaultMeta,
  ownerUserId: string | null | undefined,
): LocalVaultMeta {
  if (!ownerUserId) {
    if (!meta.ownerUserId) return meta;
    return {
      saltB64: meta.saltB64,
      passphraseWrap: meta.passphraseWrap,
      recoveryWrap: meta.recoveryWrap,
      verify: meta.verify,
      recoveryHint: meta.recoveryHint,
      createdAt: meta.createdAt,
      ...(meta.kdf ? { kdf: meta.kdf } : {}),
    };
  }
  return { ...meta, ownerUserId };
}

export function vaultMetaBelongsToUser(
  meta: LocalVaultMeta | null | undefined,
  userId: string,
): boolean {
  if (!meta) return false;
  // Legacy meta (no owner): treat as unbound — must not be used for a different cloud account.
  if (!meta.ownerUserId) return false;
  return meta.ownerUserId === userId;
}

/**
 * Decide which vault meta should be active for a signed-in user.
 * Never keeps another user's wraps while this session is active.
 */
export async function resolveVaultForUser(
  client: SupabaseClient,
  userId: string,
  localMeta: LocalVaultMeta | null,
): Promise<{
  meta: LocalVaultMeta | null;
  /** True when active meta changed enough that unlock must be cleared. */
  mustRelock: boolean;
  source: "local" | "cloud" | "none";
}> {
  const remote = await fetchVaultMetaBlob(client, userId);
  const localOwned =
    localMeta &&
    (localMeta.ownerUserId === userId ||
      // Legacy unbound meta may be claimed only when it matches cloud or cloud is empty.
      (!localMeta.ownerUserId && (!remote || remote.saltB64 === localMeta.saltB64)));

  if (remote) {
    const ownedRemote = withVaultOwner(remote, userId);
    if (localOwned && localMeta && localMeta.saltB64 === remote.saltB64) {
      // Prefer local wraps if same vault; stamp owner if missing.
      const stamped = withVaultOwner(localMeta, userId);
      return {
        meta: stamped,
        mustRelock: false,
        source: "local",
      };
    }
    // Cloud is source of truth for this account when salts differ or local is foreign/unbound.
    const saltChanged = !localMeta || localMeta.saltB64 !== remote.saltB64;
    return {
      meta: ownedRemote,
      mustRelock: saltChanged || !localOwned,
      source: "cloud",
    };
  }

  if (localOwned && localMeta) {
    return {
      meta: withVaultOwner(localMeta, userId),
      mustRelock: false,
      source: "local",
    };
  }

  // Foreign or unbound local meta with no cloud vault for this user → start empty.
  return { meta: null, mustRelock: true, source: "none" };
}

/**
 * Upload local vault wraps only when safe:
 * - meta is owned by this user (or being claimed as first upload)
 * - remote is empty OR same salt
 */
export async function safeUpsertVaultMetaBlob(
  client: SupabaseClient,
  userId: string,
  meta: LocalVaultMeta,
): Promise<"uploaded" | "skipped" | "conflict"> {
  if (meta.ownerUserId && meta.ownerUserId !== userId) {
    return "skipped";
  }
  const stamped = withVaultOwner(meta, userId);
  const remote = await fetchVaultMetaBlob(client, userId);
  if (remote && remote.saltB64 !== stamped.saltB64) {
    console.warn(
      "[vault] refusing to overwrite cloud vault meta (salt mismatch)",
      { userId, local: stamped.saltB64.slice(0, 8), remote: remote.saltB64.slice(0, 8) },
    );
    return "conflict";
  }
  await upsertVaultMetaBlob(client, userId, stamped);
  return "uploaded";
}

export async function createOwnedLocalVault(
  passphrase: string,
  ownerUserId?: string | null,
): Promise<{
  meta: LocalVaultMeta;
  vaultKey: Uint8Array;
  recoveryKey: string;
}> {
  const created = await createLocalVault(passphrase);
  return {
    ...created,
    meta: withVaultOwner(created.meta, ownerUserId ?? null),
  };
}

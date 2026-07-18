import {
  decryptPayloadText,
  deriveKeyFromPassphrase,
  deriveKeyFromRecovery,
  encryptPayload,
  generateRecoveryKey,
  generateSalt,
  generateVaultKey,
  toB64,
  fromB64,
  unwrapKey,
  wrapKey,
  type EncryptedEnvelope,
  type WrappedKey,
} from "@paste/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const VERIFY_PLAINTEXT = "zeropaste-vault-v1";

export type LocalVaultMeta = {
  saltB64: string;
  /** Vault key wrapped by passphrase-derived key */
  passphraseWrap: WrappedKey;
  /** Vault key wrapped by recovery-derived key */
  recoveryWrap: WrappedKey;
  verify: EncryptedEnvelope;
  recoveryHint: string;
  createdAt: string;
};

export function createLocalVault(passphrase: string): {
  meta: LocalVaultMeta;
  vaultKey: Uint8Array;
  recoveryKey: string;
} {
  const salt = generateSalt();
  const vaultKey = generateVaultKey();
  const recoveryKey = generateRecoveryKey();
  const passKey = deriveKeyFromPassphrase(passphrase, salt);
  const recoveryDerived = deriveKeyFromRecovery(recoveryKey, salt);
  const verify = encryptPayload(vaultKey, VERIFY_PLAINTEXT);

  return {
    vaultKey,
    recoveryKey,
    meta: {
      saltB64: toB64(salt),
      passphraseWrap: wrapKey(passKey, vaultKey),
      recoveryWrap: wrapKey(recoveryDerived, vaultKey),
      verify,
      recoveryHint: `${recoveryKey.slice(0, 8)}…`,
      createdAt: new Date().toISOString(),
    },
  };
}

function assertVault(vaultKey: Uint8Array, verify: EncryptedEnvelope) {
  const plain = decryptPayloadText(vaultKey, verify);
  if (plain !== VERIFY_PLAINTEXT) throw new Error("Vault integrity check failed");
}

export function unlockWithPassphrase(meta: LocalVaultMeta, passphrase: string): Uint8Array {
  const passKey = deriveKeyFromPassphrase(passphrase, fromB64(meta.saltB64));
  try {
    const vaultKey = unwrapKey(passKey, meta.passphraseWrap);
    assertVault(vaultKey, meta.verify);
    return vaultKey;
  } catch {
    throw new Error("Invalid passphrase");
  }
}

export function unlockWithRecovery(meta: LocalVaultMeta, recoveryKeyHex: string): Uint8Array {
  const recoveryDerived = deriveKeyFromRecovery(recoveryKeyHex, fromB64(meta.saltB64));
  try {
    const vaultKey = unwrapKey(recoveryDerived, meta.recoveryWrap);
    assertVault(vaultKey, meta.verify);
    return vaultKey;
  } catch {
    throw new Error("Invalid recovery key");
  }
}

export async function upsertVaultProfile(
  client: SupabaseClient,
  userId: string,
  saltB64: string,
  displayName?: string,
) {
  const { error } = await client.from("profiles").upsert({
    id: userId,
    vault_salt: saltB64,
    display_name: displayName ?? null,
  });
  if (error) throw error;
}

export async function fetchVaultSalt(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from("profiles").select("vault_salt").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.vault_salt ?? null;
}

export { generateRecoveryKey };

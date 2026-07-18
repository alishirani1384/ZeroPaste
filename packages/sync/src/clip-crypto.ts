import type { ClipItem } from "@paste/clipboard-core";
import { decryptJson, encryptJson, type EncryptedEnvelope } from "@paste/crypto";

export function encryptClip(vaultKey: Uint8Array, clip: ClipItem): EncryptedEnvelope {
  return encryptJson(vaultKey, clip);
}

export function decryptClip(vaultKey: Uint8Array, envelope: EncryptedEnvelope): ClipItem {
  return decryptJson<ClipItem>(vaultKey, envelope);
}

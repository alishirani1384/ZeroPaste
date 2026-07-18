import { gcm } from "@noble/ciphers/aes.js";
import { argon2id } from "@noble/hashes/argon2.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const ARGON2_OPTS = {
  t: 3,
  m: 64 * 1024,
  p: 1,
  dkLen: 32,
} as const;

export type EncryptedEnvelope = {
  ciphertext: string;
  nonce: string;
  wrappedKey: string;
  version: 1;
};

export type WrappedKey = {
  nonce: string;
  wrapped: string;
};

function toB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

export function generateVaultKey(): Uint8Array {
  return randomBytes(32);
}

export function generateRecoveryKey(): string {
  return bytesToHex(randomBytes(32));
}

export function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Uint8Array {
  return argon2id(utf8ToBytes(passphrase), salt, ARGON2_OPTS);
}

export function deriveKeyFromRecovery(recoveryKeyHex: string, salt: Uint8Array): Uint8Array {
  return argon2id(hexToBytes(recoveryKeyHex.trim()), salt, ARGON2_OPTS);
}

/** @deprecated use deriveKeyFromPassphrase */
export const deriveVaultKey = deriveKeyFromPassphrase;
/** @deprecated use deriveKeyFromRecovery */
export const deriveVaultKeyFromRecovery = deriveKeyFromRecovery;

function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  return { nonce, ciphertext: cipher.encrypt(plaintext) };
}

function aesGcmDecrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const cipher = gcm(key, nonce);
  return cipher.decrypt(ciphertext);
}

export function wrapKey(wrappingKey: Uint8Array, contentKey: Uint8Array): WrappedKey {
  const { nonce, ciphertext } = aesGcmEncrypt(wrappingKey, contentKey);
  return { nonce: toB64(nonce), wrapped: toB64(ciphertext) };
}

export function unwrapKey(wrappingKey: Uint8Array, wrapped: WrappedKey): Uint8Array {
  return aesGcmDecrypt(wrappingKey, fromB64(wrapped.nonce), fromB64(wrapped.wrapped));
}

export function encryptPayload(vaultKey: Uint8Array, plaintext: string | Uint8Array): EncryptedEnvelope {
  const contentKey = randomBytes(32);
  const data = typeof plaintext === "string" ? utf8ToBytes(plaintext) : plaintext;
  const { nonce, ciphertext } = aesGcmEncrypt(contentKey, data);
  const wrapped = wrapKey(vaultKey, contentKey);
  return {
    version: 1,
    ciphertext: toB64(ciphertext),
    nonce: toB64(nonce),
    wrappedKey: `${wrapped.nonce}.${wrapped.wrapped}`,
  };
}

export function decryptPayload(vaultKey: Uint8Array, envelope: EncryptedEnvelope): Uint8Array {
  const [wrapNonce, wrapped] = envelope.wrappedKey.split(".");
  if (!wrapNonce || !wrapped) throw new Error("Invalid wrapped key");
  const contentKey = unwrapKey(vaultKey, { nonce: wrapNonce, wrapped });
  return aesGcmDecrypt(contentKey, fromB64(envelope.nonce), fromB64(envelope.ciphertext));
}

export function decryptPayloadText(vaultKey: Uint8Array, envelope: EncryptedEnvelope): string {
  return new TextDecoder().decode(decryptPayload(vaultKey, envelope));
}

export function encryptJson<T>(vaultKey: Uint8Array, value: T): EncryptedEnvelope {
  return encryptPayload(vaultKey, JSON.stringify(value));
}

export function decryptJson<T>(vaultKey: Uint8Array, envelope: EncryptedEnvelope): T {
  return JSON.parse(decryptPayloadText(vaultKey, envelope)) as T;
}

export { bytesToHex, hexToBytes, toB64, fromB64 };

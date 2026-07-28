import {
  fromB64,
  generateVaultKey,
  toB64,
  unwrapKey,
  wrapKey,
  type WrappedKey,
} from "@paste/crypto";
import type { LocalVaultMeta } from "@paste/sync";
import * as SecureStore from "expo-secure-store";

import { readJson, removeKey, writeJson } from "./rn-storage";

const META_KEY = "zeropaste.vault.meta";
const UNLOCK_SESSION_KEY = "zeropaste.vault.unlockSession";
const DEVICE_SECRET_KEY = "zeropaste.vault.deviceSecret";

export const UNLOCK_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

type UnlockSessionStored = {
  expiresAt: number;
  wrap: WrappedKey;
};

export async function loadVaultMeta(): Promise<LocalVaultMeta | null> {
  return readJson<LocalVaultMeta>(META_KEY);
}

export async function saveVaultMeta(meta: LocalVaultMeta) {
  await writeJson(META_KEY, meta);
}

export async function clearVaultMeta() {
  await removeKey(META_KEY);
}

/** Read existing device secret — never mints (minting on load can wipe unlock). */
async function readDeviceSecret(): Promise<Uint8Array | null> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
    if (!existing) return null;
    const bytes = fromB64(existing);
    if (bytes.length === 32) return bytes;
  } catch {
    /* corrupt / unavailable */
  }
  return null;
}

async function getOrCreateDeviceSecret(): Promise<Uint8Array> {
  const existing = await readDeviceSecret();
  if (existing) return existing;
  const secret = generateVaultKey();
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, toB64(secret));
  return secret;
}

export async function saveUnlockSession(vaultKey: Uint8Array, durationMs = UNLOCK_SESSION_MS) {
  const wrap = wrapKey(await getOrCreateDeviceSecret(), vaultKey);
  const payload: UnlockSessionStored = {
    expiresAt: Date.now() + durationMs,
    wrap,
  };
  await SecureStore.setItemAsync(UNLOCK_SESSION_KEY, JSON.stringify(payload));
}

export async function loadUnlockSession(): Promise<Uint8Array | null> {
  try {
    const raw = await SecureStore.getItemAsync(UNLOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSessionStored;
    if (!parsed?.expiresAt || !parsed?.wrap?.nonce || !parsed?.wrap?.wrapped) {
      await clearUnlockSession();
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      await clearUnlockSession();
      return null;
    }
    const secret = await readDeviceSecret();
    // Missing secret: leave unlock blob alone (SecureStore may be temporarily unavailable).
    if (!secret) return null;
    return unwrapKey(secret, parsed.wrap);
  } catch {
    // Corrupt wrap with a known secret — drop unlock only.
    await clearUnlockSession();
    return null;
  }
}

export async function clearUnlockSession() {
  try {
    await SecureStore.deleteItemAsync(UNLOCK_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

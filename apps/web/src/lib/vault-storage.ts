import {
  fromB64,
  generateVaultKey,
  toB64,
  unwrapKey,
  wrapKey,
  type WrappedKey,
} from "@paste/crypto";
import type { LocalVaultMeta } from "@paste/sync";

import { scheduleHostSessionFlush } from "@/lib/host-session";

const META_KEY = "zeropaste.vault.meta";
const UNLOCK_SESSION_KEY = "zeropaste.vault.unlockSession";
const DEVICE_SECRET_KEY = "zeropaste.vault.deviceSecret";

/** Stay unlocked across launches for this long after each unlock/create. */
export const UNLOCK_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

type UnlockSessionStored = {
  expiresAt: number;
  wrap: WrappedKey;
};

function mirror() {
  scheduleHostSessionFlush();
}

export function loadVaultMeta(): LocalVaultMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalVaultMeta;
  } catch {
    return null;
  }
}

export function saveVaultMeta(meta: LocalVaultMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  mirror();
}

export function clearVaultMeta() {
  localStorage.removeItem(META_KEY);
  mirror();
}

/** Read existing device secret — never mints (minting on load can wipe unlock). */
function readDeviceSecret(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const existing = localStorage.getItem(DEVICE_SECRET_KEY);
  if (!existing) return null;
  try {
    const bytes = fromB64(existing);
    if (bytes.length === 32) return bytes;
  } catch {
    /* corrupt */
  }
  return null;
}

function getOrCreateDeviceSecret(): Uint8Array {
  const existing = readDeviceSecret();
  if (existing) return existing;
  const secret = generateVaultKey();
  localStorage.setItem(DEVICE_SECRET_KEY, toB64(secret));
  mirror();
  return secret;
}

/** Persist vault key wrapped by a device secret until `expiresAt`. */
export function saveUnlockSession(vaultKey: Uint8Array, durationMs = UNLOCK_SESSION_MS) {
  if (typeof window === "undefined") return;
  const wrap = wrapKey(getOrCreateDeviceSecret(), vaultKey);
  const payload: UnlockSessionStored = {
    expiresAt: Date.now() + durationMs,
    wrap,
  };
  localStorage.setItem(UNLOCK_SESSION_KEY, JSON.stringify(payload));
  mirror();
}

/**
 * Restore vault key if the 7-day unlock window is still valid.
 * Does not mint a new device secret or clear the session when the secret is missing
 * (host hydrate may restore it a moment later / on next load).
 */
export function loadUnlockSession(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(UNLOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSessionStored;
    if (!parsed?.expiresAt || !parsed?.wrap?.nonce || !parsed?.wrap?.wrapped) {
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      clearUnlockSession();
      return null;
    }
    const secret = readDeviceSecret();
    if (!secret) return null;
    return unwrapKey(secret, parsed.wrap);
  } catch {
    // Corrupt wrap with a known secret — drop unlock only.
    clearUnlockSession();
    return null;
  }
}

export function clearUnlockSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UNLOCK_SESSION_KEY);
  mirror();
}

export function unlockSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(UNLOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSessionStored;
    if (!parsed?.expiresAt || Date.now() >= parsed.expiresAt) return null;
    return parsed.expiresAt;
  } catch {
    return null;
  }
}

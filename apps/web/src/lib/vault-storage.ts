import {
  fromB64,
  generateVaultKey,
  toB64,
  unwrapKey,
  wrapKey,
  type WrappedKey,
} from "@paste/crypto";
import type { LocalVaultMeta } from "@paste/sync";

const META_KEY = "zeropaste.vault.meta";
const UNLOCK_SESSION_KEY = "zeropaste.vault.unlockSession";
const DEVICE_SECRET_KEY = "zeropaste.vault.deviceSecret";

/** Stay unlocked across launches for this long after each unlock/create. */
export const UNLOCK_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

type UnlockSessionStored = {
  expiresAt: number;
  wrap: WrappedKey;
};

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
}

export function clearVaultMeta() {
  localStorage.removeItem(META_KEY);
}

function getOrCreateDeviceSecret(): Uint8Array {
  const existing = localStorage.getItem(DEVICE_SECRET_KEY);
  if (existing) {
    try {
      const bytes = fromB64(existing);
      if (bytes.length === 32) return bytes;
    } catch {
      /* recreate below */
    }
  }
  const secret = generateVaultKey();
  localStorage.setItem(DEVICE_SECRET_KEY, toB64(secret));
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
}

/** Restore vault key if the 7-day unlock window is still valid. */
export function loadUnlockSession(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(UNLOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSessionStored;
    if (!parsed?.expiresAt || !parsed?.wrap?.nonce || !parsed?.wrap?.wrapped) {
      clearUnlockSession();
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      clearUnlockSession();
      return null;
    }
    return unwrapKey(getOrCreateDeviceSecret(), parsed.wrap);
  } catch {
    clearUnlockSession();
    return null;
  }
}

export function clearUnlockSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UNLOCK_SESSION_KEY);
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

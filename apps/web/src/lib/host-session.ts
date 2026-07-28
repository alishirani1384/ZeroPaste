/**
 * Mirror vault/auth localStorage onto the desktop host (~/.zeropaste/web-session.json)
 * so Windows reboot / autostart still restores account + unlock.
 */

import { bridgeFetch } from "./bridge-client";

/** Keys we keep durable across WebView2 cold starts. */
export const DURABLE_KEY_PREFIXES = [
  "zeropaste.vault.",
  "zeropaste.auth.",
  "sb-", // Supabase auth tokens
] as const;

let hydrateDone = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

export function isDurableKey(key: string) {
  return DURABLE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function collectDurableKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  if (typeof localStorage === "undefined") return keys;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !isDurableKey(k)) continue;
    const v = localStorage.getItem(k);
    if (v != null) keys[k] = v;
  }
  return keys;
}

/** Pull host session into localStorage before Auth/Vault mount. */
export async function hydrateWebSessionFromHost(): Promise<boolean> {
  if (typeof window === "undefined") {
    hydrateDone = true;
    return false;
  }
  try {
    const res = await bridgeFetch("/web-session");
    if (!res.ok) {
      hydrateDone = true;
      return false;
    }
    const data = (await res.json()) as {
      ok?: boolean;
      session?: { keys?: Record<string, string> };
    };
    const keys = data.session?.keys ?? {};
    let applied = 0;

    const applyMissing = () => {
      for (const [k, v] of Object.entries(keys)) {
        if (!isDurableKey(k) || typeof v !== "string") continue;
        const existing = localStorage.getItem(k);
        if (existing == null || existing === "") {
          localStorage.setItem(k, v);
          applied++;
        }
      }
    };

    applyMissing();

    // WebView2 sometimes keeps a stale unlock blob but loses the device secret.
    // Force-restore the vault trio from host when the secret is missing locally.
    const secretKey = "zeropaste.vault.deviceSecret";
    const unlockKey = "zeropaste.vault.unlockSession";
    const metaKey = "zeropaste.vault.meta";
    if (
      keys[secretKey] &&
      keys[unlockKey] &&
      keys[metaKey] &&
      !localStorage.getItem(secretKey)
    ) {
      for (const k of [metaKey, secretKey, unlockKey]) {
        localStorage.setItem(k, keys[k]!);
        applied++;
      }
    }

    if (applied > 0) {
      console.info("[ZeroPaste] restored", applied, "session key(s) from host");
    }
    hydrateDone = true;
    return applied > 0;
  } catch {
    hydrateDone = true;
    return false;
  }
}

export function scheduleHostSessionFlush() {
  if (typeof window === "undefined" || !hydrateDone) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushHostSessionNow();
  }, 200);
}

export async function flushHostSessionNow() {
  if (typeof window === "undefined" || flushing) return;
  flushing = true;
  try {
    const keys = collectDurableKeys();
    await bridgeFetch("/web-session", {
      method: "POST",
      body: JSON.stringify({ keys }),
    });
  } catch {
    /* browser preview / host down */
  } finally {
    flushing = false;
  }
}

/** localStorage wrapper that also mirrors durable keys to the host. */
export function createHostMirroredStorage(): Storage {
  return {
    get length() {
      return localStorage.length;
    },
    clear() {
      localStorage.clear();
      scheduleHostSessionFlush();
    },
    getItem(key: string) {
      return localStorage.getItem(key);
    },
    key(index: number) {
      return localStorage.key(index);
    },
    removeItem(key: string) {
      localStorage.removeItem(key);
      if (isDurableKey(key)) scheduleHostSessionFlush();
    },
    setItem(key: string, value: string) {
      localStorage.setItem(key, value);
      if (isDurableKey(key)) scheduleHostSessionFlush();
    },
  };
}

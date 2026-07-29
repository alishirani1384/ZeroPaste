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
/** True only after a successful GET /web-session (or non-desktop). */
let hydrateOk = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

export function isDurableKey(key: string) {
  return DURABLE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function isHostSessionHydrated() {
  return hydrateDone;
}

export function wasHostSessionHydrateOk() {
  return hydrateOk;
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

function restoreVaultTrio(keys: Record<string, string>): number {
  const secretKey = "zeropaste.vault.deviceSecret";
  const unlockKey = "zeropaste.vault.unlockSession";
  const metaKey = "zeropaste.vault.meta";
  if (!keys[secretKey] || !keys[unlockKey] || !keys[metaKey]) return 0;

  const localSecret = localStorage.getItem(secretKey);
  const localUnlock = localStorage.getItem(unlockKey);
  const localMeta = localStorage.getItem(metaKey);
  // Only force-align when the local trio is incomplete (partial WebView state).
  if (localSecret && localUnlock && localMeta) return 0;

  let applied = 0;
  for (const k of [metaKey, secretKey, unlockKey]) {
    localStorage.setItem(k, keys[k]!);
    applied++;
  }
  return applied;
}

/** Restore Supabase auth blob from host when WebView has no `sb-*` keys. */
function restoreAuthKeys(keys: Record<string, string>): number {
  const hostAuth = Object.entries(keys).filter(
    ([k, v]) => k.startsWith("sb-") && typeof v === "string" && v.length > 0,
  );
  if (hostAuth.length === 0) return 0;

  let localHasAuth = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("sb-")) continue;
    const v = localStorage.getItem(k);
    if (v != null && v.length > 0) {
      localHasAuth = true;
      break;
    }
  }
  if (localHasAuth) return 0;

  let applied = 0;
  for (const [k, v] of hostAuth) {
    localStorage.setItem(k, v);
    applied++;
  }
  return applied;
}

/** Pull host session into localStorage before Auth/Vault mount. */
export async function hydrateWebSessionFromHost(): Promise<boolean> {
  if (typeof window === "undefined") {
    hydrateDone = true;
    hydrateOk = true;
    return false;
  }
  // Retry briefly — bridge / DPAPI can be slow right after process start.
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await bridgeFetch("/web-session");
      if (!res.ok) {
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 250 * (i + 1)));
          continue;
        }
        hydrateDone = true;
        hydrateOk = false;
        return false;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        session?: { keys?: Record<string, string> };
      };
      const keys = data.session?.keys ?? {};
      let applied = 0;

      for (const [k, v] of Object.entries(keys)) {
        if (!isDurableKey(k) || typeof v !== "string") continue;
        const existing = localStorage.getItem(k);
        if (existing == null || existing === "") {
          localStorage.setItem(k, v);
          applied++;
        }
      }

      // Force-align vault trio from host when any piece is missing or secret was lost.
      applied += restoreVaultTrio(keys);
      // Same for cloud auth — WebView often keeps vault unlock but drops `sb-*` tokens.
      applied += restoreAuthKeys(keys);

      if (applied > 0) {
        console.info("[ZeroPaste] restored", applied, "session key(s) from host");
      }
      hydrateDone = true;
      hydrateOk = true;
      return applied > 0;
    } catch {
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 250 * (i + 1)));
        continue;
      }
      hydrateDone = true;
      hydrateOk = false;
      return false;
    }
  }
  hydrateDone = true;
  hydrateOk = false;
  return false;
}

export function scheduleHostSessionFlush() {
  if (typeof window === "undefined" || !hydrateDone) return;
  // Never flush an empty/partial WebView over a good host session after a failed hydrate.
  if (!hydrateOk && Object.keys(collectDurableKeys()).length === 0) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushHostSessionNow();
  }, 200);
}

export async function flushHostSessionNow() {
  if (typeof window === "undefined" || flushing || !hydrateDone) return;
  const keys = collectDurableKeys();
  // Refuse to wipe the host blob with an empty payload after a failed hydrate.
  if (!hydrateOk && Object.keys(keys).length === 0) return;
  flushing = true;
  try {
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

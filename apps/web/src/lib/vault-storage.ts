import type { LocalVaultMeta } from "@paste/sync";

const META_KEY = "zeropaste.vault.meta";
const LOCKED_KEY = "zeropaste.vault.preferLock";

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

export function setPreferLockOnLaunch(value: boolean) {
  localStorage.setItem(LOCKED_KEY, value ? "1" : "0");
}

export function preferLockOnLaunch(): boolean {
  return localStorage.getItem(LOCKED_KEY) !== "0";
}

/** Pluggable sync/auth storage for web (`localStorage`) and React Native. */

export type SyncStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

let override: SyncStorage | null = null;

export function setSyncStorage(storage: SyncStorage | null) {
  override = storage;
}

export function getSyncStorage(): SyncStorage | null {
  if (override) return override;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncStorage } from "@paste/sync";

/** In-memory mirror so @paste/sync device helpers stay synchronous. */
const memory = new Map<string, string>();

const PERSIST_KEYS = [
  "zeropaste.device.id",
  "zeropaste.auth.offline",
  "zeropaste.vault.meta",
  "zeropaste.clips",
  "zeropaste.pinboards",
] as const;

export const rnSyncStorage: SyncStorage = {
  getItem(key) {
    const hit = memory.get(key);
    if (hit !== undefined) return hit;
    // Fall back to AsyncStorage for keys not pre-hydrated (e.g. sync cursors).
    return AsyncStorage.getItem(key).then((v) => {
      if (v != null) memory.set(key, v);
      return v;
    });
  },
  setItem(key, value) {
    memory.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
  removeItem(key) {
    memory.delete(key);
    void AsyncStorage.removeItem(key);
  },
};

export async function hydrateRnStorage() {
  const allKeys = await AsyncStorage.getAllKeys();
  const wanted = allKeys.filter(
    (k) =>
      PERSIST_KEYS.includes(k as (typeof PERSIST_KEYS)[number]) ||
      k.startsWith("zeropaste.vault.meta.") ||
      k.startsWith("zeropaste.sync.clipsCursor."),
  );
  if (wanted.length === 0) return;
  const pairs = await AsyncStorage.multiGet(wanted);
  for (const [key, value] of pairs) {
    if (key && value != null) memory.set(key, value);
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = memory.get(key) ?? (await AsyncStorage.getItem(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  await AsyncStorage.setItem(key, raw);
}

export async function removeKey(key: string) {
  memory.delete(key);
  await AsyncStorage.removeItem(key);
}

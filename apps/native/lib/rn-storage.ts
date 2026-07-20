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
    return memory.get(key) ?? null;
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
  const pairs = await AsyncStorage.multiGet([...PERSIST_KEYS]);
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

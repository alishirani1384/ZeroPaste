/**
 * Persist web vault/auth keys across reboots.
 * WebView2 localStorage alone is unreliable after Windows kill / autostart.
 * Path: ~/.zeropaste/web-session.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(homedir(), ".zeropaste");
const FILE = join(ROOT, "web-session.json");

export type WebSessionBlob = {
  version: 1;
  /** Raw localStorage key → value (vault + auth + supabase session). */
  keys: Record<string, string>;
  updatedAt: string;
};

let cache: WebSessionBlob | null = null;

function empty(): WebSessionBlob {
  return { version: 1, keys: {}, updatedAt: new Date().toISOString() };
}

export async function loadWebSession(): Promise<WebSessionBlob> {
  if (cache) return cache;
  try {
    await mkdir(ROOT, { recursive: true });
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as WebSessionBlob;
    if (parsed?.version !== 1 || typeof parsed.keys !== "object" || !parsed.keys) {
      cache = empty();
      return cache;
    }
    cache = parsed;
    return cache;
  } catch {
    cache = empty();
    return cache;
  }
}

export async function saveWebSession(keys: Record<string, string>): Promise<WebSessionBlob> {
  await mkdir(ROOT, { recursive: true });
  // Full replace — client sends the complete durable key set from localStorage.
  const next: WebSessionBlob = {
    version: 1,
    keys: { ...keys },
    updatedAt: new Date().toISOString(),
  };
  await writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
  cache = next;
  console.log(
    "[ZeroPaste] web-session saved keys=",
    Object.keys(next.keys).length,
    "vault=",
    Boolean(next.keys["zeropaste.vault.meta"]),
    "unlock=",
    Boolean(next.keys["zeropaste.vault.unlockSession"]),
  );
  return next;
}

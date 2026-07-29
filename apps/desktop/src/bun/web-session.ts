/**
 * Crash-safe encrypted persistence for web vault/auth keys.
 * Path: ~/.zeropaste/web-session.json (sealed with DPAPI / host AES key)
 */

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { atomicWriteSealed, readMaybeSealed } from "./host-crypto";

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
    const raw = await readMaybeSealed(FILE);
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
  // Refuse empty replace over an existing durable session (protects against
  // a cold WebView flushing before hydrate restored keys).
  const prev = await loadWebSession();
  const incomingCount = Object.keys(keys).length;
  if (incomingCount === 0 && Object.keys(prev.keys).length > 0) {
    console.warn("[ZeroPaste] refusing empty web-session overwrite");
    return prev;
  }

  // Guard: a refresh-race can clear sb-* from the WebView while vault keys remain.
  // Don't wipe durable auth on the host in that case (explicit sign-out clears vault unlock too).
  const merged: Record<string, string> = { ...keys };
  const incomingHasVault = Object.keys(keys).some((k) => k.startsWith("zeropaste.vault."));
  const incomingHasAuth = Object.keys(keys).some((k) => k.startsWith("sb-"));
  const prevHasAuth = Object.keys(prev.keys).some((k) => k.startsWith("sb-"));
  if (incomingHasVault && !incomingHasAuth && prevHasAuth) {
    for (const [k, v] of Object.entries(prev.keys)) {
      if (k.startsWith("sb-")) merged[k] = v;
    }
    console.warn("[ZeroPaste] preserving host auth keys missing from flush");
  }

  const next: WebSessionBlob = {
    version: 1,
    keys: merged,
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteSealed(FILE, JSON.stringify(next, null, 2));
  cache = next;
  console.log(
    "[ZeroPaste] web-session saved keys=",
    Object.keys(next.keys).length,
    "vault=",
    Boolean(next.keys["zeropaste.vault.meta"]),
    "unlock=",
    Boolean(next.keys["zeropaste.vault.unlockSession"]),
    "auth=",
    Object.keys(next.keys).some((k) => k.startsWith("sb-")),
  );
  return next;
}

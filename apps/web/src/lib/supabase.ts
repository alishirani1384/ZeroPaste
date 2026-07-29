import { createSupabase, isSupabaseConfigured, setSyncStorage, type SyncStorage } from "@paste/sync";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isDurableKey, scheduleHostSessionFlush } from "@/lib/host-session";

let mirrored = false;
let browserClient: SupabaseClient | null | undefined;

function ensureMirroredStorage() {
  if (mirrored || typeof window === "undefined") return;
  const storage: SyncStorage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      localStorage.setItem(key, value);
      if (isDurableKey(key)) scheduleHostSessionFlush();
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
      if (isDurableKey(key)) scheduleHostSessionFlush();
    },
  };
  setSyncStorage(storage);
  mirrored = true;
}

/**
 * One browser client for the whole app.
 * Creating a new client per call (old behavior) races Supabase refresh-token
 * rotation and can wipe the persisted session overnight — mobile already used a singleton.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  ensureMirroredStorage();
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isSupabaseConfigured(url, anon)) {
    browserClient = null;
    return null;
  }
  browserClient = createSupabase(url!, anon!);
  return browserClient;
}

export function supabaseConfigured() {
  return isSupabaseConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

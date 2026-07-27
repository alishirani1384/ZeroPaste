import { createSupabase, isSupabaseConfigured, setSyncStorage, type SyncStorage } from "@paste/sync";

import { isDurableKey, scheduleHostSessionFlush } from "@/lib/host-session";

let mirrored = false;

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

export function getSupabaseBrowser() {
  ensureMirroredStorage();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isSupabaseConfigured(url, anon)) return null;
  return createSupabase(url!, anon!);
}

export function supabaseConfigured() {
  return isSupabaseConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

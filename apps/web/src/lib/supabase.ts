import { createSupabase, isSupabaseConfigured } from "@paste/sync";

export function getSupabaseBrowser() {
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

import { createSupabase, isSupabaseConfigured, setSyncStorage } from "@paste/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";

import { hydrateRnStorage, rnSyncStorage } from "./rn-storage";

let client: SupabaseClient | null | undefined;
let ready: Promise<void> | null = null;
let appStateWired = false;

/**
 * Read Expo public env from the app bundle (not @paste/env workspace package —
 * Metro only inlines EXPO_PUBLIC_* into the app, so workspace packages often see undefined).
 */
function readExpoPublic(name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY"): string | undefined {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = extra?.[name];
  if (typeof fromExtra === "string" && fromExtra.length > 0) return fromExtra;
  return undefined;
}

export function supabaseConfigured() {
  return isSupabaseConfigured(
    readExpoPublic("EXPO_PUBLIC_SUPABASE_URL"),
    readExpoPublic("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

export async function ensureNativeSyncReady() {
  if (!ready) {
    ready = (async () => {
      await hydrateRnStorage();
      setSyncStorage(rnSyncStorage);
    })();
  }
  await ready;
}

export function getSupabaseNative(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = readExpoPublic("EXPO_PUBLIC_SUPABASE_URL");
  const key = readExpoPublic("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  if (!isSupabaseConfigured(url, key)) {
    client = null;
    return null;
  }
  client = createSupabase(url!, key!, {
    storage: AsyncStorage,
    detectSessionInUrl: false,
  });
  // RN: Supabase pauses auto-refresh in background; resume when active or
  // refresh tokens expire and the next launch looks "signed out".
  if (!appStateWired) {
    appStateWired = true;
    const onChange = (state: AppStateStatus) => {
      const sb = client;
      if (!sb) return;
      if (state === "active") {
        void sb.auth.startAutoRefresh();
      } else {
        void sb.auth.stopAutoRefresh();
      }
    };
    AppState.addEventListener("change", onChange);
    if (AppState.currentState === "active") {
      void client.auth.startAutoRefresh();
    }
  }
  return client;
}

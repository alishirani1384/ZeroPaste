import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { ensureNativeSyncReady, getSupabaseNative, supabaseConfigured } from "@/lib/supabase";
import { rnSyncStorage } from "@/lib/rn-storage";

type AuthContextValue = {
  configured: boolean;
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  continueOffline: () => void;
  cancelOffline: () => void;
  offlineChosen: boolean;
  readyForVault: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const OFFLINE_KEY = "zeropaste.auth.offline";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(false);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineChosen, setOfflineChosen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      await ensureNativeSyncReady();
      if (cancelled) return;

      const isConfigured = supabaseConfigured();
      setConfigured(isConfigured);

      // Desktop parity: only auto-offline when Supabase is not configured.
      // If configured, require sign-in unless the user explicitly chose offline.
      const storedOffline = rnSyncStorage.getItem(OFFLINE_KEY) === "1";
      setOfflineChosen(!isConfigured || storedOffline);

      const sb = getSupabaseNative();
      setClient(sb);
      if (!sb) {
        setLoading(false);
        return;
      }

      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        void rnSyncStorage.removeItem(OFFLINE_KEY);
        setOfflineChosen(false);
      }
      setLoading(false);

      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        if (s) {
          void rnSyncStorage.removeItem(OFFLINE_KEY);
          setOfflineChosen(false);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const sb = client ?? getSupabaseNative();
      if (!sb) throw new Error("Supabase not configured");
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [client],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const sb = client ?? getSupabaseNative();
      if (!sb) throw new Error("Supabase not configured");
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      return "Check your email to confirm, then sign in.";
    },
    [client],
  );

  const signOut = useCallback(async () => {
    const sb = client ?? getSupabaseNative();
    if (!sb) return;
    await sb.auth.signOut();
  }, [client]);

  const continueOffline = useCallback(() => {
    rnSyncStorage.setItem(OFFLINE_KEY, "1");
    setOfflineChosen(true);
  }, []);

  const cancelOffline = useCallback(() => {
    rnSyncStorage.removeItem(OFFLINE_KEY);
    setOfflineChosen(false);
  }, []);

  // Same rule as desktop: vault only after account decision.
  const readyForVault = !configured || !!session || offlineChosen;

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      client,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      continueOffline,
      cancelOffline,
      offlineChosen,
      readyForVault,
    }),
    [
      configured,
      client,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      continueOffline,
      cancelOffline,
      offlineChosen,
      readyForVault,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

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

import { getSupabaseBrowser, supabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  configured: boolean;
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  /** Local-only path: skip cloud account for this device. */
  continueOffline: () => void;
  /** Return to sign-in from offline onboarding (before vault exists / unlock). */
  cancelOffline: () => void;
  offlineChosen: boolean;
  readyForVault: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const OFFLINE_KEY = "zeropaste.auth.offline";

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = supabaseConfigured();
  const client = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [offlineChosen, setOfflineChosen] = useState(() => {
    if (typeof window === "undefined") return !configured;
    if (!configured) return true;
    return localStorage.getItem(OFFLINE_KEY) === "1";
  });

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) {
        localStorage.removeItem(OFFLINE_KEY);
        setOfflineChosen(false);
      }
    });
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        localStorage.removeItem(OFFLINE_KEY);
        setOfflineChosen(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [client]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) throw new Error("Supabase not configured");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [client],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!client) throw new Error("Supabase not configured");
      const { error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      return "Check your email to confirm, then sign in.";
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const continueOffline = useCallback(() => {
    localStorage.setItem(OFFLINE_KEY, "1");
    setOfflineChosen(true);
  }, []);

  const cancelOffline = useCallback(() => {
    localStorage.removeItem(OFFLINE_KEY);
    setOfflineChosen(false);
  }, []);

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

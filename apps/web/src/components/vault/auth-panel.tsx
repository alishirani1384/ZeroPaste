"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowser, supabaseConfigured } from "@/lib/supabase";
import { useVault } from "@/components/vault/vault-context";
import { upsertVaultProfile } from "@paste/sync";

export function AuthPanel() {
  const vault = useVault();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowser();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured()) {
    return (
      <div className="zp-auth">
        <h2>Cloud sync</h2>
        <p>
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code>apps/web/.env</code>, then apply <code>supabase/migrations</code>.
        </p>
        <p className="zp-auth-muted">Local E2E vault still protects clips on this device.</p>
      </div>
    );
  }

  const client = getSupabaseBrowser()!;

  const signIn = async (mode: "signin" | "signup") => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm, then sign in.");
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user && vault.meta) {
          await upsertVaultProfile(client, data.user.id, vault.meta.saltB64);
        }
        setMessage("Signed in — encrypted sync enabled.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="zp-auth">
      <h2>Cloud sync</h2>
      {session ? (
        <>
          <p>
            Signed in as <strong>{session.user.email}</strong>. Clips sync as ciphertext only.
          </p>
          <button
            type="button"
            className="zp-gate-primary"
            onClick={() => void client.auth.signOut()}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>Sign in to sync encrypted history across Windows, Linux, and Android.</p>
          <label className="zp-gate-field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>
          <label className="zp-gate-field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
          </label>
          <div className="zp-auth-actions">
            <button
              type="button"
              className="zp-gate-primary"
              disabled={busy}
              onClick={() => void signIn("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className="zp-auth-secondary"
              disabled={busy}
              onClick={() => void signIn("signup")}
            >
              Create account
            </button>
          </div>
        </>
      )}
      {message ? <p className="zp-auth-muted">{message}</p> : null}
    </div>
  );
}

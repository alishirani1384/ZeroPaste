"use client";

import { useEffect, useState } from "react";
import { upsertVaultMetaBlob } from "@paste/sync";

import { PasswordField } from "@/components/password-field";
import { useVault } from "@/components/vault/vault-context";
import { getAutostartEnabled, setAutostartEnabled } from "@/lib/bridge";
import { useAuth } from "@/lib/auth-session";

export function AuthPanel() {
  const auth = useAuth();
  const vault = useVault();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAutostartEnabled().then((enabled) => {
      if (!cancelled) setAutostart(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!auth.configured) {
    return (
      <div className="zp-auth">
        <h2>Cloud sync</h2>
        <p>
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code>apps/web/.env</code>, then apply <code>supabase/migrations</code>.
        </p>
        <p className="zp-auth-muted">Local E2E vault still protects clips on this device.</p>
        {autostart !== null ? (
          <label className="zp-auth-toggle">
            <input
              type="checkbox"
              checked={autostart}
              disabled={autostartBusy}
              onChange={(e) => {
                const next = e.target.checked;
                setAutostartBusy(true);
                void setAutostartEnabled(next).then((ok) => {
                  if (ok) setAutostart(next);
                  setAutostartBusy(false);
                });
              }}
            />
            <span>Start ZeroPaste when this device boots</span>
          </label>
        ) : null}
      </div>
    );
  }

  const signIn = async (mode: "signin" | "signup") => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const msg = await auth.signUp(email, password);
        setMessage(msg);
      } else {
        await auth.signIn(email, password);
        if (auth.client && vault.meta) {
          const {
            data: { session },
          } = await auth.client.auth.getSession();
          if (session) {
            await upsertVaultMetaBlob(auth.client, session.user.id, vault.meta);
          }
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
      <h2>Account & sync</h2>
      {auth.session ? (
        <>
          <p>
            Signed in as <strong>{auth.session.user.email}</strong>. Clips, pinboards, and this
            device sync to your account.
          </p>
          <button type="button" className="zp-gate-primary" onClick={() => void auth.signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>
            {auth.offlineChosen
              ? "You are offline. Sign in to sync encrypted history across devices."
              : "Sign in to sync encrypted history across Windows, Linux, and Android."}
          </p>
          <label className="zp-gate-field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
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
      {autostart !== null ? (
        <label className="zp-auth-toggle">
          <input
            type="checkbox"
            checked={autostart}
            disabled={autostartBusy}
            onChange={(e) => {
              const next = e.target.checked;
              setAutostartBusy(true);
              void setAutostartEnabled(next).then((ok) => {
                if (ok) setAutostart(next);
                setAutostartBusy(false);
              });
            }}
          />
          <span>Start ZeroPaste when this device boots</span>
        </label>
      ) : null}
      {message ? <p className="zp-auth-muted">{message}</p> : null}
    </div>
  );
}

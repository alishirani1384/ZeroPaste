"use client";

import { useEffect, useState } from "react";
import { resolveVaultForUser, safeUpsertVaultMetaBlob } from "@paste/sync";

import { PasswordField } from "@/components/password-field";
import { useVault } from "@/components/vault/vault-context";
import { getAutostartEnabled, setAutostartEnabled } from "@/lib/bridge";
import { useAuth } from "@/lib/auth-session";
import { clearSignedOutMark } from "@/lib/vault-storage";

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
    // Defer so Account sheet paint isn't blocked; host reads pref file (no console spawn).
    let cancelled = false;
    const t = window.setTimeout(() => {
      void getAutostartEnabled().then((enabled) => {
        if (!cancelled) setAutostart(enabled);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!auth.configured) {
    return (
      <div className="zp-auth">
        <h2>Cloud sync</h2>
        <p>
          Add Supabase keys in <code>apps/web/.env</code> to enable sync. Your local vault still
          protects clips on this device.
        </p>
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
        clearSignedOutMark();
        if (auth.client) {
          const {
            data: { session },
          } = await auth.client.auth.getSession();
          if (session) {
            const parked = vault.loadParkedForUser(session.user.id);
            const resolved = await resolveVaultForUser(
              auth.client,
              session.user.id,
              parked ?? vault.meta,
            );
            vault.applyBoundMeta(resolved.meta, { clearUnlock: resolved.mustRelock });
            if (resolved.source === "cloud" && resolved.mustRelock) {
              setMessage("Found an existing cloud vault — unlock with that vault's passphrase.");
              return;
            }
            if (resolved.meta && vault.unlocked) {
              const up = await safeUpsertVaultMetaBlob(
                auth.client,
                session.user.id,
                resolved.meta,
              );
              if (up === "conflict") {
                setMessage("Cloud vault differs — lock and unlock with your account passphrase.");
                return;
              }
            }
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
      <h2>Account</h2>
      {auth.session ? (
        <>
          <p>
            Signed in as <strong>{auth.session.user.email}</strong>
          </p>
          <p className="zp-auth-muted">
            Clips and pinboards sync encrypted to your account.
          </p>
          <button
            type="button"
            className="zp-gate-primary"
            onClick={() => {
              vault.prepareSignOut();
              void auth.signOut();
            }}
          >
            Sign Out
          </button>
        </>
      ) : (
        <>
          <p>
            {auth.offlineChosen
              ? "You’re offline. Sign in anytime to sync encrypted history."
              : "Sign in to sync encrypted history across your devices."}
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

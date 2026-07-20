"use client";

import { useEffect, useMemo, useState } from "react";
import { GripHorizontal, KeyRound, ShieldCheck } from "lucide-react";

import { PasswordField } from "@/components/password-field";
import { setDesktopWindowMode } from "@/lib/bridge";
import { supabaseConfigured } from "@/lib/supabase";
import { windowDragHandlers } from "@/lib/window-drag";

import { useVault } from "./vault-context";

export function VaultGate({ children }: { children: React.ReactNode }) {
  const vault = useVault();
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useMemo(() => windowDragHandlers(), []);

  const showingGate = !vault.unlocked || Boolean(vault.recoveryKeyOnce);

  useEffect(() => {
    // Single mode switch — spam placeWindow(panel) was crashing Electrobun (exit 3).
    const t = window.setTimeout(() => {
      void setDesktopWindowMode(showingGate ? "vault" : "panel");
    }, 80);
    return () => window.clearTimeout(t);
  }, [showingGate]);

  if (vault.unlocked && vault.recoveryKeyOnce) {
    return (
      <div className="zp-gate zp-gate--modal">
        <div className="zp-gate-stack">
          <div className="zp-gate-drag" {...drag}>
            <GripHorizontal className="size-4 opacity-50" />
            <span>Drag to move</span>
          </div>
          <div className="zp-gate-card">
            <div className="zp-gate-icon">
              <ShieldCheck className="size-6" />
            </div>
            <h1>Save your recovery key</h1>
            <p>
              This is the only way to regain access if you forget your vault passphrase. ZeroPaste
              cannot recover it for you.
            </p>
            <code className="zp-recovery">{vault.recoveryKeyOnce}</code>
            <button
              type="button"
              className="zp-gate-primary"
              onClick={() => {
                void navigator.clipboard?.writeText(vault.recoveryKeyOnce!);
                vault.clearRecoveryKeyOnce();
              }}
            >
              Copied — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vault.unlocked) return <>{children}</>;

  const isSetup = !vault.meta;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isSetup) {
        if (pass.length < 8) throw new Error("Use at least 8 characters");
        if (pass !== pass2) throw new Error("Passphrases do not match");
        vault.setupVault(pass);
      } else if (mode === "recovery") {
        vault.unlockRecovery(pass);
      } else {
        vault.unlock(pass);
      }
      setPass("");
      setPass2("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="zp-gate zp-gate--modal">
      <div className="zp-gate-stack">
        <div className="zp-gate-drag" {...drag}>
          <GripHorizontal className="size-4 opacity-50" />
          <span>ZeroPaste · hold here and drag</span>
        </div>
        <div className="zp-gate-card">
          <div className="zp-gate-icon">
            <KeyRound className="size-6" />
          </div>
          <h1>{isSetup ? "Create your vault" : "Unlock ZeroPaste"}</h1>
          <p>
            {isSetup
              ? "E2E encryption is always on. Your passphrase never leaves this device."
              : "Enter your vault passphrase to decrypt your clipboard history."}
          </p>
          {!supabaseConfigured() && (
            <p className="zp-gate-note">
              Local vault mode — add <code>NEXT_PUBLIC_SUPABASE_URL</code> and anon key to enable
              sync.
            </p>
          )}

          {!isSetup && (
            <div className="zp-gate-tabs">
              <button
                type="button"
                className={mode === "passphrase" ? "active" : ""}
                onClick={() => setMode("passphrase")}
              >
                Passphrase
              </button>
              <button
                type="button"
                className={mode === "recovery" ? "active" : ""}
                onClick={() => setMode("recovery")}
              >
                Recovery key
              </button>
            </div>
          )}

          <PasswordField
            label={isSetup || mode === "passphrase" ? "Vault passphrase" : "Recovery key"}
            value={pass}
            onChange={setPass}
            autoComplete={isSetup ? "new-password" : "current-password"}
            revealAlways={mode === "recovery" && !isSetup}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />

          {isSetup ? (
            <PasswordField
              label="Confirm passphrase"
              value={pass2}
              onChange={setPass2}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          ) : null}

          {error ? <p className="zp-gate-error">{error}</p> : null}

          <button
            type="button"
            className="zp-gate-primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Working…" : isSetup ? "Create vault" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

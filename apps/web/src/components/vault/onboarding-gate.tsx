"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Cloud, GripHorizontal, HardDrive, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { fetchVaultMetaBlob, upsertVaultMetaBlob } from "@paste/sync";
import { toast } from "sonner";

import { PasswordField } from "@/components/password-field";
import { WindowCloseButton } from "@/components/window-close-button";
import { setDesktopWindowMode, suppressCapture } from "@/lib/bridge";
import { useAuth } from "@/lib/auth-session";
import { saveVaultMeta } from "@/lib/vault-storage";
import { windowDragHandlers } from "@/lib/window-drag";

import { useVault } from "./vault-context";

function GateDragBar({ label, drag }: { label: string; drag: ReturnType<typeof windowDragHandlers> }) {
  return (
    <div className="zp-gate-drag" {...drag}>
      <GripHorizontal className="size-4 opacity-50" />
      <span>{label}</span>
      <WindowCloseButton className="zp-gate-close" title="Close window" />
    </div>
  );
}

/**
 * Journey: Account (optional offline) → Vault create / unlock / cloud restore → shelf.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const vault = useVault();
  const drag = useMemo(() => windowDragHandlers(), []);
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  /** idle = not needed / not started; loading = probing; found/none = resolved */
  const [cloudProbe, setCloudProbe] = useState<"idle" | "loading" | "found" | "none">("idle");
  const probeForUser = useRef<string | null>(null);

  const showingGate = !vault.unlocked || Boolean(vault.recoveryKeyOnce);
  const needAuth = auth.configured && !auth.readyForVault;

  // Keep vault mode while any gate is up — no delay (delay let the first paint flash wrong chrome).
  useEffect(() => {
    void setDesktopWindowMode(showingGate || needAuth || auth.loading ? "vault" : "panel");
  }, [showingGate, needAuth, auth.loading]);

  const adoptMeta = vault.adoptMeta;

  /** Probe cloud for vault meta. Returns whether a vault was found. */
  const probeCloudVault = async (userId: string): Promise<boolean> => {
    if (!auth.client) {
      setCloudProbe("none");
      return false;
    }
    // Already resolved for this user.
    if (probeForUser.current === userId && vault.meta) {
      setCloudProbe("found");
      return true;
    }
    probeForUser.current = userId;
    setCloudProbe("loading");
    try {
      const meta = await fetchVaultMetaBlob(auth.client, userId);
      if (meta) {
        saveVaultMeta(meta);
        adoptMeta(meta);
        setCloudProbe("found");
        return true;
      }
      setCloudProbe("none");
      return false;
    } catch (err) {
      console.warn("[ZeroPaste] vault cloud restore probe failed", err);
      setCloudProbe("none");
      return false;
    }
  };

  // Boot / existing session: probe before showing create vs unlock.
  useEffect(() => {
    if (!auth.session || !auth.client || vault.meta || vault.unlocked) return;
    if (probeForUser.current === auth.session.user.id) return;
    if (cloudProbe === "loading") return; // sign-in handler already probing
    void probeCloudVault(auth.session.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probe once per signed-in user without local meta
  }, [auth.session, auth.client, vault.meta, vault.unlocked, cloudProbe]);

  // Upload vault wraps once after create/unlock (not while recovery key is still on screen).
  const uploadedMetaFor = useRef<string | null>(null);
  useEffect(() => {
    if (!vault.unlocked || vault.recoveryKeyOnce || !vault.meta || !auth.session || !auth.client) {
      return;
    }
    const uid = auth.session.user.id;
    if (uploadedMetaFor.current === uid) return;
    uploadedMetaFor.current = uid;
    void upsertVaultMetaBlob(auth.client, uid, vault.meta).catch((err) => {
      console.warn("[ZeroPaste] vault meta upload failed", err);
      uploadedMetaFor.current = null;
      toast.error(
        "Could not save vault to cloud — run migration 20260719100000_vault_meta.sql in Supabase",
        { duration: 7000 },
      );
    });
  }, [vault.unlocked, vault.recoveryKeyOnce, vault.meta, auth.session, auth.client]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    setAuthMsg(null);
    setCloudProbe("loading");
    try {
      await auth.signIn(email, password);
      // Session is set; resolve create vs unlock before leaving the auth chrome.
      const client = auth.client;
      if (client && !vault.meta) {
        const {
          data: { session },
        } = await client.auth.getSession();
        const uid = session?.user.id;
        if (uid) await probeCloudVault(uid);
      } else {
        setCloudProbe("idle");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setCloudProbe("idle");
      probeForUser.current = null;
    } finally {
      setBusy(false);
    }
  };

  if (auth.loading) {
    return (
      <div className="zp-gate zp-gate--modal">
        <div className="zp-gate-stack">
          <GateDragBar label="ZeroPaste · starting…" drag={drag} />
          <div className="zp-gate-card zp-gate-card--loading">
            <div className="zp-gate-icon">
              <Cloud className="size-6" />
            </div>
            <h1>Starting ZeroPaste</h1>
            <p>Checking your account session…</p>
          </div>
        </div>
      </div>
    );
  }

  if (needAuth) {
    return (
      <div className="zp-gate zp-gate--modal">
        <div className="zp-gate-stack">
          <GateDragBar label="ZeroPaste · drag to move" drag={drag} />
          <div className="zp-gate-card zp-gate-card--auth">
            <div className="zp-gate-icon">
              <Cloud className="size-6" />
            </div>
            <h1>Sign in to sync</h1>
            <p>Account for sync. Vault passphrase stays separate and E2E.</p>
            <label className="zp-gate-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={busy}
            />
            {error ? <p className="zp-gate-error">{error}</p> : null}
            {authMsg ? <p className="zp-gate-note">{authMsg}</p> : null}
            <div className="zp-auth-actions">
              <button
                type="button"
                className="zp-gate-primary"
                disabled={busy}
                onClick={() => void signIn()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
              <button
                type="button"
                className="zp-auth-secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void auth
                    .signUp(email, password)
                    .then((msg) => setAuthMsg(msg))
                    .catch((e) => setError(e instanceof Error ? e.message : "Sign up failed"))
                    .finally(() => setBusy(false));
                }}
              >
                Create account
              </button>
            </div>
            <div className="zp-auth-divider" role="separator">
              <span>or</span>
            </div>
            <button
              type="button"
              className="zp-auth-offline"
              disabled={busy}
              onClick={() => {
                setError(null);
                setAuthMsg(null);
                auth.continueOffline();
              }}
            >
              <HardDrive className="size-4" aria-hidden />
              <span>
                <strong>Use without account</strong>
                <small>On this device only — sign in later anytime</small>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, no local vault yet — wait for cloud probe before create/unlock UI.
  const awaitingCloudVault =
    Boolean(auth.session) && !vault.meta && !vault.unlocked && cloudProbe !== "none";

  if (awaitingCloudVault) {
    return (
      <div className="zp-gate zp-gate--modal">
        <div className="zp-gate-stack">
          <GateDragBar label="ZeroPaste · starting…" drag={drag} />
          <div className="zp-gate-card zp-gate-card--loading">
            <div className="zp-gate-icon">
              <Loader2 className="size-6 animate-spin" />
            </div>
            <h1>Checking cloud vault…</h1>
            <p>Looking for an existing encrypted vault on your account.</p>
          </div>
        </div>
      </div>
    );
  }

  if (vault.unlocked && vault.recoveryKeyOnce) {
    return (
      <div className="zp-gate zp-gate--modal">
        <div className="zp-gate-stack">
          <GateDragBar label="Drag to move" drag={drag} />
          <div className="zp-gate-card">
            <div className="zp-gate-icon">
              <ShieldCheck className="size-6" />
            </div>
            <h1>Save your recovery key</h1>
            <p>
              This is the only way to regain access if you forget your vault passphrase. Store it
              offline — it will not be kept in clipboard history.
            </p>
            <code className="zp-recovery">{vault.recoveryKeyOnce}</code>
            <button
              type="button"
              className="zp-gate-primary"
              onClick={() => {
                void (async () => {
                  await suppressCapture(8000);
                  try {
                    await navigator.clipboard?.writeText(vault.recoveryKeyOnce!);
                  } catch {
                    /* ignore */
                  }
                  vault.clearRecoveryKeyOnce();
                })();
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
  const title = isSetup ? "Create your vault" : "Unlock ZeroPaste";

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
        <GateDragBar label="ZeroPaste · hold here and drag" drag={drag} />
        <div className="zp-gate-card">
          <div className="zp-gate-icon">
            <KeyRound className="size-6" />
          </div>
          <h1>{title}</h1>
          <p>
            {isSetup
              ? "E2E encryption is always on. Your passphrase never leaves this device. After setup you stay unlocked for 7 days."
              : "Enter your vault passphrase. You’ll stay unlocked for 7 days on this device."}
          </p>
          {auth.session ? (
            <p className="zp-gate-note">Signed in as {auth.session.user.email}</p>
          ) : auth.offlineChosen ? (
            <p className="zp-gate-note">Offline mode — sync disabled until you sign in.</p>
          ) : null}

          {auth.configured && auth.offlineChosen && !auth.session ? (
            <button
              type="button"
              className="zp-gate-back"
              onClick={() => {
                setError(null);
                setPass("");
                setPass2("");
                auth.cancelOffline();
              }}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to sign in
            </button>
          ) : null}

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
            label={isSetup ? "Vault passphrase" : mode === "recovery" ? "Recovery key" : "Vault passphrase"}
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

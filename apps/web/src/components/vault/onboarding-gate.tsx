"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { fetchVaultMetaBlob, upsertVaultMetaBlob } from "@paste/sync";
import { toast } from "sonner";

import { PasswordField } from "@/components/password-field";
import { WindowCloseButton } from "@/components/window-close-button";
import { useDesktopWindowFit } from "@/components/desktop-window-fit";
import { setDesktopWindowMode, suppressCapture } from "@/lib/bridge";
import { fitDesktopWindow } from "@/lib/window-fit";
import { useAuth } from "@/lib/auth-session";
import { saveVaultMeta } from "@/lib/vault-storage";
import { windowDragHandlers } from "@/lib/window-drag";

import { useVault } from "./vault-context";

type GateStep = "account" | "vault" | "recovery";
type MarkTone = "brand" | "tint" | "success" | "quiet";

const STEPS: { id: GateStep; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "vault", label: "Vault" },
  { id: "recovery", label: "Key" },
];

function stepIndex(step: GateStep) {
  return STEPS.findIndex((s) => s.id === step);
}

function passphraseStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

function GateMark({
  tone = "brand",
  children,
}: {
  tone?: MarkTone;
  children: ReactNode;
}) {
  const cls =
    tone === "tint"
      ? "zp-gate-mark zp-gate-mark--tint"
      : tone === "success"
        ? "zp-gate-mark zp-gate-mark--success"
        : tone === "quiet"
          ? "zp-gate-mark zp-gate-mark--quiet"
          : "zp-gate-mark";
  return <div className={cls}>{children}</div>;
}

function GateSteps({ current }: { current: GateStep }) {
  const active = stepIndex(current);
  return (
    <nav className="zp-gate-steps" aria-label="Setup progress">
      {STEPS.map((s, i) => (
        <div key={s.id} style={{ display: "contents" }}>
          {i > 0 ? <span className="zp-gate-step-sep" aria-hidden /> : null}
          <div
            className="zp-gate-step"
            data-active={i === active}
            data-done={i < active}
          >
            <span className="zp-gate-step-dot" aria-hidden />
            <span>{s.label}</span>
          </div>
        </div>
      ))}
    </nav>
  );
}

function GateShell({
  stackRef,
  drag,
  title,
  step,
  showSteps,
  cardClassName,
  children,
}: {
  stackRef: React.RefObject<HTMLDivElement | null>;
  drag: ReturnType<typeof windowDragHandlers>;
  title: string;
  step?: GateStep;
  showSteps?: boolean;
  cardClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="zp-gate zp-gate--modal">
      <div className="zp-gate-stack" ref={stackRef}>
        <div className="zp-gate-drag">
          <div className="zp-gate-drag-hit" {...drag}>
            <span>{title}</span>
          </div>
          <WindowCloseButton className="zp-gate-close" title="Close window" />
        </div>
        {showSteps && step ? <GateSteps current={step} /> : null}
        <div className={`zp-gate-card ${cardClassName ?? ""}`.trim()}>
          <div key={step ?? title} className="zp-gate-enter">
            {children}
          </div>
        </div>
      </div>
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
  const stackRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
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

  const gateRevision = auth.loading
    ? "boot"
    : needAuth
      ? `auth-${authMode}`
      : vault.recoveryKeyOnce
        ? "recovery-key"
        : !vault.meta
          ? cloudProbe === "loading" || cloudProbe === "idle"
            ? "cloud-probe"
            : "setup"
          : mode;

  useDesktopWindowFit(
    stackRef,
    "vault",
    showingGate || needAuth || auth.loading,
    gateRevision,
  );

  // Immediate fit on step change (don't wait for ResizeObserver debounce).
  useEffect(() => {
    if (!(showingGate || needAuth || auth.loading)) return;
    const id = window.requestAnimationFrame(() => {
      const el = stackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;
      void fitDesktopWindow({
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        anchor: "center",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [gateRevision, showingGate, needAuth, auth.loading]);

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

  const signUp = async () => {
    setBusy(true);
    setError(null);
    setAuthMsg(null);
    try {
      const msg = await auth.signUp(email, password);
      setAuthMsg(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  if (auth.loading) {
    return (
      <GateShell
        stackRef={stackRef}
        drag={drag}
        title="ZeroPaste"
        cardClassName="zp-gate-card--loading"
      >
        <GateMark tone="quiet">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </GateMark>
        <h1>Starting…</h1>
        <p className="zp-gate-lede">Checking your session</p>
      </GateShell>
    );
  }

  if (needAuth) {
    return (
      <GateShell
        stackRef={stackRef}
        drag={drag}
        title="ZeroPaste"
        step="account"
        showSteps
        cardClassName="zp-gate-card--auth"
      >
        <GateMark>
          <Lock className="size-6" strokeWidth={1.75} aria-hidden />
        </GateMark>
        <p className="zp-gate-eyebrow">Welcome</p>
        <h1>Sign in to sync</h1>
        <p className="zp-gate-lede">
          Your account syncs clips. Your vault passphrase never leaves this device.
        </p>

        <div className="zp-gate-tabs" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "signin"}
            className={authMode === "signin" ? "active" : ""}
            onClick={() => {
              setAuthMode("signin");
              setError(null);
              setAuthMsg(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "signup"}
            className={authMode === "signup" ? "active" : ""}
            onClick={() => {
              setAuthMode("signup");
              setError(null);
              setAuthMsg(null);
            }}
          >
            Create Account
          </button>
        </div>

        <label className="zp-gate-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void (authMode === "signin" ? signIn() : signUp());
            }}
          />
        </label>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={authMode === "signin" ? "current-password" : "new-password"}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") void (authMode === "signin" ? signIn() : signUp());
          }}
        />
        {error ? <p className="zp-gate-error">{error}</p> : null}
        {authMsg ? <p className="zp-gate-note">{authMsg}</p> : null}

        <button
          type="button"
          className="zp-gate-primary"
          disabled={busy}
          onClick={() => void (authMode === "signin" ? signIn() : signUp())}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {authMode === "signin" ? "Signing in…" : "Creating…"}
            </>
          ) : authMode === "signin" ? (
            "Continue"
          ) : (
            "Create Account"
          )}
        </button>

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
          <HardDrive className="size-5" aria-hidden />
          <span>
            <strong>Continue on this device</strong>
            <small>No account — sync anytime later</small>
          </span>
        </button>
      </GateShell>
    );
  }

  // Signed in, no local vault yet — wait for cloud probe before create/unlock UI.
  const awaitingCloudVault =
    Boolean(auth.session) && !vault.meta && !vault.unlocked && cloudProbe !== "none";

  if (awaitingCloudVault) {
    return (
      <GateShell
        stackRef={stackRef}
        drag={drag}
        title="ZeroPaste"
        step="vault"
        showSteps
        cardClassName="zp-gate-card--loading"
      >
        <GateMark tone="quiet">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </GateMark>
        <h1>Looking for your vault</h1>
        <p className="zp-gate-lede">Checking the cloud for an encrypted vault on this account</p>
      </GateShell>
    );
  }

  if (vault.unlocked && vault.recoveryKeyOnce) {
    return (
      <GateShell
        stackRef={stackRef}
        drag={drag}
        title="ZeroPaste"
        step="recovery"
        showSteps
      >
        <GateMark tone="success">
          <ShieldCheck className="size-6" strokeWidth={1.75} aria-hidden />
        </GateMark>
        <p className="zp-gate-eyebrow">Almost done</p>
        <h1>Save your recovery key</h1>
        <p className="zp-gate-lede">
          This is the only way back in if you forget your passphrase. Keep it offline.
        </p>
        <div className="zp-recovery-warn">
          <TriangleAlert className="size-4" aria-hidden />
          <span>ZeroPaste never stores this key. Copy it somewhere safe before continuing.</span>
        </div>
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
          Copy & Continue
        </button>
      </GateShell>
    );
  }

  if (vault.unlocked) return <>{children}</>;

  const isSetup = !vault.meta;
  const strength = isSetup ? passphraseStrength(pass) : 0;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isSetup) {
        if (pass.length < 8) throw new Error("Use at least 8 characters");
        if (pass !== pass2) throw new Error("Passphrases do not match");
        await vault.setupVault(pass);
      } else if (mode === "recovery") {
        await vault.unlockRecovery(pass);
      } else {
        await vault.unlock(pass);
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
    <GateShell
      stackRef={stackRef}
      drag={drag}
      title="ZeroPaste"
      step="vault"
      showSteps
    >
      <GateMark tone="tint">
        <KeyRound className="size-6" strokeWidth={1.75} aria-hidden />
      </GateMark>
      <p className="zp-gate-eyebrow">{isSetup ? "End-to-end" : "Welcome back"}</p>
      <h1>{isSetup ? "Create your vault" : "Unlock ZeroPaste"}</h1>
      <p className="zp-gate-lede">
        {isSetup
          ? "Choose a passphrase only you know. Encryption stays on this device — for 7 days after unlock."
          : mode === "recovery"
            ? "Enter your recovery key to regain access."
            : "Enter your vault passphrase. You’ll stay unlocked for 7 days on this device."}
      </p>

      {auth.session ? (
        <p className="zp-gate-note">{auth.session.user.email}</p>
      ) : auth.offlineChosen ? (
        <p className="zp-gate-note">Offline — sync is off until you sign in</p>
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
        <div className="zp-gate-tabs" role="tablist" aria-label="Unlock method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "passphrase"}
            className={mode === "passphrase" ? "active" : ""}
            onClick={() => {
              setMode("passphrase");
              setError(null);
              setPass("");
            }}
          >
            Passphrase
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "recovery"}
            className={mode === "recovery" ? "active" : ""}
            onClick={() => {
              setMode("recovery");
              setError(null);
              setPass("");
            }}
          >
            Recovery Key
          </button>
        </div>
      )}

      <PasswordField
        label={
          isSetup ? "Passphrase" : mode === "recovery" ? "Recovery key" : "Passphrase"
        }
        value={pass}
        onChange={setPass}
        autoComplete={isSetup ? "new-password" : "current-password"}
        revealAlways={mode === "recovery" && !isSetup}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />

      {isSetup && strength > 0 ? (
        <div
          className="zp-gate-strength"
          data-level={strength}
          aria-hidden
        >
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {isSetup ? (
        <PasswordField
          label="Confirm"
          value={pass2}
          onChange={setPass2}
          autoComplete="new-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
      ) : null}

      {isSetup ? (
        <p className="zp-gate-hint">At least 8 characters. A longer phrase is stronger.</p>
      ) : null}

      {error ? <p className="zp-gate-error">{error}</p> : null}

      <button
        type="button"
        className="zp-gate-primary"
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Working…
          </>
        ) : isSetup ? (
          "Create Vault"
        ) : (
          "Unlock"
        )}
      </button>
    </GateShell>
  );
}

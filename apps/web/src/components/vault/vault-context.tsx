"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearClipsPullCursor,
  createOwnedLocalVault,
  unlockWithPassphrase,
  unlockWithRecovery,
  withVaultOwner,
  type LocalVaultMeta,
} from "@paste/sync";

import {
  clearSignedOutMark,
  clearUnlockSession,
  clearVaultMeta,
  loadParkedVaultMeta,
  loadUnlockSession,
  loadVaultMeta,
  markSignedOut,
  parkAndClearActiveVault,
  saveUnlockSession,
  saveVaultMeta,
} from "@/lib/vault-storage";

type VaultContextValue = {
  meta: LocalVaultMeta | null;
  vaultKey: Uint8Array | null;
  unlocked: boolean;
  recoveryKeyOnce: string | null;
  clearRecoveryKeyOnce: () => void;
  setupVault: (passphrase: string, ownerUserId?: string | null) => Promise<void>;
  unlock: (passphrase: string, ownerUserId?: string | null) => Promise<void>;
  unlockRecovery: (recoveryKey: string, ownerUserId?: string | null) => Promise<void>;
  lock: () => void;
  /** Adopt vault meta restored from cloud (not yet unlocked). */
  adoptMeta: (meta: LocalVaultMeta) => void;
  /**
   * Bind local vault to signed-in user: load parked slot or apply resolved meta.
   * Clears unlock when the vault identity changes.
   */
  applyBoundMeta: (meta: LocalVaultMeta | null, opts?: { clearUnlock?: boolean }) => void;
  /** Load parked meta for user without probing cloud (may be null). */
  loadParkedForUser: (userId: string) => LocalVaultMeta | null;
  /** Park active vault, lock, and mark intentional sign-out for host session. */
  prepareSignOut: () => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

function rememberUnlocked(key: Uint8Array) {
  saveUnlockSession(key);
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<LocalVaultMeta | null>(() => loadVaultMeta());
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(() => loadUnlockSession());
  const [recoveryKeyOnce, setRecoveryKeyOnce] = useState<string | null>(null);

  const setupVault = useCallback(async (passphrase: string, ownerUserId?: string | null) => {
    const created = await createOwnedLocalVault(passphrase, ownerUserId);
    saveVaultMeta(created.meta);
    setMeta(created.meta);
    setVaultKey(created.vaultKey);
    rememberUnlocked(created.vaultKey);
    setRecoveryKeyOnce(created.recoveryKey);
    clearSignedOutMark();
  }, []);

  const adoptMeta = useCallback((next: LocalVaultMeta) => {
    const current = meta ?? loadVaultMeta();
    saveVaultMeta(next);
    setMeta(next);
    if (!current || current.saltB64 !== next.saltB64) {
      clearUnlockSession();
      setVaultKey(null);
      if (next.ownerUserId) {
        void clearClipsPullCursor(next.ownerUserId);
      }
    }
  }, [meta]);

  const applyBoundMeta = useCallback(
    (next: LocalVaultMeta | null, opts?: { clearUnlock?: boolean }) => {
      const current = meta ?? loadVaultMeta();
      const clearUnlock =
        opts?.clearUnlock ??
        (!next || !current || current.saltB64 !== next.saltB64 || current.ownerUserId !== next.ownerUserId);

      if (next) {
        saveVaultMeta(next);
        setMeta(next);
      } else {
        clearVaultMeta();
        setMeta(null);
      }

      if (clearUnlock) {
        clearUnlockSession();
        setVaultKey(null);
        setRecoveryKeyOnce(null);
        if (next?.ownerUserId) void clearClipsPullCursor(next.ownerUserId);
        if (current?.ownerUserId && current.ownerUserId !== next?.ownerUserId) {
          void clearClipsPullCursor(current.ownerUserId);
        }
      }
    },
    [meta],
  );

  const loadParkedForUser = useCallback((userId: string) => loadParkedVaultMeta(userId), []);

  const unlock = useCallback(
    async (passphrase: string, ownerUserId?: string | null) => {
      const current = meta ?? loadVaultMeta();
      if (!current) throw new Error("No vault found");
      const key = await unlockWithPassphrase(current, passphrase);
      const owned =
        ownerUserId || current.ownerUserId
          ? withVaultOwner(current, ownerUserId ?? current.ownerUserId)
          : current;
      if (owned !== current) saveVaultMeta(owned);
      setMeta(owned);
      setVaultKey(key);
      rememberUnlocked(key);
      clearSignedOutMark();
    },
    [meta],
  );

  const unlockRecovery = useCallback(
    async (recoveryKey: string, ownerUserId?: string | null) => {
      const current = meta ?? loadVaultMeta();
      if (!current) throw new Error("No vault found");
      const key = await unlockWithRecovery(current, recoveryKey);
      const owned =
        ownerUserId || current.ownerUserId
          ? withVaultOwner(current, ownerUserId ?? current.ownerUserId)
          : current;
      if (owned !== current) saveVaultMeta(owned);
      setMeta(owned);
      setVaultKey(key);
      rememberUnlocked(key);
      clearSignedOutMark();
    },
    [meta],
  );

  const lock = useCallback(() => {
    clearUnlockSession();
    setVaultKey(null);
  }, []);

  const prepareSignOut = useCallback(() => {
    const current = meta ?? loadVaultMeta();
    parkAndClearActiveVault(current?.ownerUserId);
    setMeta(null);
    setVaultKey(null);
    setRecoveryKeyOnce(null);
    markSignedOut();
  }, [meta]);

  const value = useMemo<VaultContextValue>(
    () => ({
      meta,
      vaultKey,
      unlocked: vaultKey !== null,
      recoveryKeyOnce,
      clearRecoveryKeyOnce: () => setRecoveryKeyOnce(null),
      setupVault,
      unlock,
      unlockRecovery,
      lock,
      adoptMeta,
      applyBoundMeta,
      loadParkedForUser,
      prepareSignOut,
    }),
    [
      meta,
      vaultKey,
      recoveryKeyOnce,
      setupVault,
      unlock,
      unlockRecovery,
      lock,
      adoptMeta,
      applyBoundMeta,
      loadParkedForUser,
      prepareSignOut,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

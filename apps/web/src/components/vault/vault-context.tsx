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
  createLocalVault,
  unlockWithPassphrase,
  unlockWithRecovery,
  type LocalVaultMeta,
} from "@paste/sync";

import {
  clearUnlockSession,
  loadUnlockSession,
  loadVaultMeta,
  saveUnlockSession,
  saveVaultMeta,
} from "@/lib/vault-storage";

type VaultContextValue = {
  meta: LocalVaultMeta | null;
  vaultKey: Uint8Array | null;
  unlocked: boolean;
  recoveryKeyOnce: string | null;
  clearRecoveryKeyOnce: () => void;
  setupVault: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  unlockRecovery: (recoveryKey: string) => Promise<void>;
  lock: () => void;
  /** Adopt vault meta restored from cloud (not yet unlocked). */
  adoptMeta: (meta: LocalVaultMeta) => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

function rememberUnlocked(key: Uint8Array) {
  saveUnlockSession(key);
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<LocalVaultMeta | null>(() => loadVaultMeta());
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(() => loadUnlockSession());
  const [recoveryKeyOnce, setRecoveryKeyOnce] = useState<string | null>(null);

  const setupVault = useCallback(async (passphrase: string) => {
    const created = await createLocalVault(passphrase);
    saveVaultMeta(created.meta);
    setMeta(created.meta);
    setVaultKey(created.vaultKey);
    rememberUnlocked(created.vaultKey);
    setRecoveryKeyOnce(created.recoveryKey);
  }, []);

  const adoptMeta = useCallback((next: LocalVaultMeta) => {
    saveVaultMeta(next);
    setMeta(next);
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      const current = meta ?? loadVaultMeta();
      if (!current) throw new Error("No vault found");
      const key = await unlockWithPassphrase(current, passphrase);
      setMeta(current);
      setVaultKey(key);
      rememberUnlocked(key);
    },
    [meta],
  );

  const unlockRecovery = useCallback(
    async (recoveryKey: string) => {
      const current = meta ?? loadVaultMeta();
      if (!current) throw new Error("No vault found");
      const key = await unlockWithRecovery(current, recoveryKey);
      setMeta(current);
      setVaultKey(key);
      rememberUnlocked(key);
    },
    [meta],
  );

  const lock = useCallback(() => {
    clearUnlockSession();
    setVaultKey(null);
  }, []);

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
    }),
    [meta, vaultKey, recoveryKeyOnce, setupVault, unlock, unlockRecovery, lock, adoptMeta],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

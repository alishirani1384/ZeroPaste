import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  ready: boolean;
  meta: LocalVaultMeta | null;
  vaultKey: Uint8Array | null;
  unlocked: boolean;
  recoveryKeyOnce: string | null;
  clearRecoveryKeyOnce: () => void;
  setupVault: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  unlockRecovery: (recoveryKey: string) => Promise<void>;
  lock: () => Promise<void>;
  adoptMeta: (meta: LocalVaultMeta) => Promise<void>;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<LocalVaultMeta | null>(null);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [recoveryKeyOnce, setRecoveryKeyOnce] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedMeta, sessionKey] = await Promise.all([loadVaultMeta(), loadUnlockSession()]);
      if (cancelled) return;
      setMeta(storedMeta);
      setVaultKey(sessionKey);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setupVault = useCallback(async (passphrase: string) => {
    const created = await createLocalVault(passphrase);
    await saveVaultMeta(created.meta);
    setMeta(created.meta);
    setVaultKey(created.vaultKey);
    try {
      await saveUnlockSession(created.vaultKey);
    } catch (err) {
      console.warn("[vault] saveUnlockSession failed (continuing unlocked)", err);
    }
    setRecoveryKeyOnce(created.recoveryKey);
  }, []);

  const adoptMeta = useCallback(async (next: LocalVaultMeta) => {
    await saveVaultMeta(next);
    setMeta(next);
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      const current = meta ?? (await loadVaultMeta());
      if (!current) throw new Error("No vault found");
      const key = await unlockWithPassphrase(current, passphrase);
      setMeta(current);
      setVaultKey(key);
      try {
        await saveUnlockSession(key);
      } catch (err) {
        console.warn("[vault] saveUnlockSession failed (continuing unlocked)", err);
      }
    },
    [meta],
  );

  const unlockRecovery = useCallback(
    async (recoveryKey: string) => {
      const current = meta ?? (await loadVaultMeta());
      if (!current) throw new Error("No vault found");
      const key = await unlockWithRecovery(current, recoveryKey);
      setMeta(current);
      setVaultKey(key);
      try {
        await saveUnlockSession(key);
      } catch (err) {
        console.warn("[vault] saveUnlockSession failed (continuing unlocked)", err);
      }
    },
    [meta],
  );

  const lock = useCallback(async () => {
    await clearUnlockSession();
    setVaultKey(null);
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      ready,
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
    [ready, meta, vaultKey, recoveryKeyOnce, setupVault, unlock, unlockRecovery, lock, adoptMeta],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

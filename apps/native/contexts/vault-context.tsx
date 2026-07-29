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
  clearClipsPullCursor,
  createOwnedLocalVault,
  unlockWithPassphrase,
  unlockWithRecovery,
  withVaultOwner,
  type LocalVaultMeta,
} from "@paste/sync";

import {
  clearUnlockSession,
  loadParkedVaultMeta,
  loadUnlockSession,
  loadVaultMeta,
  parkAndClearActiveVault,
  saveUnlockSession,
  saveVaultMeta,
  clearVaultMeta,
} from "@/lib/vault-storage";

type VaultContextValue = {
  ready: boolean;
  meta: LocalVaultMeta | null;
  vaultKey: Uint8Array | null;
  unlocked: boolean;
  recoveryKeyOnce: string | null;
  clearRecoveryKeyOnce: () => void;
  setupVault: (passphrase: string, ownerUserId?: string | null) => Promise<void>;
  unlock: (passphrase: string, ownerUserId?: string | null) => Promise<void>;
  unlockRecovery: (recoveryKey: string, ownerUserId?: string | null) => Promise<void>;
  lock: () => Promise<void>;
  adoptMeta: (meta: LocalVaultMeta) => Promise<void>;
  applyBoundMeta: (meta: LocalVaultMeta | null, opts?: { clearUnlock?: boolean }) => Promise<void>;
  loadParkedForUser: (userId: string) => Promise<LocalVaultMeta | null>;
  prepareSignOut: () => Promise<void>;
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

  const setupVault = useCallback(async (passphrase: string, ownerUserId?: string | null) => {
    const created = await createOwnedLocalVault(passphrase, ownerUserId);
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
    const current = meta;
    await saveVaultMeta(next);
    setMeta(next);
    if (!current || current.saltB64 !== next.saltB64) {
      await clearUnlockSession();
      setVaultKey(null);
      if (next.ownerUserId) await clearClipsPullCursor(next.ownerUserId);
    }
  }, [meta]);

  const applyBoundMeta = useCallback(
    async (next: LocalVaultMeta | null, opts?: { clearUnlock?: boolean }) => {
      const current = meta ?? (await loadVaultMeta());
      const clearUnlock =
        opts?.clearUnlock ??
        (!next ||
          !current ||
          current.saltB64 !== next.saltB64 ||
          current.ownerUserId !== next.ownerUserId);

      if (next) {
        await saveVaultMeta(next);
        setMeta(next);
      } else {
        await clearVaultMeta();
        setMeta(null);
      }

      if (clearUnlock) {
        await clearUnlockSession();
        setVaultKey(null);
        setRecoveryKeyOnce(null);
        if (next?.ownerUserId) await clearClipsPullCursor(next.ownerUserId);
        if (current?.ownerUserId && current.ownerUserId !== next?.ownerUserId) {
          await clearClipsPullCursor(current.ownerUserId);
        }
      }
    },
    [meta],
  );

  const loadParkedForUser = useCallback(
    async (userId: string) => loadParkedVaultMeta(userId),
    [],
  );

  const unlock = useCallback(
    async (passphrase: string, ownerUserId?: string | null) => {
      const current = meta ?? (await loadVaultMeta());
      if (!current) throw new Error("No vault found");
      const key = await unlockWithPassphrase(current, passphrase);
      const owned =
        ownerUserId || current.ownerUserId
          ? withVaultOwner(current, ownerUserId ?? current.ownerUserId)
          : current;
      if (owned !== current) await saveVaultMeta(owned);
      setMeta(owned);
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
    async (recoveryKey: string, ownerUserId?: string | null) => {
      const current = meta ?? (await loadVaultMeta());
      if (!current) throw new Error("No vault found");
      const key = await unlockWithRecovery(current, recoveryKey);
      const owned =
        ownerUserId || current.ownerUserId
          ? withVaultOwner(current, ownerUserId ?? current.ownerUserId)
          : current;
      if (owned !== current) await saveVaultMeta(owned);
      setMeta(owned);
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

  const prepareSignOut = useCallback(async () => {
    const current = meta ?? (await loadVaultMeta());
    await parkAndClearActiveVault(current?.ownerUserId);
    setMeta(null);
    setVaultKey(null);
    setRecoveryKeyOnce(null);
  }, [meta]);

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
      applyBoundMeta,
      loadParkedForUser,
      prepareSignOut,
    }),
    [
      ready,
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

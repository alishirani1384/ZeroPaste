"use client";

import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@paste/ui/components/sonner";

import { AuthProvider } from "@/lib/auth-session";
import { hydrateWebSessionFromHost } from "@/lib/host-session";

import { DesktopHostSync } from "./desktop-host-sync";
import { NativeCursorSync } from "./native-cursor-sync";
import { CloudSync } from "./vault/cloud-sync";
import { SyncStatusProvider } from "./vault/sync-status";
import { VaultProvider } from "./vault/vault-context";
import { ThemeProvider } from "./theme-provider";

function HostSessionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    void hydrateWebSessionFromHost()
      .then((applied) => {
        if (cancelled || !timedOut || !applied) return;
        // The timeout already let Auth/Vault mount before hydrate finished — remount
        // them now so they re-read the keys hydrate just restored to localStorage.
        setRemountKey((k) => k + 1);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    // Don't block forever if the bridge is slow — shelf still works offline.
    const t = window.setTimeout(() => {
      timedOut = true;
      if (!cancelled) setReady(true);
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Starting ZeroPaste…
      </div>
    );
  }

  return <Fragment key={remountKey}>{children}</Fragment>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname?.startsWith("/landing") ?? false;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={isLanding ? "light" : "dark"}
      enableSystem={false}
      forcedTheme={isLanding ? "light" : "dark"}
      disableTransitionOnChange
    >
      <HostSessionGate>
        <AuthProvider>
          <VaultProvider>
            <SyncStatusProvider>
              <DesktopHostSync />
              <NativeCursorSync />
              <CloudSync />
              {children}
              <Toaster richColors />
            </SyncStatusProvider>
          </VaultProvider>
        </AuthProvider>
      </HostSessionGate>
    </ThemeProvider>
  );
}

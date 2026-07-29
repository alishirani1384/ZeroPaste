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

function isMarketingPath(pathname: string | null) {
  if (!pathname) return true;
  return (
    pathname === "/" ||
    pathname.startsWith("/download") ||
    pathname.startsWith("/landing")
  );
}

function HostSessionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;

    void hydrateWebSessionFromHost()
      .then((applied) => {
        if (cancelled) return;
        // Late hydrate after the timeout already mounted Auth/Vault — remount so
        // they re-read localStorage (unlock session + supabase tokens).
        if (timedOut && applied) {
          setRemountKey((k) => k + 1);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    // Prefer waiting for hydrate; only open offline if the bridge is truly stuck.
    const t = window.setTimeout(() => {
      timedOut = true;
      if (!cancelled) setReady(true);
    }, 6000);

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

/** Vault / auth / cloud sync — only for the desktop shelf and account routes. */
function AppShellProviders({ children }: { children: ReactNode }) {
  return (
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
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = isMarketingPath(pathname);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={isLanding ? "light" : "dark"}
      enableSystem={false}
      forcedTheme={isLanding ? "light" : "dark"}
      disableTransitionOnChange
    >
      {isLanding ? children : <AppShellProviders>{children}</AppShellProviders>}
    </ThemeProvider>
  );
}

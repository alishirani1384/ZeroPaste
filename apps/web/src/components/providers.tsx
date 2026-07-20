"use client";

import { Toaster } from "@paste/ui/components/sonner";

import { AuthProvider } from "@/lib/auth-session";

import { DesktopHostSync } from "./desktop-host-sync";
import { NativeCursorSync } from "./native-cursor-sync";
import { CloudSync } from "./vault/cloud-sync";
import { SyncStatusProvider } from "./vault/sync-status";
import { VaultProvider } from "./vault/vault-context";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      forcedTheme="dark"
      disableTransitionOnChange
    >
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
    </ThemeProvider>
  );
}

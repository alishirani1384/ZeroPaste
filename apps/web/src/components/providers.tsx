"use client";

import { Toaster } from "@paste/ui/components/sonner";

import { DesktopHostSync } from "./desktop-host-sync";
import { CloudSync } from "./vault/cloud-sync";
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
      <VaultProvider>
        <DesktopHostSync />
        <CloudSync />
        {children}
        <Toaster richColors />
      </VaultProvider>
    </ThemeProvider>
  );
}

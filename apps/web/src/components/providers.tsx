"use client";

import { Toaster } from "@paste/ui/components/sonner";

import { DesktopHostSync } from "./desktop-host-sync";
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
        {children}
        <Toaster richColors />
      </VaultProvider>
    </ThemeProvider>
  );
}

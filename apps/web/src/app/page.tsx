"use client";

import { ClipboardPanel } from "@/components/clipboard/clipboard-panel";
import { VaultGate } from "@/components/vault/vault-gate";

export default function Home() {
  return (
    <main className="zp-shell zp-shell--desktop">
      <VaultGate>
        <ClipboardPanel />
      </VaultGate>
    </main>
  );
}

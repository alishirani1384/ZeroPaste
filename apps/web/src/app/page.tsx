"use client";

import { ClipboardPanel } from "@/components/clipboard/clipboard-panel";
import { OnboardingGate } from "@/components/vault/onboarding-gate";

export default function Home() {
  return (
    <main className="zp-shell zp-shell--desktop">
      <OnboardingGate>
        <ClipboardPanel />
      </OnboardingGate>
    </main>
  );
}

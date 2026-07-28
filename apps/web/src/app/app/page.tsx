"use client";

import { ClipboardPanel } from "@/components/clipboard/clipboard-panel";
import { OnboardingGate } from "@/components/vault/onboarding-gate";

/** Desktop shelf — Electrobun loads this route (dev `/app`, packaged `views://…/app/`). */
export default function DesktopAppPage() {
  return (
    <main className="zp-shell zp-shell--desktop">
      <OnboardingGate>
        <ClipboardPanel />
      </OnboardingGate>
    </main>
  );
}

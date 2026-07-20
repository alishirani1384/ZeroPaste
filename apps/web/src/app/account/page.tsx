"use client";

import Link from "next/link";

import { AuthPanel } from "@/components/vault/auth-panel";
import { OnboardingGate } from "@/components/vault/onboarding-gate";

export default function AccountPage() {
  return (
    <main className="zp-shell" style={{ overflow: "auto" }}>
      <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px 40px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--zp-muted)" }}>
          ← Back to clipboard
        </Link>
        <OnboardingGate>
          <div style={{ marginTop: 20 }}>
            <AuthPanel />
          </div>
        </OnboardingGate>
      </div>
    </main>
  );
}

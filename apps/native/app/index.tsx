import { OnboardingGate } from "@/components/onboarding-gate";
import { CloudSync } from "@/components/cloud-sync";
import { HistoryScreen } from "@/components/history-screen";

export default function Index() {
  return (
    <OnboardingGate>
      <CloudSync />
      <HistoryScreen />
    </OnboardingGate>
  );
}

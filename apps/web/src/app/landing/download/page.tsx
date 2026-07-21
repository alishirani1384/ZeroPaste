import type { Metadata } from "next";

import {
  DownloadFaqSection,
  DownloadHeroSection,
  DownloadTrialSection,
  SiteFooter,
  SiteHeader,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "Download ZeroPaste — Try for free",
  description:
    "Everything you copy is saved, searchable, and in sync. Try ZeroPaste free for seven days on all your devices.",
};

export default function DownloadPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <DownloadHeroSection />
        <DownloadTrialSection />
        <DownloadFaqSection />
      </main>
      <SiteFooter />
    </>
  );
}

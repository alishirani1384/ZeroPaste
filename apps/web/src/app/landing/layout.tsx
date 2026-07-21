import type { Metadata } from "next";

import { LandingThemeReset } from "@/components/landing/landing-theme-reset";

export const metadata: Metadata = {
  title: "ZeroPaste — Clipboard Manager for Mac, iPhone & iPad",
  description:
    "ZeroPaste keeps everything you copy organized and searchable. Lightweight, intuitive, packed with smart features, and private by design.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-landing
      className="min-h-screen w-full bg-white font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Oxygen,Ubuntu,Cantarell,'Helvetica_Neue',Arial,sans-serif] text-base leading-6 text-[#101010] antialiased [color-scheme:light]"
    >
      <LandingThemeReset />
      {children}
    </div>
  );
}

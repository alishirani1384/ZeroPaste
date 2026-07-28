import type { Metadata } from "next";

import { LandingThemeReset } from "@/components/landing/landing-theme-reset";

export const metadata: Metadata = {
  title: "ZeroPaste — Encrypted clipboard for Windows, Linux & Android",
  description:
    "ZeroPaste keeps everything you copy organized, searchable, and private. End-to-end encrypted sync — your passphrase never leaves the device.",
};

export default function MarketingLayout({
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

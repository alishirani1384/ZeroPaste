"use client";

import { cn } from "@paste/ui/lib/utils";
import { useEffect, useState } from "react";

import { CtaButton } from "./cta-button";
import { LANDING_NAV } from "./content";
import { SiteLogo } from "./site-logo";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,box-shadow]",
        scrolled &&
          "bg-white/88 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-[28px] backdrop-saturate-180",
      )}
    >
      <div className="mx-auto flex h-[60px] w-[min(100%-40px,1180px)] items-center justify-between min-[62.5rem]:h-[70px] min-[1000px]:w-[min(100%-48px,1180px)]">
        <SiteLogo />
        <CtaButton variant="nav" href={LANDING_NAV.cta.href}>
          {LANDING_NAV.cta.label}
        </CtaButton>
      </div>
    </header>
  );
}

import Image from "next/image";

import { LANDING_NAV } from "./content";

export function SiteLogo() {
  return (
    <a
      className="flex items-center gap-2.5 pr-2.5 text-[#101010] no-underline"
      aria-label={LANDING_NAV.logo.label}
      href={LANDING_NAV.logo.href}
    >
      <Image
        src="/favicon/apple-touch-icon.png"
        alt=""
        width={36}
        height={36}
        priority
        unoptimized
        className="size-9 shrink-0 rounded-lg"
      />
      <span className="text-xl font-semibold leading-4 tracking-[-0.4px] !text-[#101010]">
        {LANDING_NAV.logo.label}
      </span>
    </a>
  );
}

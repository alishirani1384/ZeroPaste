import Image from "next/image";

import { CtaButton } from "./cta-button";
import { LANDING_NAV } from "./content";
import { PressLogos } from "./press-logos";

export function HeroSection() {
  return (
    <section className="relative bg-white" aria-labelledby="landing-hero-heading">
      <div className="bg-white px-4 min-[62.5rem]:px-6 min-[62.5rem]:pt-[70px]">
        <div className="relative z-10 mx-auto w-full max-w-[1200px] bg-white pb-16">
          <div className="flex justify-center overflow-hidden pt-[60px] min-[62.5rem]:justify-stretch min-[62.5rem]:overflow-visible min-[62.5rem]:pt-0">
            <Image
              src="/landing/hero-cluster.png"
              alt="Paste running on Mac, iPhone and iPad"
              width={2400}
              height={1164}
              priority
              unoptimized
              sizes="(min-width: 1000px) 1200px, 112vw"
              className="block w-[112%] max-w-none shrink-0 min-[62.5rem]:ml-0 min-[62.5rem]:w-full"
            />
          </div>

          <div className="mt-6 px-6 text-center max-[999px]:mx-auto max-[999px]:w-[min(100%-40px,960px)] max-[999px]:px-0 max-[999px]:pb-12 min-[62.5rem]:mt-[17px] min-[62.5rem]:px-0">
            <h1
              id="landing-hero-heading"
              className="mx-auto max-w-[768px] text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] text-balance !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] sm:tracking-[0.6px] min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
            >
              Your clipboard, supercharged and secure
            </h1>
            <p className="mx-auto mt-4 max-w-[520px] text-[1.125rem] leading-[1.875rem] tracking-[0.1px] text-pretty !text-[#101010] min-[62.5rem]:max-w-[800px] min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem] min-[62.5rem]:tracking-[0.3px]">
              ZeroPaste keeps everything you copy organized and searchable.
              Lightweight, intuitive, packed with smart features, and private by
              design.
            </p>
            <CtaButton variant="hero" href={LANDING_NAV.cta.href}>
              {LANDING_NAV.cta.label}
            </CtaButton>
            <PressLogos />
          </div>
        </div>
      </div>
    </section>
  );
}

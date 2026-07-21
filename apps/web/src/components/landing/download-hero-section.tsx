import Image from "next/image";

import { DOWNLOAD_HERO } from "./content";
import { DownloadPlatforms } from "./download-platforms";

export function DownloadHeroSection() {
  return (
    <section
      className="bg-[radial-gradient(80%_54%_at_5%_118%,rgba(255,236,214,0.6),rgba(245,245,247,0)_74%),radial-gradient(80%_54%_at_95%_118%,rgba(216,227,251,0.42),rgba(245,245,247,0)_74%)]"
      aria-labelledby="download-hero-heading"
    >
      <div className="mx-auto w-[min(100%-40px,960px)] pt-[100px] pb-20 min-[62.5rem]:pt-[120px]">
        <div className="mx-auto max-w-[768px] text-center">
          <h1
            id="download-hero-heading"
            className="m-0 text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] text-balance !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] sm:tracking-[0.6px] min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
          >
            {DOWNLOAD_HERO.title}
          </h1>
          <p className="mt-4 text-[1.125rem] leading-[1.875rem] tracking-[0.1px] text-pretty !text-[#101010] min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem] min-[62.5rem]:tracking-[0.3px]">
            {DOWNLOAD_HERO.subtitle}
          </p>
        </div>

        <Image
          src={DOWNLOAD_HERO.image.src}
          alt={DOWNLOAD_HERO.image.alt}
          width={DOWNLOAD_HERO.image.width}
          height={DOWNLOAD_HERO.image.height}
          priority
          unoptimized
          sizes="(min-width: 1000px) 960px, 100vw"
          className="mt-2 h-auto w-full"
        />

        <DownloadPlatforms />

        <p className="mt-5 text-center text-base leading-6 tracking-[0.2px] !text-[#ababb0]">
          {DOWNLOAD_HERO.note}
        </p>
      </div>
    </section>
  );
}

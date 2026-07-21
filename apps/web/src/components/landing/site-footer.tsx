import Image from "next/image";

import { LANDING_NAV } from "./content";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#101010]/8 bg-[#101010]">
      <div className="mx-auto flex h-16 w-[min(100%-40px,1180px)] items-center justify-between gap-4 min-[1000px]:w-[min(100%-48px,1180px)]">
        <a
          href={LANDING_NAV.logo.href}
          aria-label={LANDING_NAV.logo.label}
          className="group flex shrink-0 items-center gap-2.5 no-underline"
        >
          <Image
            src="/favicon/apple-touch-icon.png"
            alt=""
            width={28}
            height={28}
            unoptimized
            className="size-7 rounded-[7px] transition-transform duration-300 group-hover:scale-105"
          />
          <span className="hidden text-[15px] font-semibold tracking-[-0.3px] !text-white sm:inline">
            {LANDING_NAV.logo.label}
          </span>
        </a>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:gap-5">
          <a
            href="/landing/download"
            className="relative shrink-0 text-[13px] font-medium tracking-[-0.2px] !text-white/70 no-underline transition-colors hover:!text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-white after:transition-transform after:duration-300 hover:after:scale-x-100"
          >
            Download
          </a>
          <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden="true" />
          <p className="m-0 truncate text-[12px] tracking-[0.1px] !text-white/40 sm:text-[13px]">
            © {year} ZeroPaste
          </p>
        </div>

        <a
          href="https://x.com/zeropaste"
          target="_blank"
          rel="noreferrer"
          aria-label="ZeroPaste on X"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/70 no-underline transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-white/12 hover:text-white"
        >
          <svg viewBox="0 0 30 30" fill="currentColor" aria-hidden="true" className="size-[15px]">
            <path d="m5 6 7.276 10.14L5.383 24H8.09l5.398-6.17L17.914 24H25l-7.61-10.625L23.84 6h-2.665l-4.993 5.688L12.108 6H5zm3.938 2h2.1l10.026 14h-2.082L8.938 8z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}

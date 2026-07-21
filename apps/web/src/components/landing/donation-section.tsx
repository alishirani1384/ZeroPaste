"use client";

import { useState } from "react";
import { toast } from "sonner";

import { CtaButton } from "./cta-button";
import { DONATION } from "./content";

export function DonationSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyAddress(id: string, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      toast.success("Address copied");
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      toast.error("Couldn’t copy address");
    }
  }

  return (
    <section
      className="bg-[#f5f5f7]"
      id="donate"
      aria-labelledby="donate-heading"
    >
      <div className="mx-auto w-[min(100%-40px,960px)] py-20 pb-[100px] text-center min-[62.5rem]:py-[120px]">
        <h2
          id="donate-heading"
          className="m-0 text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
        >
          <span className="block">{DONATION.title[0]}</span>
          <span className="block">{DONATION.title[1]}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[640px] text-xl leading-[1.625rem] tracking-[0.3px] !text-[#101010] min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem]">
          {DONATION.subtitle}
        </p>

        <div className="mt-12 grid gap-5 text-left sm:grid-cols-2">
          <article className="rounded-[28px] bg-white p-7 min-[62.5rem]:rounded-[30px] min-[62.5rem]:p-8">
            <h3 className="m-0 text-[22px] leading-[26px] font-bold tracking-[0.4px] !text-[#101010]">
              Donate with crypto
            </h3>
            <p className="mt-2 text-base leading-6 tracking-[0.1px] !text-[#6e6e73]">
              Send any amount to one of these wallets. Tap an address to copy it.
            </p>

            <ul className="mt-6 m-0 flex list-none flex-col gap-3 p-0">
              {DONATION.crypto.map((wallet) => (
                <li key={wallet.id}>
                  <button
                    type="button"
                    onClick={() => copyAddress(wallet.id, wallet.address)}
                    className="flex w-full cursor-pointer flex-col gap-1 rounded-[16px] border-0 bg-[#f5f5f7] px-4 py-3.5 text-left transition-colors hover:bg-[#ececef]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[15px] font-semibold !text-[#101010]">
                        {wallet.label}
                        <span className="ml-2 text-[13px] font-medium !text-[#6e6e73]">
                          {wallet.network}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold !text-[#0088ff]">
                        {copiedId === wallet.id ? "Copied" : "Copy"}
                      </span>
                    </span>
                    <span className="truncate font-mono text-[13px] leading-5 tracking-[-0.2px] !text-[#48484a]">
                      {wallet.address}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="flex flex-col rounded-[28px] bg-white p-7 min-[62.5rem]:rounded-[30px] min-[62.5rem]:p-8">
            <h3 className="m-0 text-[22px] leading-[26px] font-bold tracking-[0.4px] !text-[#101010]">
              {DONATION.contact.label}
            </h3>
            <p className="mt-2 text-base leading-6 tracking-[0.1px] !text-[#6e6e73]">
              {DONATION.contact.description}
            </p>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <CtaButton
                href={`mailto:${DONATION.contact.email}`}
                className="!mt-0 h-12 w-full !px-6 !text-[1.125rem] !tracking-[0.1px]"
              >
                Email me
              </CtaButton>
              <a
                href={DONATION.contact.x}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 w-full items-center justify-center rounded-full text-[1.125rem] font-medium tracking-[0.1px] !text-[#0088ff] no-underline shadow-[inset_0_0_0_2px_#0088ff] transition-colors hover:bg-[#0088ff]/6"
              >
                Message on X
              </a>
              <CtaButton
                href="/landing/download"
                className="!mt-0 h-12 w-full !bg-transparent !px-6 !text-[1.125rem] !tracking-[0.1px] !text-[#101010] shadow-[inset_0_0_0_2px_#d2d2d7] hover:!bg-[#f5f5f7] hover:brightness-100"
              >
                Or download free
              </CtaButton>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

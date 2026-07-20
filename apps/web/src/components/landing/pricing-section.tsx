"use client";

import { useState } from "react";

import { CtaButton } from "./cta-button";
import { LANDING_NAV, PRICING_PLANS } from "./content";

export function PricingSection() {
  const [plan, setPlan] = useState<(typeof PRICING_PLANS)[number]["id"]>("annual");
  const active = PRICING_PLANS.find((p) => p.id === plan) ?? PRICING_PLANS[1];
  const activeIndex = PRICING_PLANS.findIndex((p) => p.id === plan);

  return (
    <section
      className="bg-[#f5f5f7]"
      id="download"
      aria-labelledby="pricing-heading"
    >
      <div className="relative mx-auto w-[min(100%-40px,960px)] py-20 pb-[100px] text-center min-[62.5rem]:h-[949px] min-[62.5rem]:py-0">
        <h2
          id="pricing-heading"
          className="m-0 text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:absolute min-[62.5rem]:top-[120px] min-[62.5rem]:w-full min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
        >
          <span className="block">Ready to up your</span>
          <span className="block">clipboard game?</span>
        </h2>
        <p className="mt-4 text-xl leading-[1.625rem] tracking-[0.3px] !text-[#101010] min-[62.5rem]:absolute min-[62.5rem]:top-[260px] min-[62.5rem]:mt-0 min-[62.5rem]:w-full min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem]">
          <span className="block">Subscription or lifetime purchase.</span>
          <span className="block">For you on all your devices.</span>
        </p>

        <div className="mt-10 min-[62.5rem]:absolute min-[62.5rem]:top-[360px] min-[62.5rem]:left-1/2 min-[62.5rem]:mt-0 min-[62.5rem]:w-[620px] min-[62.5rem]:-translate-x-1/2">
          <div className="relative mx-auto flex w-full max-w-[620px] flex-col items-center rounded-[20px] bg-white px-8 py-[60px] min-[62.5rem]:rounded-[30px]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[20px] bg-[#0088ff] px-3 py-[7px] text-[13px] leading-none font-semibold !text-white shadow-[0_0_100px_#73adfa59]">
              Most popular
            </span>

            <div
              className="relative flex h-10 w-full max-w-[380px] rounded-full bg-[#f0f0f0]"
              role="tablist"
              aria-label="Billing period"
            >
              <div
                className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform duration-200"
                style={{ transform: `translateX(${activeIndex * 100}%)` }}
              />
              {PRICING_PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={plan === p.id}
                  className="relative z-10 h-10 w-1/3 cursor-pointer border-0 bg-transparent font-[inherit] text-sm leading-[18px] tracking-[-0.4px] text-[#101010]"
                  onClick={() => setPlan(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-[50px] w-full font-bold leading-9 tracking-[-0.4px] !text-[#101010]">
              <span className="text-[46px]">{active.price}</span>
              {active.suffix ? (
                <span className="text-[30px]">{active.suffix}</span>
              ) : null}
            </div>

            {active.note ? (
              <div className="mt-3 flex min-h-[30px] w-full items-center justify-center gap-2 text-lg leading-[30px] tracking-[0.1px] !text-[#ababb0]">
                <span>{active.note}</span>
                {active.save ? (
                  <span className="rounded-full bg-[#0088ff]/10 px-2 py-[3px] text-[13px] leading-none font-semibold !text-[#0088ff]">
                    {active.save}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 min-h-[30px] w-full" />
            )}

            <div className="mt-[47px] flex w-full flex-wrap items-center justify-center gap-2.5">
              <CtaButton
                href="#buy"
                className="!mt-0 !h-[46px] min-w-[180px] !px-6 !text-[1.125rem] !tracking-[0.1px]"
              >
                Buy Now
              </CtaButton>
              <a
                className="inline-flex h-[46px] w-[180px] items-center justify-center rounded-full text-[1.125rem] font-medium tracking-[0.1px] !text-[#0088ff] no-underline shadow-[inset_0_0_0_2px_#0088ff]"
                href={LANDING_NAV.cta.href}
              >
                Try for Free
              </a>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-7 max-w-[384px] text-center text-base leading-6 tracking-[0.2px] !text-[#ababb0] min-[62.5rem]:absolute min-[62.5rem]:top-[801px] min-[62.5rem]:left-1/2 min-[62.5rem]:mt-0 min-[62.5rem]:w-[384px] min-[62.5rem]:-translate-x-1/2">
          Prices are in USD excluding VAT and can vary across different countries and
          regions.
        </p>
      </div>
    </section>
  );
}

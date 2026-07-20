import { cn } from "@paste/ui/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type CtaButtonProps = ComponentPropsWithoutRef<"a"> & {
  variant?: "nav" | "hero";
};

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full whitespace-nowrap border-0 font-medium text-white no-underline transition-[filter] hover:brightness-95 bg-[#0088ff] !text-white";

const variants = {
  nav: "h-9 px-5 text-[0.9375rem] leading-5 tracking-[-0.4px]",
  hero: "mt-8 h-[50px] min-w-[183px] px-[30px] text-[1.25rem] leading-5 tracking-[-0.2px] min-[62.5rem]:mt-[30px]",
} as const;

export function CtaButton({
  variant = "nav",
  className,
  children,
  ...props
}: CtaButtonProps) {
  return (
    <a className={cn(base, variants[variant], className)} {...props}>
      {children}
    </a>
  );
}

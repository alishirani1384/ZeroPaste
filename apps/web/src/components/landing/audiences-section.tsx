import { cn } from "@paste/ui/lib/utils";
import Image from "next/image";

import { AUDIENCES } from "./content";

export function AudiencesSection() {
  return (
    <section
      className="overflow-clip bg-[#101010] text-white"
      aria-labelledby="audiences-heading"
    >
      <div className="relative mx-auto min-h-[1100px] w-full max-w-[1152px] px-5 py-20 min-[62.5rem]:h-[1766px] min-[62.5rem]:p-0">
        <Image
          src="/landing/forpros-bg.svg"
          alt=""
          width={1200}
          height={1000}
          unoptimized
          className="hidden min-[62.5rem]:absolute min-[62.5rem]:top-[245px] min-[62.5rem]:left-0 min-[62.5rem]:block min-[62.5rem]:h-auto min-[62.5rem]:w-full"
        />
        <Image
          src="/landing/forpros-device.png"
          alt="Paste running across developer tools"
          width={1920}
          height={1140}
          unoptimized
          className="hidden min-[62.5rem]:absolute min-[62.5rem]:top-[440px] min-[62.5rem]:left-24 min-[62.5rem]:block min-[62.5rem]:h-auto min-[62.5rem]:w-[960px]"
        />

        <h2
          id="audiences-heading"
          className="m-0 text-center text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] !text-white sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:absolute min-[62.5rem]:top-[140px] min-[62.5rem]:w-full min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
        >
          <span className="block">A better clipboard</span>
          <span className="block">for everyone</span>
        </h2>
        <p className="mt-4 text-center text-xl leading-[1.625rem] tracking-[0.3px] !text-white min-[62.5rem]:absolute min-[62.5rem]:top-[280px] min-[62.5rem]:mt-0 min-[62.5rem]:w-full min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem]">
          <span className="block">Whether you do it for work or just for fun,</span>
          <span className="block">do it faster with Paste.</span>
        </p>

        <div className="mt-12 grid gap-9 min-[62.5rem]:contents">
          {AUDIENCES.map((item) => (
            <article
              key={item.id}
              className={cn("min-[62.5rem]:absolute min-[62.5rem]:w-[354px]", item.className)}
            >
              <Image src={item.icon} alt="" width={60} height={50} unoptimized />
              <h3 className="mt-6 text-[22px] leading-[26px] font-bold tracking-[0.2px] !text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-lg leading-[30px] tracking-[0.1px] !text-white">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

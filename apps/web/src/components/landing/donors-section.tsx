import Image from "next/image";

import { DONORS } from "./content";

export function DonorsSection() {
  const columns = [
    [DONORS[0], DONORS[3]],
    [DONORS[1], DONORS[4]],
    [DONORS[2], DONORS[5]],
  ];

  return (
    <section className="overflow-clip bg-white" aria-labelledby="donors-heading">
      <div className="relative mx-auto w-[min(100%-40px,960px)] py-20 min-[62.5rem]:h-[1104px] min-[62.5rem]:py-0">
        <h2
          id="donors-heading"
          className="m-0 text-center text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:absolute min-[62.5rem]:top-[140px] min-[62.5rem]:w-full min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
        >
          <span className="block">Thank you to our</span>
          <span className="block">supporters</span>
        </h2>

        <div className="mt-10 flex flex-col gap-5 min-[62.5rem]:absolute min-[62.5rem]:inset-x-0 min-[62.5rem]:top-[364px] min-[62.5rem]:mt-0 min-[62.5rem]:flex-row min-[62.5rem]:justify-center">
          {columns.map((col, i) => (
            <div key={i} className="flex w-full flex-col gap-5 min-[62.5rem]:w-[307px]">
              {col.map((donor) => (
                <figure key={donor.name} className="m-0 rounded-[20px] bg-[#f5f5f7] p-5">
                  <div className="flex items-center gap-5">
                    <Image
                      src={donor.avatar}
                      alt=""
                      width={60}
                      height={60}
                      unoptimized
                      className="size-[60px] rounded-full object-cover"
                    />
                    <figcaption className="min-w-0">
                      <p className="m-0 text-base font-bold !text-[#101010]">{donor.name}</p>
                      <p className="mt-0.5 text-sm leading-[18px] font-semibold !text-[#0088ff]">
                        Donated {donor.amount}
                      </p>
                    </figcaption>
                  </div>
                  <blockquote className="mt-4 text-[15px] leading-[22px] !text-[#101010]">
                    {donor.note}
                  </blockquote>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";

import { TESTIMONIALS } from "./content";

export function TestimonialsSection() {
  const columns = [
    [TESTIMONIALS[0], TESTIMONIALS[3]],
    [TESTIMONIALS[1], TESTIMONIALS[4]],
    [TESTIMONIALS[2], TESTIMONIALS[5]],
  ];

  return (
    <section className="overflow-clip bg-white" aria-labelledby="love-heading">
      <div className="relative mx-auto w-[min(100%-40px,960px)] py-20 min-[62.5rem]:h-[1104px] min-[62.5rem]:py-0">
        <h2
          id="love-heading"
          className="m-0 text-center text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:absolute min-[62.5rem]:top-[140px] min-[62.5rem]:w-full min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem]"
        >
          <span className="block">People everywhere</span>
          <span className="block">love Paste</span>
        </h2>

        <div className="mt-10 flex flex-col gap-5 min-[62.5rem]:absolute min-[62.5rem]:inset-x-0 min-[62.5rem]:top-[364px] min-[62.5rem]:mt-0 min-[62.5rem]:flex-row min-[62.5rem]:justify-center">
          {columns.map((col, i) => (
            <div key={i} className="flex w-full flex-col gap-5 min-[62.5rem]:w-[307px]">
              {col.map((t) => (
                <figure key={t.name} className="m-0 rounded-[20px] bg-[#f5f5f7] p-5">
                  <div className="flex items-center gap-5">
                    <Image
                      src={t.avatar}
                      alt=""
                      width={60}
                      height={60}
                      unoptimized
                      className="size-[60px] rounded-full object-cover"
                    />
                    <figcaption>
                      <p className="m-0 text-base font-bold !text-[#101010]">{t.name}</p>
                      <p className="mt-0.5 text-sm leading-[18px] !text-[#6e6e73]">
                        {t.role}
                        {t.company ? (
                          <>
                            <br />
                            {t.company}
                          </>
                        ) : null}
                      </p>
                    </figcaption>
                  </div>
                  <blockquote className="mt-4 text-[15px] leading-[22px] !text-[#101010]">
                    {t.quote}
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

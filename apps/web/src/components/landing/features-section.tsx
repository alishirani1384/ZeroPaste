import Image from "next/image";

import { FEATURES } from "./content";

export function FeaturesSection() {
  return (
    <section className="bg-white" aria-labelledby="features-heading">
      <div className="hidden pt-[120px] pb-[120px] min-[62.5rem]:block">
        <div className="relative mx-auto h-[1000px] w-[960px]">
          <article className="absolute top-0 left-0 h-[490px] w-[614px] overflow-hidden rounded-[40px] bg-[#f5f5f7]">
            <h3 className="absolute top-10 left-10 z-[2] m-0 text-[40px] leading-[42px] font-bold tracking-[0.4px] !text-[#101010]">
              {FEATURES[0].title}
            </h3>
            <p className="absolute top-[90px] left-10 z-[2] m-0 w-[534px] text-lg leading-[26px] tracking-[0.2px] !text-[#48484a]">
              {FEATURES[0].body}
            </p>
            <Image
              src={FEATURES[0].image}
              alt=""
              width={640}
              height={600}
              unoptimized
              className="absolute top-[167px] left-[147px] h-auto w-[320px]"
            />
          </article>

          <article className="absolute top-0 left-[634px] h-[490px] w-[326px] overflow-hidden rounded-[40px] bg-[#1c95ff]">
            <Image
              src={FEATURES[1].image}
              alt=""
              width={560}
              height={192}
              unoptimized
              className="absolute top-[74px] left-[23px] h-auto w-[280px]"
            />
            <h3 className="absolute top-[244px] left-10 z-[2] m-0 w-[246px] text-[40px] leading-[42px] font-bold tracking-[0.4px] !text-white">
              {FEATURES[1].title}
            </h3>
            <p className="absolute top-[336px] left-10 z-[2] m-0 w-[246px] text-lg leading-[26px] tracking-[0.2px] !text-white">
              {FEATURES[1].body}
            </p>
          </article>

          <article className="absolute top-[510px] left-0 h-[490px] w-[960px] overflow-hidden rounded-[40px] bg-transparent">
            <Image
              src={FEATURES[2].image}
              alt=""
              width={1920}
              height={980}
              unoptimized
              className="h-auto w-full"
            />
            <h3 className="absolute top-[338px] left-10 z-[2] m-0 text-[40px] leading-[42px] font-bold tracking-[0.4px] !text-[#101010]">
              {FEATURES[2].title}
            </h3>
            <p className="absolute top-[388px] left-10 z-[2] m-0 w-[400px] text-lg leading-[26px] tracking-[0.2px] !text-white">
              {FEATURES[2].body}
            </p>
          </article>
        </div>
      </div>

      <div className="block px-5 py-20 min-[62.5rem]:hidden">
        <h2
          id="features-heading"
          className="text-center text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] text-balance !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem]"
        >
          <span className="block">Powerful features</span>
          <span className="block">to boost your productivity</span>
        </h2>
        <div className="mt-10 flex flex-col gap-8">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className="overflow-hidden rounded-[28px] bg-[#f5f5f7] pb-7"
            >
              <Image
                src={feature.image}
                alt=""
                width={800}
                height={500}
                unoptimized
                className="h-auto w-full"
              />
              <h3 className="mx-5 mt-5 text-[28px] font-bold !text-[#101010]">
                {feature.title}
              </h3>
              <p className="mx-5 mt-2 text-base leading-6 !text-[#48484a]">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

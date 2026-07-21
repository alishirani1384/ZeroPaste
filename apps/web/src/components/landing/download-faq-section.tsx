import { DOWNLOAD_FAQ } from "./content";

function FaqChevron() {
  return (
    <svg
      width="30"
      height="32"
      viewBox="0 0 30 32"
      fill="none"
      aria-hidden="true"
      className="h-[30px] w-[28px] shrink-0 transition-transform duration-200 group-open:-rotate-180"
    >
      <path
        fill="#ABABB0"
        fillOpacity=".5"
        d="M15.35 22.943c-.52 0-.952-.203-1.371-.609l-9.547-9.775a1.67 1.67 0 0 1-.495-1.194c0-.952.761-1.726 1.7-1.726.483 0 .915.203 1.258.546l8.467 8.683 8.443-8.683c.343-.343.787-.546 1.244-.546.952 0 1.714.774 1.714 1.726 0 .47-.165.864-.495 1.194L16.72 22.32c-.407.42-.85.622-1.371.622Z"
      />
    </svg>
  );
}

export function DownloadFaqSection() {
  return (
    <section
      className="bg-[#f5f5f7] py-[100px] min-[62.5rem]:py-[140px]"
      aria-labelledby="download-faq-heading"
    >
      <div className="mx-auto w-[min(100%-40px,960px)]">
        <div className="text-center">
          <h2
            id="download-faq-heading"
            className="m-0 text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] text-balance !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem] min-[62.5rem]:tracking-[0.6px]"
          >
            Frequently Asked Questions
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-[768px] min-[62.5rem]:mt-24">
          {DOWNLOAD_FAQ.map((item) => (
            <details key={item.question} className="group border-b border-[#e6e6e9]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                <span className="text-left text-[22px] leading-[26px] font-bold tracking-[0.6px] !text-[#101010]">
                  {item.question}
                </span>
                <FaqChevron />
              </summary>
              <p className="pb-6 text-lg leading-[30px] tracking-[0.1px] !text-[#101010]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

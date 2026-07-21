import { DOWNLOAD_TRIAL } from "./content";
import {
  TrialCalendarIcon,
  TrialDevicesIcon,
  TrialStarIcon,
} from "./download-trial-icons";

const ICONS = {
  star: TrialStarIcon,
  calendar: TrialCalendarIcon,
  devices: TrialDevicesIcon,
} as const;

export function DownloadTrialSection() {
  return (
    <section
      className="bg-white py-[100px] min-[62.5rem]:py-[140px]"
      aria-labelledby="download-trial-heading"
    >
      <div className="mx-auto w-[min(100%-40px,960px)]">
        <div className="text-center">
          <h2
            id="download-trial-heading"
            className="m-0 text-[2.5rem] leading-[2.625rem] font-bold tracking-[0.4px] text-balance !text-[#101010] sm:text-[3.25rem] sm:leading-[3.25rem] min-[62.5rem]:text-[3.75rem] min-[62.5rem]:leading-[3.875rem] min-[62.5rem]:tracking-[0.6px]"
          >
            {DOWNLOAD_TRIAL.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[768px] text-[1.125rem] leading-[1.875rem] tracking-[0.1px] !text-[#101010] min-[62.5rem]:text-2xl min-[62.5rem]:leading-[1.875rem] min-[62.5rem]:tracking-[0.3px]">
            {DOWNLOAD_TRIAL.subtitle}
          </p>
        </div>

        <div className="mt-[50px] grid gap-5 sm:mt-20 sm:grid-cols-3 min-[62.5rem]:mt-[100px]">
          {DOWNLOAD_TRIAL.cards.map((card) => {
            const Icon = ICONS[card.icon];
            return (
              <article
                key={card.id}
                className="rounded-[28px] bg-[#f5f5f7] p-8 transition-transform duration-200 hover:-translate-y-0.5 min-[62.5rem]:rounded-[30px]"
              >
                <Icon className="h-[50px] w-auto" />
                <h3 className="mt-6 text-[22px] leading-[26px] font-bold tracking-[0.6px] !text-[#101010]">
                  {card.title}
                </h3>
                <p className="mt-2 text-lg leading-[30px] tracking-[0.1px] !text-[#101010]">
                  {card.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

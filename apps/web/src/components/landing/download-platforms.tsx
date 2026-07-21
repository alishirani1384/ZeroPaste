import { cn } from "@paste/ui/lib/utils";

import { DOWNLOAD_PLATFORMS } from "./content";

function PlatformGlyph({
  platform,
}: {
  platform: (typeof DOWNLOAD_PLATFORMS)[number]["id"];
}) {
  if (platform === "windows") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
        <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7.2H3v6.1ZM11.5 4.25 21 3v8.5h-9.5V4.25ZM11.5 20.8 21 22v-9.5h-9.5v8.3Z" />
      </svg>
    );
  }
  if (platform === "linux") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
        <path d="M12.5 2c-.7 0-1.4.4-1.7 1.1-.5 1.1-.3 2.4.2 3.7-.9.4-1.6 1.1-2 2-.6 1.3-.5 2.9.3 4.1-.6.7-1 1.6-1 2.6 0 1.4.7 2.6 1.8 3.3-.2.7-.2 1.4.1 2.1.4 1 1.3 1.6 2.3 1.6.5 0 1-.2 1.4-.5.4.3.9.5 1.4.5 1 0 1.9-.6 2.3-1.6.3-.7.3-1.4.1-2.1 1.1-.7 1.8-1.9 1.8-3.3 0-1-.4-1.9-1-2.6.8-1.2.9-2.8.3-4.1-.4-.9-1.1-1.6-2-2 .5-1.3.7-2.6.2-3.7C13.9 2.4 13.2 2 12.5 2Zm0 1.5c.2 0 .4.1.5.3.3.6.2 1.5-.1 2.4-.3-.1-.6-.1-.9 0-.3-.9-.4-1.8-.1-2.4.1-.2.3-.3.6-.3Zm-.4 3.6c.3 0 .5 0 .8.1.8.2 1.5.8 1.9 1.6.4.9.3 2-.2 2.9l-.4.6.5.5c.5.5.8 1.2.8 1.9 0 .9-.5 1.7-1.2 2.1l-.6.3.2.6c.1.4.1.8 0 1.1-.2.5-.6.8-1.1.8-.3 0-.5-.1-.7-.3l-.5-.5-.5.5c-.2.2-.4.3-.7.3-.5 0-.9-.3-1.1-.8-.1-.3-.1-.7 0-1.1l.2-.6-.6-.3c-.7-.4-1.2-1.2-1.2-2.1 0-.7.3-1.4.8-1.9l.5-.5-.4-.6c-.5-.9-.6-2-.2-2.9.4-.8 1.1-1.4 1.9-1.6.2-.1.5-.1.8-.1Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d="M7.2 2h9.6A2.2 2.2 0 0 1 19 4.2v15.6A2.2 2.2 0 0 1 16.8 22H7.2A2.2 2.2 0 0 1 5 19.8V4.2A2.2 2.2 0 0 1 7.2 2Zm0 1.6c-.33 0-.6.27-.6.6v15.6c0 .33.27.6.6.6h9.6c.33 0 .6-.27.6-.6V4.2c0-.33-.27-.6-.6-.6H7.2Zm4.8 14.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
    </svg>
  );
}

export function DownloadPlatforms() {
  return (
    <div className="mt-12 grid gap-4 sm:grid-cols-3">
      {DOWNLOAD_PLATFORMS.map((platform) => (
        <article
          key={platform.id}
          className="flex flex-col rounded-[28px] bg-white/80 p-6 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[#101010]/6 min-[62.5rem]:rounded-[30px] min-[62.5rem]:p-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#0088ff]/10 text-[#0088ff]">
              <PlatformGlyph platform={platform.id} />
            </span>
            <div>
              <h2 className="m-0 text-[22px] leading-[26px] font-bold tracking-[0.4px] !text-[#101010]">
                {platform.label}
              </h2>
              <p className="m-0 mt-0.5 text-sm leading-5 tracking-[0.1px] !text-[#6e6e73]">
                {platform.description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-1 flex-col gap-2.5">
            {platform.options.map((option) => {
              const external = option.href.startsWith("http");
              return (
                <a
                  key={option.id}
                  href={option.href}
                  {...(external
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-full px-5 text-[0.9375rem] leading-5 font-medium tracking-[-0.2px] no-underline transition-[filter,background-color,color]",
                    option.primary
                      ? "bg-[#0088ff] !text-white hover:brightness-95"
                      : "bg-transparent !text-[#0088ff] shadow-[inset_0_0_0_2px_#0088ff] hover:bg-[#0088ff]/6",
                  )}
                >
                  {option.label}
                </a>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

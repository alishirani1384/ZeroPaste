import Image from "next/image";

import { PRESS_LOGOS } from "./content";

export function PressLogos() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 min-[62.5rem]:mt-[50px] min-[62.5rem]:gap-x-[60px]">
      {PRESS_LOGOS.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          unoptimized
          className="h-5 w-auto"
        />
      ))}
    </div>
  );
}

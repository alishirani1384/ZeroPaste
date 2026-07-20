"use client";

import { X } from "lucide-react";

import { hideDesktopWindow } from "@/lib/bridge";

type Props = {
  className?: string;
  title?: string;
};

/** Hides the Electrobun window; hotkey shows it again. */
export function WindowCloseButton({
  className = "zp-window-close",
  title = "Close",
}: Props) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        void hideDesktopWindow();
      }}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

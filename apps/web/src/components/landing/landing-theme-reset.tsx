"use client";

import { useLayoutEffect } from "react";

/**
 * Landing is a light marketing surface; the app shell forces dark theme.
 * Width/overflow/background are handled in CSS via `[data-landing]` so the
 * first paint is already correct — this only clears the `dark` class.
 */
export function LandingThemeReset() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.colorScheme = "light";

    return () => {
      if (hadDark) html.classList.add("dark");
      html.style.colorScheme = "";
    };
  }, []);

  return null;
}

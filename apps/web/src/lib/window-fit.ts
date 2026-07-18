import type { DesktopWindowMode } from "./bridge";

const BRIDGE = "http://127.0.0.1:47821";

export type FitAnchor = "bottom-center" | "center";

export async function fitDesktopWindow(opts: {
  width: number;
  height: number;
  anchor: FitAnchor;
}) {
  try {
    await fetch(`${BRIDGE}/window-fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        width: Math.ceil(opts.width),
        height: Math.ceil(opts.height),
        anchor: opts.anchor,
      }),
    });
  } catch {
    /* browser preview */
  }
}

export function anchorForMode(mode: DesktopWindowMode): FitAnchor {
  return mode === "vault" ? "center" : "bottom-center";
}

/** Observe an element and keep the Electrobun window fitted to its box. */
export function observeDesktopFit(
  el: HTMLElement | null,
  anchor: FitAnchor,
): () => void {
  if (!el || typeof ResizeObserver === "undefined") return () => {};

  let lastW = 0;
  let lastH = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const publish = () => {
    const rect = el.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width < 40 || height < 40) return;
    if (Math.abs(width - lastW) < 2 && Math.abs(height - lastH) < 2) return;
    lastW = width;
    lastH = height;
    void fitDesktopWindow({ width, height, anchor });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(publish, 50);
  };

  publish();
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  // Second pass after fonts/layout settle
  const t2 = window.setTimeout(publish, 200);
  const t3 = window.setTimeout(publish, 600);

  return () => {
    ro.disconnect();
    if (timer) clearTimeout(timer);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
  };
}

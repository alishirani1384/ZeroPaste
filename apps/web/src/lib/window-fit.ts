import type { DesktopWindowMode } from "./bridge";

const BRIDGE = "http://127.0.0.1:47821";

export type FitAnchor = "bottom-center" | "center";

export async function fitDesktopWindow(opts: {
  width: number;
  height: number;
  anchor: FitAnchor;
}) {
  try {
    const res = await fetch(`${BRIDGE}/window-fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        width: Math.ceil(opts.width),
        height: Math.ceil(opts.height),
        anchor: opts.anchor,
      }),
    });
    if (!res.ok) console.warn("[ZeroPaste] window-fit failed", res.status);
  } catch {
    /* browser preview */
  }
}

export function anchorForMode(mode: DesktopWindowMode): FitAnchor {
  return mode === "vault" ? "center" : "bottom-center";
}

/** Use painted box only — scrollWidth can inflate past the opaque modal. */
function measureBox(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
  };
}

/**
 * Keep the Electrobun HWND fitted to `el`.
 * `el` must be the opaque chrome (gate stack / panel / QL sheet), top-left of the page.
 */
export function observeDesktopFit(
  el: HTMLElement | null,
  anchor: FitAnchor,
): () => void {
  if (!el || typeof ResizeObserver === "undefined") return () => {};

  let lastW = 0;
  let lastH = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const publish = () => {
    const { width, height } = measureBox(el);
    if (width < 40 || height < 40) return;
    if (Math.abs(width - lastW) < 1 && Math.abs(height - lastH) < 1) return;
    lastW = width;
    lastH = height;
    console.info("[ZeroPaste] fit measure", width, height, anchor);
    void fitDesktopWindow({ width, height, anchor });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(publish, 32);
  };

  publish();
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry?.contentBoxSize?.[0]) {
      const box = entry.contentBoxSize[0];
      const width = Math.ceil(box.inlineSize);
      const height = Math.ceil(box.blockSize);
      if (width >= 40 && height >= 40) {
        if (Math.abs(width - lastW) < 1 && Math.abs(height - lastH) < 1) return;
        lastW = width;
        lastH = height;
        console.info("[ZeroPaste] fit ro", width, height, anchor);
        void fitDesktopWindow({ width, height, anchor });
        return;
      }
    }
    schedule();
  });
  ro.observe(el);

  const mo = new MutationObserver(schedule);
  mo.observe(el, { subtree: true, childList: true, characterData: true });

  const t2 = window.setTimeout(publish, 50);
  const t3 = window.setTimeout(publish, 200);
  const t4 = window.setTimeout(publish, 500);

  return () => {
    ro.disconnect();
    mo.disconnect();
    if (timer) clearTimeout(timer);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
    window.clearTimeout(t4);
  };
}

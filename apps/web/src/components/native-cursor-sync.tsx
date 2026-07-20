"use client";

import { useEffect } from "react";

const BRIDGE = "http://127.0.0.1:47821";

/**
 * Drive the Win32 cursor from CSS, because Electrobun CEF OSR does not.
 * Maps wait/progress → arrow so the stuck blue loading spinner cannot return.
 */
export function NativeCursorSync() {
  useEffect(() => {
    let last = "";
    let raf = 0;

    const send = (cursor: string) => {
      if (cursor === last) return;
      last = cursor;
      void fetch(`${BRIDGE}/cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursor }),
        keepalive: true,
      }).catch(() => {
        /* host offline in browser preview */
      });
    };

    const resolveCursor = (x: number, y: number): string => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "arrow";
      let node: Element | null = el;
      while (node && node !== document.documentElement) {
        const c = getComputedStyle(node).cursor;
        if (c && c !== "auto") {
          if (c === "wait" || c === "progress") return "arrow";
          return c;
        }
        node = node.parentElement;
      }
      return "arrow";
    };

    const onMove = (e: PointerEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        send(resolveCursor(e.clientX, e.clientY));
      });
    };

    // Default immediately — clears AppStarting before first move.
    send("arrow");
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, []);

  return null;
}

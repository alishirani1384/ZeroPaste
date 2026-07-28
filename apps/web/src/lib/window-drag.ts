import type { PointerEvent as ReactPointerEvent } from "react";

import { bridgeFetch } from "./bridge-client";

async function postDrag(phase: "start" | "stop") {
  try {
    // Host reads OS cursor itself — do not send screenX/Y (HiDPI mismatch).
    const res = await bridgeFetch("/window-drag", {
      method: "POST",
      body: JSON.stringify({ phase }),
    });
    console.info("[ZeroPaste] drag", phase, res.status);
  } catch (err) {
    console.warn("[ZeroPaste] drag bridge failed", err);
  }
}

/**
 * Bun-only window drag. Do NOT use electrobun-webkit-app-region-drag at the
 * same time — dual native+polling drag causes flicker and the window vanishing.
 */
export function windowDragHandlers() {
  let dragging = false;
  let pointerId: number | null = null;

  const end = () => {
    if (!dragging) return;
    dragging = false;
    pointerId = null;
    void postDrag("stop");
  };

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      // Close / interactive children live inside drag chrome — don't steal their clicks.
      const t = e.target;
      if (
        t instanceof Element &&
        t.closest("button, a, input, textarea, select, [data-no-drag]")
      ) {
        return;
      }
      dragging = true;
      pointerId = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      void postDrag("start");
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      end();
    },
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}

import type { PointerEvent as ReactPointerEvent } from "react";

const BRIDGE = "http://127.0.0.1:47821";

async function postDrag(phase: "start" | "stop") {
  try {
    // Host reads OS cursor itself — do not send screenX/Y (HiDPI mismatch).
    const res = await fetch(`${BRIDGE}/window-drag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      dragging = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      void postDrag("start");
    },
    onPointerUp: () => {
      if (!dragging) return;
      dragging = false;
      void postDrag("stop");
    },
    onPointerCancel: () => {
      if (!dragging) return;
      dragging = false;
      void postDrag("stop");
    },
  };
}

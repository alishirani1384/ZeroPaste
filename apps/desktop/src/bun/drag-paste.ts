/**
 * Drag-to-paste: watch OS left mouse button so paste still fires when the
 * pointer leaves the transparent CEF/WebKit window (pointerup never arrives).
 * Uses Electrobun Screen.getMouseButtons on all platforms.
 */

import { pasteClipById } from "./paste";
import { isLeftButtonDown } from "./platform/mouse";

let activeId: string | null = null;
let waiters: Array<(r: { ok: boolean; error?: string }) => void> = [];

function finish(result: { ok: boolean; error?: string }) {
  activeId = null;
  const pending = waiters;
  waiters = [];
  for (const w of pending) w(result);
}

/**
 * Block until the left button is released, then paste.
 * Safe to call while the button is already down (drag in progress).
 */
export async function runDragPaste(id: string): Promise<{ ok: boolean; error?: string }> {
  if (activeId) {
    return { ok: false, error: "drag_busy" };
  }
  activeId = id;
  console.log("[ZeroPaste] drag-paste start", id.slice(0, 8));

  return new Promise((resolve) => {
    waiters.push(resolve);

    void (async () => {
      try {
        const start = Date.now();
        while (!isLeftButtonDown()) {
          if (Date.now() - start > 800) break;
          await Bun.sleep(16);
        }
        while (isLeftButtonDown()) {
          if (activeId !== id) {
            finish({ ok: false, error: "cancelled" });
            return;
          }
          await Bun.sleep(16);
        }
        if (activeId !== id) {
          finish({ ok: false, error: "cancelled" });
          return;
        }
        const result = await pasteClipById(id);
        console.log("[ZeroPaste] drag-paste done", id.slice(0, 8), result);
        finish(result.ok ? { ok: true } : { ok: false, error: result.error });
      } catch (err) {
        console.warn("[ZeroPaste] drag-paste failed", err);
        finish({ ok: false, error: "drag_failed" });
      }
    })();
  });
}

export function cancelDragPaste() {
  if (!activeId) return;
  console.log("[ZeroPaste] drag-paste cancel");
  finish({ ok: false, error: "cancelled" });
}

export function isDragPasteActive() {
  return activeId !== null;
}

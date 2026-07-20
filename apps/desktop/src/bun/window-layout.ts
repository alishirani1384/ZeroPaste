import { Screen, type BrowserWindow } from "electrobun/bun";

import { applyNoActivateByTitle, clearNoActivateByTitle } from "./noactivate";

export type WindowMode = "panel" | "vault";

/** Bump when host logic changes — must appear in Electrobun terminal + /health. */
export const HOST_BUILD = "zeropaste-host-2026-07-20-webview2";

/**
 * Electrobun Windows + transparent:true cannot reliably GROW the CEF/OSR
 * surface after create (see electrobun#410). Growing vault→panel left us with
 * getFrame {1100,320} at (0,0) while the visible webview stayed ~vault-wide.
 *
 * Fix: create once at a fixed large size and ONLY setPosition when switching modes.
 * Height must fit the tallest vault gate (sign-in + offline) without clipping.
 */
const WIN_W = 1280;
const WIN_H = 680;
const PANEL_CONTENT_H = 320;
const PANEL_MARGIN_BOTTOM = 28;

type Rect = { x: number; y: number; width: number; height: number };

function contains(r: Rect, x: number, y: number) {
  return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
}

function workArea(): Rect {
  try {
    const pt = Screen.getCursorScreenPoint();
    const displays = Screen.getAllDisplays();
    console.log("[ZeroPaste] displays", displays.length, "cursor", pt);

    for (const d of displays) {
      const wa = d.workArea?.width > 0 ? d.workArea : d.bounds;
      if (wa?.width > 800 && wa.height > 500 && contains(wa, pt.x, pt.y)) {
        console.log("[ZeroPaste] workArea (cursor display)", wa);
        return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
      }
    }

    const primary = Screen.getPrimaryDisplay();
    const wa = primary.workArea?.width > 0 ? primary.workArea : primary.bounds;
    if (wa?.width > 800 && wa.height > 500) {
      console.log("[ZeroPaste] workArea (primary)", wa);
      return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
    }
  } catch (e) {
    console.warn("[ZeroPaste] workArea error", e);
  }
  console.warn("[ZeroPaste] workArea fallback 1920x1080");
  return { x: 0, y: 0, width: 1920, height: 1080 };
}

let winSize = { width: WIN_W, height: WIN_H };

/** Call once before creating the BrowserWindow. */
export function resolveWindowSize(): { width: number; height: number } {
  const wa = workArea();
  winSize = {
    width: Math.min(WIN_W, Math.max(960, wa.width - 64)),
    height: WIN_H,
  };
  console.log("[ZeroPaste] fixed window size", winSize);
  return { ...winSize };
}

export function panelFrame(): Rect {
  const wa = workArea();
  const { width, height } = winSize;
  // Window bottom sits above the taskbar; panel UI is bottom-aligned inside (CSS).
  return {
    width,
    height,
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + wa.height - height - PANEL_MARGIN_BOTTOM),
  };
}

export function vaultFrame(): Rect {
  const wa = workArea();
  const { width, height } = winSize;
  return {
    width,
    height,
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
  };
}

let winRef: BrowserWindow | null = null;
let mode: WindowMode = "vault";
let dragTimer: ReturnType<typeof setInterval> | null = null;
let dragOffset: { dx: number; dy: number } | null = null;
let placeTimer: ReturnType<typeof setTimeout> | null = null;
let lastPosKey: string | null = null;
let dragging = false;

export function bindWindow(win: BrowserWindow) {
  winRef = win;
  console.log(`[ZeroPaste] ${HOST_BUILD} window bound id=${win.id}`);
}

export function getWindowMode(): WindowMode {
  return mode;
}

export function isDragging(): boolean {
  return dragging;
}

function applyPosition(frame: Rect, label: string) {
  const win = winRef;
  if (!win) {
    console.error("[ZeroPaste] applyPosition: winRef is null");
    return;
  }
  if (dragging) {
    console.log("[ZeroPaste] applyPosition skipped (dragging)", label);
    return;
  }

  const key = `${label}:${frame.x},${frame.y}`;
  if (key === lastPosKey) return;

  console.log(`[ZeroPaste] applyPosition(${label})`, {
    x: frame.x,
    y: frame.y,
    size: winSize,
    panelContentH: PANEL_CONTENT_H,
  });

  try {
    // Position only — never resize (transparent CEF growth is broken on Win).
    win.setPosition(frame.x, frame.y);
    lastPosKey = key;

    const got = win.getFrame();
    console.log("[ZeroPaste] getFrame =>", got);

    // If OS ignored the move (stuck at 0,0), retry once.
    if (Math.abs(got.x - frame.x) > 4 || Math.abs(got.y - frame.y) > 4) {
      console.warn("[ZeroPaste] position mismatch — retry setPosition");
      win.setPosition(frame.x, frame.y);
      console.log("[ZeroPaste] getFrame retry =>", win.getFrame());
    }
  } catch (e) {
    console.warn("[ZeroPaste] setPosition failed", e);
  }
}

export function placeWindow(next: WindowMode) {
  mode = next;
  if (dragging) return;

  const frame = next === "panel" ? panelFrame() : vaultFrame();

  if (placeTimer) clearTimeout(placeTimer);
  placeTimer = setTimeout(() => {
    placeTimer = null;
    applyPosition(frame, next);
    // Panel: clicks must not steal caret. Vault: allow typing passphrase.
    if (next === "panel") void applyNoActivateByTitle();
    else void clearNoActivateByTitle();
  }, 16);
}

export const applyWindowMode = placeWindow;
export const reapplyCurrentMode = () => placeWindow(mode);

/** No-op resize: size is fixed at create. Still repositions for vault. */
export function fitWindow(opts: {
  width: number;
  height: number;
  anchor: "bottom-center" | "center";
}) {
  placeWindow(opts.anchor === "bottom-center" ? "panel" : "vault");
}

export function startWindowDrag(_screenX?: number, _screenY?: number) {
  const win = winRef;
  if (!win) {
    console.error("[ZeroPaste] drag START: no window");
    return;
  }

  if (placeTimer) {
    clearTimeout(placeTimer);
    placeTimer = null;
  }

  let frame: Rect;
  try {
    frame = win.getFrame();
  } catch (e) {
    console.warn("[ZeroPaste] drag START getFrame failed", e);
    return;
  }

  const pt = Screen.getCursorScreenPoint();
  dragOffset = { dx: pt.x - frame.x, dy: pt.y - frame.y };
  dragging = true;
  console.log("[ZeroPaste] drag START", { pt, frame, dragOffset });

  if (dragTimer) clearInterval(dragTimer);
  // NOACTIVATE / showInactive often swallows pointerup — also stop when LMB is released.
  void import("./platform/mouse").then(({ isLeftButtonDown }) => {
    dragTimer = setInterval(() => {
      if (!dragOffset || !winRef) return;
      try {
        if (!isLeftButtonDown()) {
          stopWindowDrag();
          return;
        }
        const cur = Screen.getCursorScreenPoint();
        winRef.setPosition(
          Math.round(cur.x - dragOffset.dx),
          Math.round(cur.y - dragOffset.dy),
        );
      } catch {
        /* ignore */
      }
    }, 8);
  });
}

export function moveWindowDrag(_x: number, _y: number) {
  /* cursor polled in Bun */
}

export function stopWindowDrag() {
  if (!dragging && !dragTimer) return;
  console.log("[ZeroPaste] drag STOP");
  dragging = false;
  dragOffset = null;
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }

  try {
    winRef?.show();
    const frame = winRef?.getFrame();
    if (frame) {
      lastPosKey = `${mode}:${frame.x},${frame.y}`;
      console.log("[ZeroPaste] drag settled", frame);
    }
  } catch (e) {
    console.warn("[ZeroPaste] drag settle failed", e);
  }
}

import { Screen, type BrowserWindow } from "electrobun/bun";

import { applyNoActivateByTitle, clearNoActivateByTitle } from "./noactivate";
import { setNativeWindowFrame } from "./win32-frame";

export type WindowMode = "panel" | "vault";
export type FitAnchor = "bottom-center" | "center";

/** Bump when host logic changes — must appear in Electrobun terminal + /health. */
export const HOST_BUILD = "zeropaste-host-2026-07-21-silentstart";

/**
 * WebView2 + transparent: hit-testing stays bound to the *create* size
 * (electrobun#410). If we create vault-sized (~420) then grow to the shelf
 * (~1100), only the left ~420px of the shelf receives clicks.
 *
 * Strategy:
 * 1. Create at MAX canvas (≥ shelf + Quick Look)
 * 2. /window-fit shrinks/grows the HWND within that ceiling via setFrame + SetWindowPos
 * 3. placeWindow only repositions — never owns width/height
 */
export const SHELF_W = 1100;
export const SHELF_H = 320;
export const QL_W = 920;
export const QL_H = 520;

const MAX_W = 1280;
const MAX_H = 720;
const MIN_W = 280;
const MIN_H = 140;
const FIT_PAD = 2;
const PANEL_MARGIN_BOTTOM = 28;
const WINDOW_TITLE = "ZeroPaste";

type Rect = { x: number; y: number; width: number; height: number };

function contains(r: Rect, x: number, y: number) {
  return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
}

function workArea(): Rect {
  try {
    const pt = Screen.getCursorScreenPoint();
    const displays = Screen.getAllDisplays();

    for (const d of displays) {
      const wa = d.workArea?.width > 0 ? d.workArea : d.bounds;
      if (wa?.width > 800 && wa.height > 500 && contains(wa, pt.x, pt.y)) {
        return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
      }
    }

    const primary = Screen.getPrimaryDisplay();
    const wa = primary.workArea?.width > 0 ? primary.workArea : primary.bounds;
    if (wa?.width > 800 && wa.height > 500) {
      return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
    }
  } catch (e) {
    console.warn("[ZeroPaste] workArea error", e);
  }
  return { x: 0, y: 0, width: 1920, height: 1080 };
}

/** Create-time canvas = hit-test ceiling. */
let maxSize = { width: MAX_W, height: MAX_H };
let contentSize = { width: SHELF_W, height: SHELF_H };
let winSize = { width: MAX_W, height: MAX_H };
let mode: WindowMode = "vault";
let userPlaced = false;

let winRef: BrowserWindow | null = null;
let dragTimer: ReturnType<typeof setInterval> | null = null;
let dragOffset: { dx: number; dy: number } | null = null;
let placeTimer: ReturnType<typeof setTimeout> | null = null;
let fitTimer: ReturnType<typeof setTimeout> | null = null;
let lastFrameKey: string | null = null;
let dragging = false;

/** Call once before creating the BrowserWindow — returns the CREATE size (max). */
export function resolveWindowSize(): { width: number; height: number } {
  const wa = workArea();
  // Ceiling must cover shelf + Quick Look or those UIs will have dead click zones.
  const needW = Math.max(SHELF_W, QL_W) + 24;
  const needH = Math.max(SHELF_H, QL_H) + 24;
  maxSize = {
    width: Math.min(MAX_W, Math.max(needW, Math.min(wa.width - 48, MAX_W))),
    height: Math.min(MAX_H, Math.max(needH, Math.min(wa.height - 48, MAX_H))),
  };
  winSize = { ...maxSize };
  contentSize = { width: 420, height: 520 };
  console.log("[ZeroPaste] CREATE canvas (hit-test ceiling)", maxSize);
  return { ...maxSize };
}

export function getMaxWindowSize() {
  return { ...maxSize };
}

function clampSize(width: number, height: number): { width: number; height: number } {
  const wa = workArea();
  return {
    width: Math.min(maxSize.width, wa.width - 24, Math.max(MIN_W, Math.ceil(width))),
    height: Math.min(maxSize.height, wa.height - 24, Math.max(MIN_H, Math.ceil(height))),
  };
}

function anchoredFrame(size: { width: number; height: number }, anchor: FitAnchor): Rect {
  const wa = workArea();
  const { width, height } = size;
  if (anchor === "bottom-center") {
    return {
      width,
      height,
      x: Math.round(wa.x + (wa.width - width) / 2),
      y: Math.round(wa.y + wa.height - height - PANEL_MARGIN_BOTTOM),
    };
  }
  return {
    width,
    height,
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
  };
}

function framePreservingPlacement(
  size: { width: number; height: number },
  anchor: FitAnchor,
): Rect {
  const win = winRef;
  if (!win || !userPlaced) return anchoredFrame(size, anchor);

  let cur: Rect;
  try {
    cur = win.getFrame();
  } catch {
    return anchoredFrame(size, anchor);
  }

  const { width, height } = size;
  if (anchor === "bottom-center") {
    const bottom = cur.y + cur.height;
    return {
      width,
      height,
      x: Math.round(cur.x + (cur.width - width) / 2),
      y: Math.round(bottom - height),
    };
  }
  return {
    width,
    height,
    x: Math.round(cur.x + (cur.width - width) / 2),
    y: Math.round(cur.y + (cur.height - height) / 2),
  };
}

export function panelFrame(): Rect {
  return anchoredFrame(winSize, "bottom-center");
}

export function vaultFrame(): Rect {
  return anchoredFrame(winSize, "center");
}

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

function syncWebviewSize(width: number, height: number) {
  const win = winRef;
  if (!win) return;
  try {
    const view = win.webview as {
      frame?: { x: number; y: number; width: number; height: number };
      autoResize?: boolean;
    } | null;
    if (view?.frame) {
      view.frame = { x: 0, y: 0, width, height };
    }
  } catch {
    /* ignore */
  }
}

function applyFrame(frame: Rect, label: string) {
  const win = winRef;
  if (!win) {
    console.error("[ZeroPaste] applyFrame: winRef is null");
    return;
  }
  if (dragging) {
    console.log("[ZeroPaste] applyFrame skipped (dragging)", label);
    return;
  }

  // Never exceed create-time canvas (hit-test ceiling).
  const width = Math.min(frame.width, maxSize.width);
  const height = Math.min(frame.height, maxSize.height);
  const next = { ...frame, width, height };

  const key = `${label}:${next.x},${next.y},${next.width},${next.height}`;
  if (key === lastFrameKey) return;

  console.log(`[ZeroPaste] applyFrame(${label})`, next, "ceiling", maxSize);

  try {
    win.setFrame(next.x, next.y, next.width, next.height);
    syncWebviewSize(next.width, next.height);
    winSize = { width: next.width, height: next.height };
    lastFrameKey = key;

    // Always force OS HWND — Electrobun getFrame can lie about the clickable region.
    setNativeWindowFrame(WINDOW_TITLE, next.x, next.y, next.width, next.height);

    const got = win.getFrame();
    console.log("[ZeroPaste] getFrame =>", got);
    if (
      Math.abs(got.width - next.width) > 3 ||
      Math.abs(got.height - next.height) > 3 ||
      Math.abs(got.x - next.x) > 4 ||
      Math.abs(got.y - next.y) > 4
    ) {
      console.warn("[ZeroPaste] frame mismatch — retry");
      win.setSize(next.width, next.height);
      win.setPosition(next.x, next.y);
      setNativeWindowFrame(WINDOW_TITLE, next.x, next.y, next.width, next.height);
    }
  } catch (e) {
    console.warn("[ZeroPaste] setFrame failed", e);
    setNativeWindowFrame(WINDOW_TITLE, next.x, next.y, next.width, next.height);
  }
}

/** Mode switch: reposition only. Sizing owned by fitWindow. */
export function placeWindow(next: WindowMode) {
  mode = next;
  userPlaced = false;
  if (dragging) return;

  const anchor: FitAnchor = next === "panel" ? "bottom-center" : "center";
  const frame = anchoredFrame(winSize, anchor);

  if (placeTimer) clearTimeout(placeTimer);
  placeTimer = setTimeout(() => {
    placeTimer = null;
    const win = winRef;
    if (!win || dragging) return;
    try {
      win.setPosition(frame.x, frame.y);
      setNativeWindowFrame(WINDOW_TITLE, frame.x, frame.y, winSize.width, winSize.height);
      lastFrameKey = null;
      console.log("[ZeroPaste] placeWindow position-only", next, frame.x, frame.y, winSize);
    } catch (e) {
      console.warn("[ZeroPaste] placeWindow setPosition failed", e);
    }
    if (next === "panel") void applyNoActivateByTitle();
    else void clearNoActivateByTitle();
  }, 16);
}

export const applyWindowMode = placeWindow;
export const reapplyCurrentMode = () => placeWindow(mode);

/** Resize HWND to measured UI. Sole owner of width/height. */
export function fitWindow(opts: {
  width: number;
  height: number;
  anchor: FitAnchor;
}) {
  if (dragging) return;

  contentSize = {
    width: Math.max(1, Math.ceil(opts.width)),
    height: Math.max(1, Math.ceil(opts.height)),
  };
  const size = clampSize(contentSize.width + FIT_PAD, contentSize.height + FIT_PAD);
  mode = opts.anchor === "bottom-center" ? "panel" : "vault";

  if (fitTimer) clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    fitTimer = null;
    const frame = framePreservingPlacement(size, opts.anchor);
    applyFrame(frame, `fit:${opts.anchor}`);
    if (mode === "panel") void applyNoActivateByTitle();
    else void clearNoActivateByTitle();
  }, 16);
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
  if (fitTimer) {
    clearTimeout(fitTimer);
    fitTimer = null;
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
  userPlaced = true;
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }

  try {
    winRef?.show();
    const frame = winRef?.getFrame();
    if (frame) {
      winSize = { width: frame.width, height: frame.height };
      lastFrameKey = `${mode}:${frame.x},${frame.y},${frame.width},${frame.height}`;
      console.log("[ZeroPaste] drag settled", frame);
    }
  } catch (e) {
    console.warn("[ZeroPaste] drag settle failed", e);
  }
}

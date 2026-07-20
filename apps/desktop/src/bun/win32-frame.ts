/**
 * Force Win32 HWND bounds when Electrobun setFrame leaves the window oversized
 * (transparent WebView2 often keeps a larger clickable region than the UI).
 */
import { dlopen } from "bun:ffi";

import { resolveRootHwnd } from "./win32-cursor";

const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const HWND_TOP = 0;

let user32: ReturnType<typeof dlopen> | null = null;

function init(): boolean {
  if (process.platform !== "win32") return false;
  if (user32) return true;
  try {
    user32 = dlopen("user32.dll", {
      SetWindowPos: {
        args: ["ptr", "ptr", "i32", "i32", "i32", "i32", "u32"],
        returns: "i32",
      },
      IsWindow: { args: ["ptr"], returns: "i32" },
    });
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] win32-frame init failed", err);
    user32 = null;
    return false;
  }
}

export function setNativeWindowFrame(
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!init() || !user32) return false;
  const hwnd = resolveRootHwnd(title);
  if (!hwnd || !user32.symbols.IsWindow(hwnd)) return false;
  try {
    const ok = user32.symbols.SetWindowPos(
      hwnd,
      HWND_TOP,
      Math.round(x),
      Math.round(y),
      Math.max(1, Math.round(width)),
      Math.max(1, Math.round(height)),
      SWP_NOZORDER | SWP_NOACTIVATE,
    );
    return ok !== 0;
  } catch (err) {
    console.warn("[ZeroPaste] SetWindowPos failed", err);
    return false;
  }
}

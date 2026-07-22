/**
 * Windows: WS_EX_NOACTIVATE so clicks on the shelf do not steal the caret.
 * Pure Win32 FFI — never spawn PowerShell (was flashing dozens of consoles on boot).
 */
import { dlopen, ptr } from "bun:ffi";

import { resolveRootHwnd } from "./win32-cursor";

const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_TOPMOST = 0x00000008;
const WS_EX_TOOLWINDOW = 0x00000080;
const GWL_EXSTYLE = -20;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const HWND_TOPMOST = -1 as unknown as number;

let user32: ReturnType<typeof dlopen> | null = null;

function init(): boolean {
  if (process.platform !== "win32") return false;
  if (user32) return true;
  try {
    user32 = dlopen("user32.dll", {
      GetWindowLongPtrW: { args: ["ptr", "i32"], returns: "i64" },
      SetWindowLongPtrW: { args: ["ptr", "i32", "i64"], returns: "i64" },
      SetWindowPos: {
        args: ["ptr", "ptr", "i32", "i32", "i32", "i32", "u32"],
        returns: "i32",
      },
      GetForegroundWindow: { args: [], returns: "ptr" },
      GetWindowTextW: { args: ["ptr", "ptr", "i32"], returns: "i32" },
      IsWindow: { args: ["ptr"], returns: "i32" },
    });
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] win32-noactivate init failed", err);
    user32 = null;
    return false;
  }
}

function hwndOk(h: unknown): h is number | bigint {
  if (h === null || h === undefined) return false;
  try {
    return BigInt(h as number | bigint) !== 0n;
  } catch {
    return false;
  }
}

function readTitle(hwnd: number | bigint): string {
  if (!user32) return "";
  const buf = Buffer.alloc(512 * 2);
  const n = user32.symbols.GetWindowTextW(hwnd, ptr(buf), 512);
  if (!n) return "";
  return buf.toString("utf16le", 0, n * 2);
}

function resolveHwnd(title: string): number | bigint | null {
  const h = resolveRootHwnd(title);
  if (hwndOk(h) && user32?.symbols.IsWindow(h)) return h;
  return null;
}

export async function applyNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  if (!init() || !user32) return false;
  const h = resolveHwnd(title);
  if (!hwndOk(h)) {
    console.warn("[ZeroPaste] noactivate: window not found");
    return false;
  }
  try {
    const style = BigInt(user32.symbols.GetWindowLongPtrW(h, GWL_EXSTYLE));
    const next = style | BigInt(WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_TOOLWINDOW);
    user32.symbols.SetWindowLongPtrW(h, GWL_EXSTYLE, next);
    user32.symbols.SetWindowPos(
      h,
      HWND_TOPMOST,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
    );
    console.log("[ZeroPaste] NOACTIVATE on hwnd=", String(h));
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] applyNoActivate failed", err);
    return false;
  }
}

export async function clearNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  if (!init() || !user32) return false;
  const h = resolveHwnd(title);
  if (!hwndOk(h)) return false;
  try {
    const style = BigInt(user32.symbols.GetWindowLongPtrW(h, GWL_EXSTYLE));
    let next = style & ~BigInt(WS_EX_NOACTIVATE);
    next |= BigInt(WS_EX_TOPMOST);
    user32.symbols.SetWindowLongPtrW(h, GWL_EXSTYLE, next);
    user32.symbols.SetWindowPos(
      h,
      HWND_TOPMOST,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
    );
    console.log("[ZeroPaste] NOACTIVATE cleared");
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] clearNoActivate failed", err);
    return false;
  }
}

export async function isZeroPasteForeground(title = "ZeroPaste"): Promise<boolean> {
  if (!init() || !user32) return false;
  try {
    const fg = user32.symbols.GetForegroundWindow();
    if (!hwndOk(fg)) return false;
    return readTitle(fg) === title;
  } catch {
    return false;
  }
}

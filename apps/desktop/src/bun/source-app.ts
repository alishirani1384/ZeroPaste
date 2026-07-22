/** Best-effort foreground app / window metadata for clip source. */

import { hostname } from "node:os";
import { dlopen, ptr } from "bun:ffi";

import { commandExists } from "./platform/session";

export type ForegroundSource = {
  /** Short label for cards — last segment of the window title (usually the app). */
  appName: string;
  /** Full window title for search / Quick Look / persistence. */
  windowTitle: string;
};

/**
 * "file.ts - Cursor" → "Cursor"
 * "Inbox - ali@mail - Outlook" → "Outlook"
 */
export function appNameFromWindowTitle(title: string): string {
  const t = title.trim();
  if (!t) return "Unknown app";
  const parts = t.split(/\s[-–—|]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1]!.slice(0, 80);
  return t.slice(0, 80);
}

let user32: ReturnType<typeof dlopen> | null = null;

function initWin(): boolean {
  if (process.platform !== "win32") return false;
  if (user32) return true;
  try {
    user32 = dlopen("user32.dll", {
      GetForegroundWindow: { args: [], returns: "ptr" },
      GetWindowTextW: { args: ["ptr", "ptr", "i32"], returns: "i32" },
    });
    return true;
  } catch {
    user32 = null;
    return false;
  }
}

function getForegroundWindowTitleWin(): string | null {
  if (!initWin() || !user32) return null;
  try {
    const h = user32.symbols.GetForegroundWindow();
    if (!h) return null;
    const buf = Buffer.alloc(512 * 2);
    const n = user32.symbols.GetWindowTextW(h, ptr(buf), 512);
    if (!n) return null;
    const name = buf.toString("utf16le", 0, n * 2).trim();
    if (!name || name === "ZeroPaste") return null;
    return name.slice(0, 240);
  } catch {
    return null;
  }
}

async function getForegroundWindowTitle(): Promise<string | null> {
  if (process.platform === "win32") {
    return getForegroundWindowTitleWin();
  }

  if (process.platform === "linux" && (await commandExists("xdotool"))) {
    try {
      const idProc = Bun.spawn(["xdotool", "getactivewindow"], {
        stdout: "pipe",
        stderr: "ignore",
      });
      const id = (await new Response(idProc.stdout).text()).trim();
      if ((await idProc.exited) === 0 && id) {
        const nameProc = Bun.spawn(["xdotool", "getwindowname", id], {
          stdout: "pipe",
          stderr: "ignore",
        });
        const name = (await new Response(nameProc.stdout).text()).trim();
        await nameProc.exited;
        if (name && !name.includes("ZeroPaste")) return name.slice(0, 240);
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

export async function getForegroundSource(): Promise<ForegroundSource> {
  const windowTitle = (await getForegroundWindowTitle()) ?? "Unknown app";
  return {
    appName: appNameFromWindowTitle(windowTitle),
    windowTitle,
    // kept for older callers that might expect device fields via spread elsewhere
  };
}

export function deviceLabel(): string {
  try {
    return hostname() || "This device";
  } catch {
    return "This device";
  }
}

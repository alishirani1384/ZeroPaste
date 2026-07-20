/** Best-effort foreground app / window metadata for clip source. */

import { hostname } from "node:os";

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

async function getForegroundWindowTitle(): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const proc = Bun.spawn(
        [
          "powershell",
          "-NoProfile",
          "-Command",
          `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ZpSrc {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$h = [ZpSrc]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][ZpSrc]::GetWindowText($h, $sb, $sb.Capacity)
$t = $sb.ToString()
if ($t) { $t } else { '' }
`,
        ],
        { stdout: "pipe", stderr: "ignore" },
      );
      const name = (await new Response(proc.stdout).text()).trim();
      await proc.exited;
      if (name && name !== "ZeroPaste") return name.slice(0, 240);
    } catch {
      /* ignore */
    }
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
    windowTitle,
    appName: appNameFromWindowTitle(windowTitle),
  };
}

export function deviceLabel(): string {
  try {
    return hostname() || "This device";
  } catch {
    return "This device";
  }
}

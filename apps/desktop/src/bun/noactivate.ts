/**
 * Keep the shelf from stealing the caret.
 * Windows: WS_EX_NOACTIVATE. Linux/macOS: Electrobun showInactive + never activate panel.
 */

import {
  applyNoActivateByTitle as applyWin,
  clearNoActivateByTitle as clearWin,
  isZeroPasteForeground as isWinForeground,
} from "./win32-noactivate";
import { commandExists } from "./platform/session";

/** Soft mode flag for Linux — panel should not call win.activate(). */
let panelNoActivate = false;

export async function applyNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  panelNoActivate = true;
  if (process.platform === "win32") return applyWin(title);
  console.log("[ZeroPaste] panel no-activate mode (showInactive) enabled");
  return true;
}

export async function clearNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  panelNoActivate = false;
  if (process.platform === "win32") return clearWin(title);
  console.log("[ZeroPaste] panel no-activate mode cleared (vault can focus)");
  return true;
}

export function isPanelNoActivateMode(): boolean {
  return panelNoActivate;
}

export async function isZeroPasteForeground(title = "ZeroPaste"): Promise<boolean> {
  if (process.platform === "win32") return isWinForeground(title);

  if (process.platform === "linux") {
    try {
      if (await commandExists("xdotool")) {
        const idProc = Bun.spawn(["xdotool", "getactivewindow"], {
          stdout: "pipe",
          stderr: "ignore",
        });
        const id = (await new Response(idProc.stdout).text()).trim();
        if ((await idProc.exited) !== 0 || !id) return false;
        const nameProc = Bun.spawn(["xdotool", "getwindowname", id], {
          stdout: "pipe",
          stderr: "ignore",
        });
        const name = (await new Response(nameProc.stdout).text()).trim();
        await nameProc.exited;
        return name === title || name.includes("ZeroPaste");
      }
    } catch {
      /* ignore */
    }
    // Wayland often can't query active window title — assume caret app still focused
    // when we used showInactive (panelNoActivate).
    return false;
  }

  return false;
}

/**
 * Remember the caret app, and (only when needed) soft-activate it for paste.
 * Windows: user32 AttachThreadInput (no ShowWindow on maximized windows).
 * Linux: xdotool window id capture / activate.
 */

import { commandExists } from "./platform/session";

let targetHwnd: string | null = null;
let targetFocusHwnd: string | null = null;

async function runPs(script: string): Promise<string> {
  const proc = Bun.spawn(["powershell", "-NoProfile", "-STA", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(err.trim() || `powershell exited ${code}`);
  }
  return out.trim();
}

const FOCUS_HELPER = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ZpFocus {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)]
  public struct GUITHREADINFO {
    public int cbSize;
    public int flags;
    public IntPtr hwndActive;
    public IntPtr hwndFocus;
    public IntPtr hwndCapture;
    public IntPtr hwndMenuOwner;
    public IntPtr hwndMoveSize;
    public IntPtr hwndCaret;
    public RECT rcCaret;
  }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO info);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  public const int SW_RESTORE = 9;
  public const int SW_SHOWNOACTIVATE = 4;
  public static string TitleOf(IntPtr h) {
    var sb = new StringBuilder(512);
    GetWindowText(h, sb, sb.Capacity);
    return sb.ToString();
  }
}
"@
`;

async function captureWin32(skipIfTitle?: string): Promise<void> {
  const skip = (skipIfTitle ?? "").replace(/'/g, "''");
  const out = await runPs(`
${FOCUS_HELPER}
$fg = [ZpFocus]::GetForegroundWindow()
if ($fg -eq [IntPtr]::Zero) { Write-Output '0|0'; exit 0 }
$title = [ZpFocus]::TitleOf($fg)
if ('${skip}' -ne '' -and $title -eq '${skip}') { Write-Output 'skip'; exit 0 }
$procId = [uint32]0
$tid = [ZpFocus]::GetWindowThreadProcessId($fg, [ref]$procId)
$info = New-Object ZpFocus+GUITHREADINFO
$info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf([type][ZpFocus+GUITHREADINFO])
$focus = $fg
if ([ZpFocus]::GetGUIThreadInfo($tid, [ref]$info) -and $info.hwndFocus -ne [IntPtr]::Zero) {
  $focus = $info.hwndFocus
}
Write-Output ($fg.ToInt64().ToString() + '|' + $focus.ToInt64().ToString() + '|' + $title)
`);
  if (!out || out === "skip") return;
  const [fg, focus, title] = out.split("|");
  if (fg && fg !== "0") {
    targetHwnd = fg;
    targetFocusHwnd = focus && focus !== "0" ? focus : fg;
    console.log("[ZeroPaste] focus target", { fg, focus: targetFocusHwnd, title });
  }
}

async function captureLinux(skipIfTitle?: string): Promise<void> {
  if (!(await commandExists("xdotool"))) {
    console.warn("[ZeroPaste] xdotool missing — cannot capture focus target on Linux");
    return;
  }
  const idProc = Bun.spawn(["xdotool", "getactivewindow"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const id = (await new Response(idProc.stdout).text()).trim();
  if ((await idProc.exited) !== 0 || !id) return;

  const nameProc = Bun.spawn(["xdotool", "getwindowname", id], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const title = (await new Response(nameProc.stdout).text()).trim();
  await nameProc.exited;

  if (skipIfTitle && (title === skipIfTitle || title.includes("ZeroPaste"))) {
    return;
  }

  targetHwnd = id;
  targetFocusHwnd = id;
  console.log("[ZeroPaste] focus target (linux)", { id, title });
}

/** Call right before ZeroPaste may take focus (hotkey / tray show). */
export async function captureFocusTarget(): Promise<void> {
  if (process.platform === "win32") {
    try {
      await captureWin32();
    } catch (err) {
      console.warn("[ZeroPaste] captureFocusTarget failed", err);
    }
    return;
  }
  if (process.platform === "linux") {
    try {
      await captureLinux();
    } catch (err) {
      console.warn("[ZeroPaste] captureFocusTarget failed", err);
    }
  }
}

/** Refresh target from the real foreground app (skip ZeroPaste). */
export async function captureFocusTargetIfExternal(): Promise<void> {
  if (process.platform === "win32") {
    try {
      await captureWin32("ZeroPaste");
    } catch (err) {
      console.warn("[ZeroPaste] captureFocusTargetIfExternal failed", err);
    }
    return;
  }
  if (process.platform === "linux") {
    try {
      await captureLinux("ZeroPaste");
    } catch (err) {
      console.warn("[ZeroPaste] captureFocusTargetIfExternal failed", err);
    }
  }
}

/**
 * Soft-activate the caret app WITHOUT changing maximized/normal size.
 */
export async function restoreFocusTarget(): Promise<boolean> {
  if (!targetHwnd) {
    console.warn("[ZeroPaste] no focus target stored");
    return false;
  }

  if (process.platform === "win32") {
    try {
      const result = await runPs(`
${FOCUS_HELPER}
$h = [IntPtr]${targetHwnd}
if (-not [ZpFocus]::IsWindow($h)) { Write-Output 'dead'; exit 0 }
if ([ZpFocus]::IsIconic($h)) {
  [void][ZpFocus]::ShowWindow($h, [ZpFocus]::SW_RESTORE)
} elseif (-not [ZpFocus]::IsWindowVisible($h)) {
  [void][ZpFocus]::ShowWindow($h, [ZpFocus]::SW_SHOWNOACTIVATE)
}
$fore = [ZpFocus]::GetForegroundWindow()
if ($fore -eq $h) { Write-Output 'already'; exit 0 }
$forePid = [uint32]0
$foreTid = [ZpFocus]::GetWindowThreadProcessId($fore, [ref]$forePid)
$targetPid = [uint32]0
$targetTid = [ZpFocus]::GetWindowThreadProcessId($h, [ref]$targetPid)
$curTid = [ZpFocus]::GetCurrentThreadId()
$attachedFore = $false
$attachedTarget = $false
if ($foreTid -ne 0 -and $foreTid -ne $curTid) {
  $attachedFore = [ZpFocus]::AttachThreadInput($curTid, $foreTid, $true)
}
if ($targetTid -ne 0 -and $targetTid -ne $curTid) {
  $attachedTarget = [ZpFocus]::AttachThreadInput($curTid, $targetTid, $true)
}
$ok = [ZpFocus]::SetForegroundWindow($h)
if ($attachedFore) { [void][ZpFocus]::AttachThreadInput($curTid, $foreTid, $false) }
if ($attachedTarget) { [void][ZpFocus]::AttachThreadInput($curTid, $targetTid, $false) }
$now = [ZpFocus]::TitleOf([ZpFocus]::GetForegroundWindow())
Write-Output ("ok=" + $ok + ";fg=" + $now)
`);
      console.log("[ZeroPaste] restoreFocus(soft)", result);
      return result === "already" || result.startsWith("ok=");
    } catch (err) {
      console.warn("[ZeroPaste] restoreFocusTarget failed", err);
      return false;
    }
  }

  if (process.platform === "linux") {
    try {
      if (!(await commandExists("xdotool"))) return false;
      const proc = Bun.spawn(["xdotool", "windowactivate", "--sync", targetHwnd], {
        stdout: "ignore",
        stderr: "ignore",
      });
      const ok = (await proc.exited) === 0;
      console.log("[ZeroPaste] restoreFocus(linux)", { targetHwnd, ok });
      return ok;
    } catch (err) {
      console.warn("[ZeroPaste] restoreFocusTarget failed", err);
      return false;
    }
  }

  return false;
}

export function getFocusTarget(): string | null {
  return targetHwnd;
}

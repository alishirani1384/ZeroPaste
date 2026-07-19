/**
 * Windows: WS_EX_NOACTIVATE so clicks on the shelf do not steal the caret.
 * Disable this style while the vault gate needs keyboard focus.
 */

const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_TOPMOST = 0x00000008;
const WS_EX_TOOLWINDOW = 0x00000080;
const GWL_EXSTYLE = -20;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_FRAMECHANGED = 0x0020;
const HWND_TOPMOST = -1;

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
  if (code !== 0) throw new Error(err.trim() || `powershell ${code}`);
  return out.trim();
}

const FIND_HELPER = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ZpNoAct {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public static IntPtr FindByTitle(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, sb.Capacity);
      if (sb.ToString() == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
`;

export async function applyNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const safeTitle = title.replace(/'/g, "''");
  try {
    const result = await runPs(`
${FIND_HELPER}
$h = [ZpNoAct]::FindByTitle('${safeTitle}')
if ($h -eq [IntPtr]::Zero) { Write-Output 'missing'; exit 0 }
$style = [ZpNoAct]::GetWindowLong($h, ${GWL_EXSTYLE})
$style = $style -bor ${WS_EX_NOACTIVATE} -bor ${WS_EX_TOPMOST} -bor ${WS_EX_TOOLWINDOW}
[void][ZpNoAct]::SetWindowLong($h, ${GWL_EXSTYLE}, $style)
[void][ZpNoAct]::SetWindowPos($h, [IntPtr]${HWND_TOPMOST}, 0, 0, 0, 0, ${SWP_NOMOVE} -bor ${SWP_NOSIZE} -bor ${SWP_FRAMECHANGED})
Write-Output $h.ToInt64()
`);
    if (!result || result === "missing") {
      console.warn("[ZeroPaste] noactivate: window not found");
      return false;
    }
    console.log("[ZeroPaste] NOACTIVATE on hwnd=", result);
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] applyNoActivate failed", err);
    return false;
  }
}

/** Allow keyboard focus again (vault passphrase). */
export async function clearNoActivateByTitle(title = "ZeroPaste"): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const safeTitle = title.replace(/'/g, "''");
  try {
    const result = await runPs(`
${FIND_HELPER}
$h = [ZpNoAct]::FindByTitle('${safeTitle}')
if ($h -eq [IntPtr]::Zero) { Write-Output 'missing'; exit 0 }
$style = [ZpNoAct]::GetWindowLong($h, ${GWL_EXSTYLE})
$style = $style -band (-bnot ${WS_EX_NOACTIVATE})
$style = $style -bor ${WS_EX_TOPMOST}
[void][ZpNoAct]::SetWindowLong($h, ${GWL_EXSTYLE}, $style)
[void][ZpNoAct]::SetWindowPos($h, [IntPtr]${HWND_TOPMOST}, 0, 0, 0, 0, ${SWP_NOMOVE} -bor ${SWP_NOSIZE} -bor ${SWP_FRAMECHANGED})
Write-Output 'cleared'
`);
    console.log("[ZeroPaste] NOACTIVATE cleared", result);
    return result !== "missing";
  } catch (err) {
    console.warn("[ZeroPaste] clearNoActivate failed", err);
    return false;
  }
}

export async function isZeroPasteForeground(title = "ZeroPaste"): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const safeTitle = title.replace(/'/g, "''");
  try {
    const name = await runPs(`
${FIND_HELPER}
$h = [ZpNoAct]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][ZpNoAct]::GetWindowText($h, $sb, $sb.Capacity)
$sb.ToString()
`);
    return name === title;
  } catch {
    return false;
  }
}

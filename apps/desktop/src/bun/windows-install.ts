/**
 * Windows desktop integration Electrobun's stock Setup.exe does not provide:
 * - Desktop + Start Menu shortcuts
 * - Apps & Features uninstall entry
 * - A silent uninstall script
 *
 * Called on every launch; uninstall registration must succeed even if shortcuts fail.
 */
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { isPackagedAppProcess, resolveLaunchPath } from "./autostart";

const APP_NAME = "ZeroPaste";
const UNINSTALL_KEY =
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ZeroPaste";
const MARKER = () => join(homedir(), ".zeropaste", "windows-integration.json");

type Marker = {
  launchPath: string;
  desktopShortcut: string;
  startMenuShortcut: string;
  uninstallScript: string;
};

function desktopDir(): string {
  // Prefer OneDrive Desktop when Windows redirects it there.
  const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer;
  if (oneDrive) {
    const od = join(oneDrive, "Desktop");
    if (existsSync(od)) return od;
  }
  return join(homedir(), "Desktop");
}

function startMenuDir(): string {
  return join(homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs");
}

function zdir(): string {
  return join(homedir(), ".zeropaste");
}

async function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

async function pathExists(path: string): Promise<boolean> {
  return existsSync(path);
}

async function runPs(script: string): Promise<void> {
  const { spawnHiddenPowerShell } = await import("./platform/hidden-powershell");
  const { code, stderr } = await spawnHiddenPowerShell(["-ExecutionPolicy", "Bypass", "-Command", script], {
    stdout: "ignore",
    stderr: "pipe",
  });
  if (code !== 0) throw new Error(stderr || `powershell exited ${code}`);
}

function resolveIconPath(launchPath: string): string {
  const dir = dirname(launchPath);
  const candidates = [
    join(dir, "zeropaste.ico"),
    join(dir, "..", "Resources", "app", "views", "mainview", "zeropaste.ico"),
    join(dir, "..", "Resources", "app", "views", "mainview", "zeropaste.png"),
    join(dir, "..", "assets", "zeropaste.ico"),
    join(dirname(dirname(dir)), "assets", "zeropaste.ico"),
  ];
  for (const c of candidates) {
    try {
      if (Bun.file(c).size > 0) return c;
    } catch {
      /* continue */
    }
  }
  return launchPath;
}

/** Prefer a double-clickable target for shortcuts (launcher.exe > launcher > bun.exe). */
function shortcutTarget(launchPath: string): string {
  const dir = dirname(launchPath);
  const lower = launchPath.replace(/\\/g, "/").toLowerCase();
  if (lower.endsWith("/bun.exe") || lower.endsWith("/bun")) {
    for (const name of ["launcher.exe", "launcher", "ZeroPaste.exe"]) {
      const c = join(dir, name);
      try {
        if (Bun.file(c).size > 0) return c;
      } catch {
        /* continue */
      }
    }
  }
  return launchPath;
}

async function createShortcut(lnkPath: string, target: string, icon: string, workDir: string) {
  const ps = `
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut(${JSON.stringify(lnkPath)})
$s.TargetPath = ${JSON.stringify(target)}
$s.WorkingDirectory = ${JSON.stringify(workDir)}
$s.WindowStyle = 1
$s.Description = ${JSON.stringify(APP_NAME)}
$s.IconLocation = ${JSON.stringify(`${icon},0`)}
$s.Save()
`;
  await runPs(ps);
}

async function writeUninstallScript(launchPath: string): Promise<string> {
  await ensureDir(zdir());
  const scriptPath = join(zdir(), "uninstall.ps1");
  const localApp = join(
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
    "app.zeropaste.desktop",
  );

  const body = `# ZeroPaste full uninstall
# Settings → Apps → ZeroPaste → Uninstall
# Or: powershell -NoProfile -ExecutionPolicy Bypass -File "$PSCommandPath"
$ErrorActionPreference = 'SilentlyContinue'
Write-Host "Uninstalling ZeroPaste..."

Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(launcher|bun|electrobun|ZeroPaste)' -and
  ($_.CommandLine -match 'zeropaste|ZeroPaste|app\\.zeropaste' -or $_.ExecutablePath -match 'zeropaste|ZeroPaste|app\\.zeropaste')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ZeroPaste /f | Out-Null

$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
Remove-Item (Join-Path $desktop 'ZeroPaste.lnk') -Force
Remove-Item (Join-Path $start 'ZeroPaste.lnk') -Force

$install = ${JSON.stringify(localApp)}
if (Test-Path $install) { Remove-Item $install -Recurse -Force }

$udata = Join-Path $env:USERPROFILE '.zeropaste'
# Delete uninstall entry before wiping this folder (script lives here)
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ZeroPaste" /f | Out-Null
if (Test-Path $udata) { Remove-Item $udata -Recurse -Force }

Write-Host "ZeroPaste removed."
`;
  await Bun.write(scriptPath, body);
  console.log("[ZeroPaste] wrote uninstall script", scriptPath);
  return scriptPath;
}

async function registerUninstall(launchPath: string, uninstallScript: string, icon: string) {
  const displayIcon = icon.toLowerCase().endsWith(".ico") ? icon : launchPath;
  const uninstallCmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${uninstallScript}"`;
  const version = "0.0.1";
  const adds: Array<[string, string, string]> = [
    ["DisplayName", "REG_SZ", APP_NAME],
    ["Publisher", "REG_SZ", "ZeroPaste"],
    ["DisplayVersion", "REG_SZ", version],
    ["InstallLocation", "REG_SZ", dirname(launchPath)],
    ["DisplayIcon", "REG_SZ", displayIcon],
    ["UninstallString", "REG_SZ", uninstallCmd],
    ["QuietUninstallString", "REG_SZ", uninstallCmd],
    ["NoModify", "REG_DWORD", "1"],
    ["NoRepair", "REG_DWORD", "1"],
  ];

  await Bun.spawn(["reg", "add", UNINSTALL_KEY, "/f"], {
    stdout: "ignore",
    stderr: "ignore",
    windowsHide: true,
  } as Parameters<typeof Bun.spawn>[1]).exited;

  for (const [name, type, data] of adds) {
    const proc = Bun.spawn(
      ["reg", "add", UNINSTALL_KEY, "/v", name, "/t", type, "/d", data, "/f"],
      { stdout: "ignore", stderr: "pipe", windowsHide: true } as Parameters<typeof Bun.spawn>[1],
    );
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr as ReadableStream).text();
      console.warn("[ZeroPaste] uninstall reg", name, err.trim());
    }
  }
  console.log("[ZeroPaste] registered Apps & Features uninstall entry");
}

async function readMarker(): Promise<Marker | null> {
  try {
    const f = Bun.file(MARKER());
    if (!(await f.exists())) return null;
    return (await f.json()) as Marker;
  } catch {
    return null;
  }
}

function isIntegrableLaunchPath(launchPath: string): boolean {
  const base = launchPath.replace(/\\/g, "/").toLowerCase();
  if (base.endsWith("/launcher.exe") || base.endsWith("/launcher")) return true;
  if (base.endsWith("/zeropaste.exe")) return true;
  // Installed / packaged host often executes as bun.exe inside the app bundle.
  if ((base.endsWith("/bun.exe") || base.endsWith("/bun")) && isPackagedAppProcess()) return true;
  return isPackagedAppProcess();
}

/**
 * Create desktop + Start Menu shortcuts and register uninstall in Apps & Features.
 * Uninstall script is written first and never skipped when shortcuts fail.
 */
export async function ensureWindowsDesktopIntegration(): Promise<void> {
  if (process.platform !== "win32") return;

  const launchPath = resolveLaunchPath();
  console.log("[ZeroPaste] desktop integration launchPath=", launchPath, "execPath=", process.execPath);

  if (!isIntegrableLaunchPath(launchPath)) {
    console.log("[ZeroPaste] skip desktop integration (not a packaged app process)");
    return;
  }

  const target = shortcutTarget(launchPath);
  const icon = resolveIconPath(target);
  const workDir = dirname(target);

  // 1) Always write uninstall.ps1 + registry — even if shortcuts fail.
  let uninstallScript: string;
  try {
    uninstallScript = await writeUninstallScript(target);
    await registerUninstall(target, uninstallScript, icon);
  } catch (err) {
    console.warn("[ZeroPaste] uninstall registration failed", err);
    return;
  }

  // 2) Shortcuts (best-effort)
  const desktopLnk = join(desktopDir(), `${APP_NAME}.lnk`);
  const startLnk = join(startMenuDir(), `${APP_NAME}.lnk`);
  try {
    const prev = await readMarker();
    const needsShortcuts =
      !prev ||
      prev.launchPath !== target ||
      !(await pathExists(desktopLnk)) ||
      !(await pathExists(startLnk));

    if (needsShortcuts) {
      await ensureDir(startMenuDir());
      await createShortcut(desktopLnk, target, icon, workDir);
      await createShortcut(startLnk, target, icon, workDir);
      console.log("[ZeroPaste] shortcuts", desktopLnk, startLnk);
    }
  } catch (err) {
    console.warn("[ZeroPaste] shortcut creation failed (uninstall still registered)", err);
  }

  try {
    await ensureDir(zdir());
    const marker: Marker = {
      launchPath: target,
      desktopShortcut: desktopLnk,
      startMenuShortcut: startLnk,
      uninstallScript,
    };
    await Bun.write(MARKER(), JSON.stringify(marker, null, 2));
    console.log("[ZeroPaste] Windows integration ready");
  } catch (err) {
    console.warn("[ZeroPaste] integration marker write failed", err);
  }
}

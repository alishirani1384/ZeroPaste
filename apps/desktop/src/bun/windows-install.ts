/**
 * Windows desktop integration Electrobun's stock Setup.exe does not provide:
 * - Desktop + Start Menu shortcuts
 * - Apps & Features uninstall entry
 * - A silent uninstall script
 *
 * Called on first launch (and refreshed when the install path changes).
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { resolveLaunchPath } from "./autostart";

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
  return join(homedir(), "Desktop");
}

function startMenuDir(): string {
  return join(homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs");
}

function zdir(): string {
  return join(homedir(), ".zeropaste");
}

async function ensureDir(path: string) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path, { recursive: true });
}

async function runPs(script: string): Promise<void> {
  const proc = Bun.spawn(
    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { stdout: "pipe", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err.trim() || `powershell exited ${code}`);
  }
}

function resolveIconPath(launchPath: string): string {
  const dir = dirname(launchPath);
  const candidates = [
    join(dir, "zeropaste.ico"),
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
  return launchPath; // fall back to exe icon
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
  const installRoot = dirname(dirname(launchPath)); // .../bin/launcher.exe → app root often one up from bin
  // Electrobun stable: %LOCALAPPDATA%\app.zeropaste.desktop\stable\...
  const localApp = join(
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
    "app.zeropaste.desktop",
  );

  const body = `# ZeroPaste full uninstall — run via Apps & Features or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "$PSCommandPath"
$ErrorActionPreference = 'SilentlyContinue'
Write-Host "Uninstalling ZeroPaste..."

# Stop running instances
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(launcher|bun|electrobun|ZeroPaste)' -and
  ($_.CommandLine -match 'zeropaste|ZeroPaste' -or $_.ExecutablePath -match 'zeropaste|ZeroPaste')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Login autostart
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ZeroPaste /f | Out-Null

# Shortcuts
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
Remove-Item (Join-Path $desktop 'ZeroPaste.lnk') -Force
Remove-Item (Join-Path $start 'ZeroPaste.lnk') -Force

# App install tree (Electrobun channel folders)
$install = ${JSON.stringify(localApp)}
if (Test-Path $install) { Remove-Item $install -Recurse -Force }

# Also try the directory that contained the launcher we registered
$launchDir = ${JSON.stringify(dirname(launchPath))}
$appRoot = ${JSON.stringify(installRoot)}
if (Test-Path $appRoot -and $appRoot -notmatch 'OneDrive\\\\Desktop\\\\paste') {
  # Only delete if it looks like an installed copy under LocalAppData, not the monorepo
  if ($appRoot -like "*app.zeropaste.desktop*") {
    Remove-Item $appRoot -Recurse -Force
  }
}

# User data (vault meta, clips, autostart vbs) — remove for a full wipe
$udata = Join-Path $env:USERPROFILE '.zeropaste'
if (Test-Path $udata) { Remove-Item $udata -Recurse -Force }

# Uninstall registry entry (self)
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ZeroPaste" /f | Out-Null

Write-Host "ZeroPaste removed."
`;
  await Bun.write(scriptPath, body);
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

  // Ensure key exists
  await Bun.spawn(
    ["reg", "add", UNINSTALL_KEY, "/f"],
    { stdout: "ignore", stderr: "ignore" },
  ).exited;

  for (const [name, type, data] of adds) {
    const proc = Bun.spawn(
      ["reg", "add", UNINSTALL_KEY, "/v", name, "/t", type, "/d", data, "/f"],
      { stdout: "ignore", stderr: "pipe" },
    );
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      console.warn("[ZeroPaste] uninstall reg", name, err.trim());
    }
  }
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

/**
 * Create desktop + Start Menu shortcuts and register uninstall in Apps & Features.
 * Safe to call on every boot — no-ops when already current.
 */
export async function ensureWindowsDesktopIntegration(): Promise<void> {
  if (process.platform !== "win32") return;

  const launchPath = resolveLaunchPath();
  const base = launchPath.replace(/\\/g, "/").toLowerCase();
  // Only integrate when we have a real app launcher (not a bare bun from PATH).
  if (!base.endsWith("/launcher.exe") && !base.endsWith("/zeropaste.exe")) {
    console.log("[ZeroPaste] skip desktop integration (no launcher.exe)");
    return;
  }

  try {
    await ensureDir(zdir());
    const icon = resolveIconPath(launchPath);
    const workDir = dirname(launchPath);
    const desktopLnk = join(desktopDir(), `${APP_NAME}.lnk`);
    const startLnk = join(startMenuDir(), `${APP_NAME}.lnk`);

    const prev = await readMarker();
    const needsShortcuts =
      !prev ||
      prev.launchPath !== launchPath ||
      !(await Bun.file(desktopLnk).exists()) ||
      !(await Bun.file(startLnk).exists());

    if (needsShortcuts) {
      await createShortcut(desktopLnk, launchPath, icon, workDir);
      await ensureDir(startMenuDir());
      await createShortcut(startLnk, launchPath, icon, workDir);
      console.log("[ZeroPaste] shortcuts", desktopLnk, startLnk);
    }

    const uninstallScript = await writeUninstallScript(launchPath);
    await registerUninstall(launchPath, uninstallScript, icon);

    const marker: Marker = {
      launchPath,
      desktopShortcut: desktopLnk,
      startMenuShortcut: startLnk,
      uninstallScript,
    };
    await Bun.write(MARKER(), JSON.stringify(marker, null, 2));
    console.log("[ZeroPaste] Windows integration ready (desktop shortcut + uninstall)");
  } catch (err) {
    console.warn("[ZeroPaste] Windows desktop integration failed", err);
  }
}

/**
 * Register ZeroPaste to launch when the user logs into Windows / Linux.
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const RUN_VALUE = "ZeroPaste";
const PREF_PATH = () => join(homedir(), ".zeropaste", "autostart.json");

type Pref = { enabled: boolean };

async function readPref(): Promise<Pref | null> {
  try {
    const file = Bun.file(PREF_PATH());
    if (!(await file.exists())) return null;
    return (await file.json()) as Pref;
  } catch {
    return null;
  }
}

async function writePref(enabled: boolean) {
  const dir = join(homedir(), ".zeropaste");
  try {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  await Bun.write(PREF_PATH(), JSON.stringify({ enabled }, null, 2));
}

function fileExists(path: string): boolean {
  try {
    return Bun.file(path).size >= 0;
  } catch {
    return false;
  }
}

/** Best-effort path to the installed launcher / AppImage / current binary. */
export function resolveLaunchPath(): string {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;
  const exe = process.execPath;
  if (process.platform === "win32") {
    const dir = dirname(exe);
    const candidates = [
      join(dir, "launcher.exe"),
      join(dir, "..", "launcher.exe"),
      join(dir, "ZeroPaste.exe"),
      exe,
    ];
    for (const c of candidates) {
      try {
        if (Bun.file(c).size >= 0) return c;
      } catch {
        /* continue */
      }
    }
  }
  return exe;
}

async function enableWindows(launchPath: string): Promise<void> {
  const value = `"${launchPath}"`;
  const proc = Bun.spawn(
    [
      "reg",
      "add",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "/v",
      RUN_VALUE,
      "/t",
      "REG_SZ",
      "/d",
      value,
      "/f",
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err.trim() || "reg add failed");
  }
}

async function disableWindows(): Promise<void> {
  const proc = Bun.spawn(
    [
      "reg",
      "delete",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "/v",
      RUN_VALUE,
      "/f",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  await proc.exited; // ok if missing
}

async function isEnabledWindows(): Promise<boolean> {
  const proc = Bun.spawn(
    [
      "reg",
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "/v",
      RUN_VALUE,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  return (await proc.exited) === 0;
}

function linuxDesktopPath(): string {
  return join(homedir(), ".config", "autostart", "zeropaste.desktop");
}

async function enableLinux(launchPath: string): Promise<void> {
  const autostartDir = join(homedir(), ".config", "autostart");
  try {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(autostartDir, { recursive: true });
  } catch {
    /* ignore */
  }
  const iconHint = join(dirname(launchPath), "zeropaste.png");
  const icon = fileExists(iconHint) ? iconHint : "zeropaste";
  const body = `[Desktop Entry]
Type=Application
Version=1.0
Name=ZeroPaste
Comment=ZeroPaste clipboard manager
Exec="${launchPath.replace(/"/g, '\\"')}"
Icon=${icon}
Terminal=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
  await Bun.write(linuxDesktopPath(), body);
}

async function disableLinux(): Promise<void> {
  try {
    const path = linuxDesktopPath();
    if (await Bun.file(path).exists()) await Bun.$`rm -f ${path}`.quiet();
  } catch {
    /* ignore */
  }
}

async function isEnabledLinux(): Promise<boolean> {
  try {
    return await Bun.file(linuxDesktopPath()).exists();
  } catch {
    return false;
  }
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (process.platform === "win32") return isEnabledWindows();
  if (process.platform === "linux") return isEnabledLinux();
  return false;
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  const launchPath = resolveLaunchPath();
  try {
    if (enabled) {
      if (process.platform === "win32") await enableWindows(launchPath);
      else if (process.platform === "linux") await enableLinux(launchPath);
      else return false;
    } else {
      if (process.platform === "win32") await disableWindows();
      else if (process.platform === "linux") await disableLinux();
      else return false;
    }
    await writePref(enabled);
    console.log("[ZeroPaste] autostart", enabled ? "enabled" : "disabled", launchPath);
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] autostart failed", err);
    return false;
  }
}

/** Enable on first run so ZeroPaste starts with the OS login session. */
export async function ensureDefaultAutostart(): Promise<void> {
  if (process.platform !== "win32" && process.platform !== "linux") return;
  const pref = await readPref();
  if (pref) return; // user already chose
  const ok = await setAutostartEnabled(true);
  if (!ok) console.warn("[ZeroPaste] could not enable default autostart");
}

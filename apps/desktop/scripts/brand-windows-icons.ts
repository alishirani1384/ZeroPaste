/**
 * Electrobun's CLI cannot resolve `rcedit` (https://github.com/blackboardsh/electrobun/issues/429),
 * so Windows icons never embed cleanly. Brand PE binaries ourselves.
 *
 * Important: plain `rcedit --set-icon` leaves Bun's original RT_GROUP_ICON around and
 * reuses icon IDs, so the primary group can point at a 16×16 bitmap. Windows then
 * upscales that for the taskbar → blurry icon.
 *
 * Strategy:
 * 1) Prefer `resedit` (strip all icon resources, write one clean multi-size group).
 * 2) Fall back to Win32 UpdateResource for large Electrobun `bun.exe` which pe-library
 *    cannot parse (~100MB+ host binary).
 *
 * Hook order:
 * - postBuild  → brand launcher/bun inside the app bundle BEFORE tar.zst is created
 * - postPackage → brand ZeroPaste-Setup.exe after the extractor is written
 */
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as ResEdit from "resedit";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ico = join(root, "assets", "zeropaste.ico");
const win32Script = join(root, "scripts", "win32-set-icon.ps1");

/** RT_ICON / RT_GROUP_ICON */
const RT_ICON = 3;
const RT_GROUP_ICON = 14;

function collectTargets(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // Skip huge CEF trees — icons only matter on launchers / bun / setup.
      if (name === "lib" || name === "locales" || name === "swiftshader") continue;
      collectTargets(full, out);
      continue;
    }
    const lower = name.toLowerCase();
    // Only PE binaries — skip archives / metadata / temp copies.
    if (lower.includes(".prebrand") || lower.includes("bun-copy") || lower.includes(".branding.tmp")) {
      continue;
    }
    if (lower.endsWith(".exe") || lower === "launcher" || lower === "bun") {
      out.push(full);
    }
  }
  return out;
}

/** Replace every icon resource with one clean multi-size ZeroPaste group (resedit). */
function setCleanIconResedit(exePath: string, icoPath: string) {
  const data = readFileSync(exePath);
  const exe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  for (let i = res.entries.length - 1; i >= 0; --i) {
    const type = res.entries[i]?.type;
    if (type === RT_ICON || type === RT_GROUP_ICON) {
      res.entries.splice(i, 1);
    }
  }

  const iconFile = ResEdit.Data.IconFile.from(readFileSync(icoPath));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1,
    1033,
    iconFile.icons.map((item) => item.data),
  );

  res.outputResource(exe);
  const outPath = `${exePath}.branding.tmp`;
  writeFileSync(outPath, Buffer.from(exe.generate()));
  try {
    copyFileSync(outPath, exePath);
  } finally {
    try {
      unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

/** Win32 UpdateResource path — required for Electrobun bun.exe. */
function setCleanIconWin32(exePath: string, icoPath: string) {
  if (!existsSync(win32Script)) {
    throw new Error(`missing ${win32Script}`);
  }
  const r = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      win32Script,
      "-ExePath",
      exePath,
      "-IcoPath",
      icoPath,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 120_000,
    },
  );
  if (r.status !== 0) {
    throw new Error(
      `win32-set-icon failed (exit ${r.status}): ${(r.stderr || r.stdout || "").trim()}`,
    );
  }
}

function setCleanIcon(exePath: string, icoPath: string) {
  try {
    setCleanIconResedit(exePath, icoPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[brand-icons] resedit unavailable for ${exePath} (${msg.split("\n")[0]}) — Win32 fallback`);
    setCleanIconWin32(exePath, icoPath);
  }
}

function brand(exePath: string) {
  let target = exePath;
  let tempExe: string | null = null;
  if (!target.toLowerCase().endsWith(".exe")) {
    tempExe = `${target}.exe`;
    copyFileSync(target, tempExe);
    target = tempExe;
  }
  try {
    setCleanIcon(target, ico);
    // Only force GUI on the long-running app binaries. The Electrobun Setup
    // extractor is a console app — GUI subsystem makes double-click do nothing.
    if (shouldForceGuiSubsystem(exePath)) {
      setWindowsGuiSubsystem(target);
    }
    if (tempExe) {
      copyFileSync(tempExe, exePath);
      unlinkSync(tempExe);
      if (shouldForceGuiSubsystem(exePath)) setWindowsGuiSubsystem(exePath);
    }
    console.log(`[brand-icons] OK ${exePath}`);
  } catch (err) {
    if (tempExe && existsSync(tempExe)) unlinkSync(tempExe);
    console.warn(`[brand-icons] FAIL ${exePath}`, err);
  }
}

/** Runtime hosts only — never Setup / extractors / tooling. */
function shouldForceGuiSubsystem(exePath: string): boolean {
  const base = exePath.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (base.includes("setup")) return false;
  if (base.includes("zig-zstd") || base.includes("bsdiff") || base.includes("bspatch")) return false;
  return base === "launcher.exe" || base === "launcher" || base === "bun.exe" || base === "bun";
}

/** IMAGE_SUBSYSTEM_WINDOWS_GUI = 2 — no console window when double-clicked / Run key. */
function setWindowsGuiSubsystem(exePath: string) {
  try {
    const buf = Buffer.from(readFileSync(exePath));
    if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return; // MZ
    const pe = buf.readUInt32LE(0x3c);
    if (pe + 24 + 70 > buf.length) return;
    if (buf.toString("ascii", pe, pe + 4) !== "PE\0\0") return;
    const subOff = pe + 24 + 68;
    const prev = buf.readUInt16LE(subOff);
    if (prev === 2) return; // already GUI
    buf.writeUInt16LE(2, subOff);
    writeFileSync(exePath, buf);
    console.log(`[brand-icons] subsystem CONSOLE→GUI ${exePath} (was ${prev})`);
  } catch (err) {
    console.warn(`[brand-icons] subsystem patch failed ${exePath}`, err);
  }
}

/** Restore Electrobun Setup extractor to console (3) if we previously patched it. */
function setWindowsConsoleSubsystem(exePath: string) {
  try {
    const buf = Buffer.from(readFileSync(exePath));
    if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return;
    const pe = buf.readUInt32LE(0x3c);
    if (pe + 24 + 70 > buf.length) return;
    if (buf.toString("ascii", pe, pe + 4) !== "PE\0\0") return;
    const subOff = pe + 24 + 68;
    const prev = buf.readUInt16LE(subOff);
    if (prev === 3) return;
    buf.writeUInt16LE(3, subOff); // IMAGE_SUBSYSTEM_WINDOWS_CUI
    writeFileSync(exePath, buf);
    console.log(`[brand-icons] subsystem →CONSOLE ${exePath} (was ${prev})`);
  } catch (err) {
    console.warn(`[brand-icons] console subsystem restore failed ${exePath}`, err);
  }
}

function main() {
  if (process.env.ELECTROBUN_OS && process.env.ELECTROBUN_OS !== "win") {
    console.log("[brand-icons] skip (not Windows target)");
    return;
  }
  if (!existsSync(ico)) {
    console.warn(`[brand-icons] missing ${ico}`);
    return;
  }

  console.log(`[brand-icons] using resedit/Win32 + ${ico}`);

  if (process.platform !== "win32") {
    console.log("[brand-icons] skip (non-Windows host)");
    return;
  }

  const buildDir = process.env.ELECTROBUN_BUILD_DIR || join(root, "build");
  const targets = new Set(collectTargets(buildDir));

  const artifactDir = process.env.ELECTROBUN_ARTIFACT_DIR;
  if (artifactDir) {
    for (const t of collectTargets(artifactDir)) targets.add(t);
  }

  for (const t of targets) brand(t);

  for (const t of targets) {
    const base = t.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
    if (base.includes("setup") && base.endsWith(".exe")) setWindowsConsoleSubsystem(t);
  }

  console.log(`[brand-icons] done (${targets.size} targets)`);
}

main();

/**
 * Electrobun's CLI cannot resolve `rcedit` (https://github.com/blackboardsh/electrobun/issues/429),
 * so Windows icons never embed. Brand PE binaries ourselves with the rcedit next to electrobun.
 *
 * Hook order:
 * - postBuild  → brand launcher/bun inside the app bundle BEFORE tar.zst is created
 * - postPackage → brand ZeroPaste-Setup.exe after the extractor is written
 */
import { existsSync, readdirSync, statSync, copyFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ico = join(root, "assets", "zeropaste.ico");

function findRcedit(): string {
  const candidates = [
    join(root, "node_modules", "rcedit", "bin", "rcedit-x64.exe"),
    join(root, "..", "..", "node_modules", "rcedit", "bin", "rcedit-x64.exe"),
    join(
      root,
      "..",
      "..",
      "node_modules",
      ".bun",
      "rcedit@4.0.1",
      "node_modules",
      "rcedit",
      "bin",
      "rcedit-x64.exe",
    ),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  const bunMods = join(root, "..", "..", "node_modules", ".bun");
  if (existsSync(bunMods)) {
    for (const name of readdirSync(bunMods)) {
      if (!name.startsWith("rcedit@")) continue;
      const p = join(bunMods, name, "node_modules", "rcedit", "bin", "rcedit-x64.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("rcedit-x64.exe not found — run bun install");
}

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
    // Only PE binaries — skip archives / metadata that happen to match name prefixes.
    if (lower.endsWith(".exe") || lower === "launcher" || lower === "bun") {
      out.push(full);
    }
  }
  return out;
}

function brand(exePath: string, rcedit: string) {
  let target = exePath;
  let tempExe: string | null = null;
  if (!target.toLowerCase().endsWith(".exe")) {
    tempExe = `${target}.exe`;
    copyFileSync(target, tempExe);
    target = tempExe;
  }
  try {
    execFileSync(rcedit, [target, "--set-icon", ico], { stdio: "pipe" });
    if (tempExe) {
      copyFileSync(tempExe, exePath);
      unlinkSync(tempExe);
    }
    console.log(`[brand-icons] OK ${exePath}`);
  } catch (err) {
    if (tempExe && existsSync(tempExe)) unlinkSync(tempExe);
    console.warn(`[brand-icons] FAIL ${exePath}`, err);
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

  const rcedit = findRcedit();
  console.log(`[brand-icons] using ${rcedit}`);

  const buildDir = process.env.ELECTROBUN_BUILD_DIR || join(root, "build");
  const targets = new Set(collectTargets(buildDir));

  // Also catch artifacts folder Setup copies
  const artifactDir = process.env.ELECTROBUN_ARTIFACT_DIR;
  if (artifactDir) {
    for (const t of collectTargets(artifactDir)) targets.add(t);
  }

  for (const t of targets) brand(t, rcedit);
  console.log(`[brand-icons] done (${targets.size} targets)`);
}

main();

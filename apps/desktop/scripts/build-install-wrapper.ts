/**
 * Build "Install ZeroPaste.exe" — runs Electrobun Setup, then launches the app.
 * Injects the wrapper into Windows installer zips after Electrobun packaging.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const csPath = join(root, "scripts", "install-and-run.cs");
const icoPath = join(root, "assets", "zeropaste.ico");
const outName = "Install ZeroPaste.exe";

function findCsc(): string | null {
  const bases = [
    join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64"),
    join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework"),
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const versions = readdirSync(base)
      .filter((n) => n.startsWith("v4."))
      .sort()
      .reverse();
    for (const v of versions) {
      const csc = join(base, v, "csc.exe");
      if (existsSync(csc)) return csc;
    }
  }
  return null;
}

function compileWrapper(outPath: string) {
  const csc = findCsc();
  if (!csc) throw new Error("csc.exe not found (need .NET Framework 4.x)");
  if (!existsSync(csPath)) throw new Error(`missing ${csPath}`);

  mkdirSync(dirname(outPath), { recursive: true });
  const args = [
    "/nologo",
    "/target:winexe",
    "/optimize+",
    `/out:${outPath}`,
    csPath,
  ];
  if (existsSync(icoPath)) args.splice(-1, 0, `/win32icon:${icoPath}`);

  const r = spawnSync(csc, args, { encoding: "utf8", windowsHide: true });
  if (r.status !== 0) {
    throw new Error(`csc failed:\n${r.stdout || ""}\n${r.stderr || ""}`);
  }
  if (!existsSync(outPath)) throw new Error("wrapper exe was not produced");
  console.log(`[install-wrapper] compiled ${outPath} (${statSync(outPath).size} bytes)`);
}

function injectIntoZip(zipPath: string, wrapperPath: string) {
  const staging = join(root, "build", ".install-wrapper-staging");
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  const expand = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${staging.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (expand.status !== 0) {
    throw new Error(`Expand-Archive failed: ${expand.stderr || expand.stdout}`);
  }

  copyFileSync(wrapperPath, join(staging, outName));

  // Rewrite zip in place (Compress-Archive cannot overwrite cleanly while open).
  const tmpZip = `${zipPath}.rewriting.zip`;
  if (existsSync(tmpZip)) rmSync(tmpZip, { force: true });
  const compress = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `Compress-Archive -Path '${join(staging, "*").replace(/'/g, "''")}' -DestinationPath '${tmpZip.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (compress.status !== 0) {
    throw new Error(`Compress-Archive failed: ${compress.stderr || compress.stdout}`);
  }
  copyFileSync(tmpZip, zipPath);
  rmSync(tmpZip, { force: true });
  rmSync(staging, { recursive: true, force: true });
  console.log(`[install-wrapper] injected into ${zipPath}`);
}

function collectZips(dir: string, out: string[] = []): string[] {
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
      collectZips(full, out);
      continue;
    }
    const lower = name.toLowerCase();
    if (lower.endsWith(".zip") && lower.includes("setup")) out.push(full);
  }
  return out;
}

function main() {
  if (process.platform !== "win32") {
    console.log("[install-wrapper] skip (not Windows)");
    return;
  }

  const buildDir = process.env.ELECTROBUN_BUILD_DIR || join(root, "build");
  const artifactDir = process.env.ELECTROBUN_ARTIFACT_DIR || join(root, "artifacts");
  const compiled = join(buildDir, outName);

  try {
    compileWrapper(compiled);
  } catch (err) {
    console.warn("[install-wrapper] FAIL compile", err);
    return;
  }

  // Also drop next to Setup.exe folders for local testing from build/.
  for (const name of ["stable-win-x64", "canary-win-x64", "dev-win-x64"]) {
    const folder = join(buildDir, name);
    if (!existsSync(folder)) continue;
    const hasSetup = readdirSync(folder).some((f) => /Setup\.exe$/i.test(f));
    if (hasSetup) {
      copyFileSync(compiled, join(folder, outName));
      console.log(`[install-wrapper] copied beside Setup in ${folder}`);
    }
  }

  const zips = [
    ...collectZips(artifactDir),
    ...collectZips(buildDir).filter((z) => /Setup\.zip$/i.test(z)),
  ];
  const unique = [...new Set(zips)];
  if (unique.length === 0) {
    console.log("[install-wrapper] no Setup.zip found yet — wrapper is in build/ for next package");
    return;
  }

  for (const zip of unique) {
    try {
      injectIntoZip(zip, compiled);
    } catch (err) {
      console.warn(`[install-wrapper] FAIL inject ${zip}`, err);
    }
  }

  // Standalone copy in artifacts for easy grabbing.
  if (existsSync(artifactDir)) {
    copyFileSync(compiled, join(artifactDir, outName));
  }

  console.log(`[install-wrapper] done (${unique.length} zip(s))`);
}

main();

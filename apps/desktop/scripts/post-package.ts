/**
 * Electrobun postPackage hook (runs after artifacts are written).
 * 1) Brand PE icons
 * 2) Build + inject "Install ZeroPaste.exe" into Windows Setup zips
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(script: string) {
  console.log(`[post-package] → ${script}`);
  const r = spawnSync(process.execPath, [join(root, "scripts", script)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.warn(`[post-package] ${script} exited ${r.status}`);
  }
}

run("brand-windows-icons.ts");
if (process.platform === "win32") {
  run("build-install-wrapper.ts");
}

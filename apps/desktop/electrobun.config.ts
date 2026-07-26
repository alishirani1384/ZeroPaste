import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElectrobunConfig } from "electrobun";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version: string;
};

const webBuildDir = "../web/out";

export default {
  app: {
    name: "ZeroPaste",
    identifier: "app.zeropaste.desktop",
    /** Keep in sync with apps/desktop/package.json (release CI reads that file). */
    version: pkg.version,
    description: "Encrypted clipboard manager for Windows and Linux",
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      [webBuildDir]: "views/mainview",
      "assets/tray.png": "views/mainview/tray.png",
      "assets/tray.ico": "views/mainview/tray.ico",
      "assets/zeropaste.png": "views/mainview/zeropaste.png",
      "assets/zeropaste.ico": "views/mainview/zeropaste.ico",
    },
    watchIgnore: [`${webBuildDir}/**`],
    mac: {
      bundleCEF: false,
      defaultRenderer: "native",
    },
    linux: {
      bundleCEF: false,
      defaultRenderer: "native",
      icon: "assets/zeropaste.png",
    },
    win: {
      bundleCEF: false,
      defaultRenderer: "native",
      icon: "assets/zeropaste.ico",
    },
  },
  // Electrobun's built-in rcedit resolve is broken (#429) — brand icons ourselves.
  // postPackage also builds "Install ZeroPaste.exe" (Setup → auto-launch).
  scripts: {
    postBuild: "scripts/brand-windows-icons.ts",
    postPackage: "scripts/post-package.ts",
  },
} satisfies ElectrobunConfig;

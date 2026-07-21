import type { ElectrobunConfig } from "electrobun";

const webBuildDir = "../web/out";

export default {
  app: {
    name: "ZeroPaste",
    identifier: "app.zeropaste.desktop",
    version: "0.0.1",
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
  scripts: {
    postBuild: "scripts/brand-windows-icons.ts",
    postPackage: "scripts/brand-windows-icons.ts",
  },
} satisfies ElectrobunConfig;

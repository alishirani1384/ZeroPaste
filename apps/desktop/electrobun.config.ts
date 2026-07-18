import type { ElectrobunConfig } from "electrobun";

const webBuildDir = "../web/out";

export default {
  app: {
    name: "ZeroPaste",
    identifier: "app.zeropaste.desktop",
    version: "0.0.1",
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
    },
    watchIgnore: [`${webBuildDir}/**`],
    mac: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
} satisfies ElectrobunConfig;

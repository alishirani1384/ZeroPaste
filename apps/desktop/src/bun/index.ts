import {
  BrowserWindow,
  GlobalShortcut,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";

import { startBridgeServer } from "./bridge-server";
import { startClipboardPoller } from "./clipboard-poller";
import { setPaused } from "./store";
import {
  HOST_BUILD,
  bindWindow,
  placeWindow,
  reapplyCurrentMode,
  resolveWindowSize,
  vaultFrame,
} from "./window-layout";

console.log(`\n========== ${HOST_BUILD} booting ==========\n`);

const DEV_SERVER_PORT = 3001;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`[ZeroPaste] HMR → ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("[ZeroPaste] web dev server not running; using packaged views");
    }
  }
  return "views://mainview/index.html";
}

startBridgeServer();
startClipboardPoller();

const url = await getMainViewUrl();

// Fixed size at create — never grow/shrink later (Electrobun Win transparent bug).
const size = resolveWindowSize();
const initial = { ...vaultFrame(), ...size };
console.log("[ZeroPaste] initial frame (fixed size)", initial);

/**
 * transparent:true for Paste-like chrome.
 * Size is fixed for the process lifetime; mode switches only call setPosition.
 */
const win = new BrowserWindow({
  title: "ZeroPaste",
  url,
  titleBarStyle: "hidden",
  transparent: true,
  passthrough: false,
  frame: initial,
  styleMask: {
    Titled: false,
    Closable: true,
    Resizable: false,
    Miniaturizable: false,
    Borderless: true,
    FullSizeContentView: true,
  },
});

bindWindow(win);

setTimeout(() => {
  console.log("[ZeroPaste] settle place vault");
  placeWindow("vault");
}, 300);

let panelVisible = true;

function showPanel() {
  reapplyCurrentMode();
  win.show();
  win.activate();
  panelVisible = true;
}

function hidePanel() {
  win.hide();
  panelVisible = false;
}

function togglePanel() {
  if (panelVisible) hidePanel();
  else showPanel();
}

try {
  GlobalShortcut.register("CommandOrControl+Shift+V", () => togglePanel());
  console.log("[ZeroPaste] hotkey Ctrl+Shift+V registered");
} catch (err) {
  console.warn("[ZeroPaste] GlobalShortcut failed", err);
}

try {
  const tray = new Tray({ title: "ZeroPaste" });
  tray.setMenu([
    { type: "normal", label: "Show ZeroPaste", action: "show" },
    { type: "normal", label: "Pause 5 minutes", action: "pause5" },
    { type: "normal", label: "Resume capture", action: "resume" },
    { type: "separator" },
    { type: "normal", label: "Quit", action: "quit" },
  ]);
  tray.on("tray-clicked", (event: unknown) => {
    const action =
      typeof event === "object" && event && "action" in event
        ? String((event as { action?: string }).action ?? "")
        : "";
    if (action === "pause5") setPaused(5 * 60_000);
    else if (action === "resume") setPaused(null);
    else if (action === "quit") {
      try {
        Utils.quit();
      } catch {
        process.exit(0);
      }
    } else togglePanel();
  });
} catch (err) {
  console.warn("[ZeroPaste] Tray failed", err);
}

console.log(`[ZeroPaste] ${HOST_BUILD} ready\n`);

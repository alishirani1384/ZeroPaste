import {
  BrowserWindow,
  GlobalShortcut,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import { join } from "node:path";

import { startBridgeServer } from "./bridge-server";
import { startClipboardPoller } from "./clipboard-poller";
import { captureFocusTarget, captureFocusTargetIfExternal } from "./focus-target";
import { registerKeyboardFocus } from "./keyboard-focus";
import { applyNoActivateByTitle, clearNoActivateByTitle } from "./noactivate";
import { registerPanelVisibility } from "./panel-visibility";
import { commandExists, getDisplayServer, logLinuxPasteEnvironment } from "./platform/session";
import { addHostWarning, hydrateStoreFromDisk, setPaused } from "./store";
import { resolveRootHwnd, setDesiredCursor, startCursorEnforcer } from "./win32-cursor";
import {
  HOST_BUILD,
  bindWindow,
  getWindowMode,
  placeWindow,
  reapplyCurrentMode,
  resolveWindowSize,
  vaultFrame,
} from "./window-layout";

console.log(`\n========== ${HOST_BUILD} booting ==========\n`);
await hydrateStoreFromDisk();
void logLinuxPasteEnvironment();
if (process.platform === "linux") {
  void (async () => {
    const server = getDisplayServer();
    const hasX = await commandExists("xdotool");
    const hasWay =
      (await commandExists("wtype")) ||
      (await commandExists("ydotool")) ||
      (await commandExists("dotool"));
    if (server === "wayland" && !hasWay && !hasX) {
      addHostWarning(
        "Paste injection unavailable — install wtype or ydotool (Wayland), or xdotool (X11).",
      );
    } else if (server === "x11" && !hasX) {
      addHostWarning("Paste injection unavailable — install xdotool (sudo apt install xdotool).");
    }
  })();
}

const DEV_SERVER_PORT = 3001;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

/** Next often starts after Electrobun when using concurrently — wait before falling back. */
async function waitForDevServer(attempts = 60, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return true;
    } catch {
      if (i === 0 || i % 6 === 0) {
        console.log(
          `[ZeroPaste] waiting for web HMR at ${DEV_SERVER_URL}… (${i + 1}/${attempts})`,
        );
      }
      await Bun.sleep(delayMs);
    }
  }
  return false;
}

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    const ready = await waitForDevServer();
    if (ready) {
      console.log(`[ZeroPaste] HMR → ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    }
    console.warn(
      "[ZeroPaste] web HMR never came up — using packaged views (stale UI). Run: bun run dev:web",
    );
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
 * activate:false + NonactivatingPanel: open without stealing focus (Electrobun docs).
 * Size is fixed for the process lifetime; mode switches only call setPosition.
 */
const win = new BrowserWindow({
  title: "ZeroPaste",
  url,
  titleBarStyle: "hidden",
  transparent: true,
  passthrough: false,
  activate: false,
  frame: initial,
  styleMask: {
    Titled: false,
    Closable: true,
    Resizable: false,
    Miniaturizable: false,
    Borderless: true,
    FullSizeContentView: true,
    // macOS panel behavior; ignored harmlessly elsewhere when unsupported.
    NonactivatingPanel: true,
  },
});

bindWindow(win);

try {
  win.setAlwaysOnTop(true);
  console.log("[ZeroPaste] always-on-top enabled");
} catch (err) {
  console.warn("[ZeroPaste] setAlwaysOnTop failed", err);
}

// Transparent CEF uses OSR — OS cursor sticks on AppStarting without this.
startCursorEnforcer("ZeroPaste");
setDesiredCursor("arrow");
setTimeout(() => resolveRootHwnd("ZeroPaste"), 200);
setTimeout(() => resolveRootHwnd("ZeroPaste"), 1000);

setTimeout(() => {
  console.log("[ZeroPaste] settle place vault");
  placeWindow("vault");
  try {
    win.setAlwaysOnTop(true);
  } catch {
    /* ignore */
  }
  // Vault needs keyboard — allow activation.
  void clearNoActivateByTitle().then(() => {
    resolveRootHwnd("ZeroPaste");
    setDesiredCursor("arrow");
  });
}, 300);

let panelVisible = true;

async function showPanel() {
  await captureFocusTarget();
  reapplyCurrentMode();

  const mode = getWindowMode();
  try {
    win.setAlwaysOnTop(true);
  } catch {
    /* ignore */
  }

  if (mode === "panel") {
    // Electrobun: show without activating — caret stays in the target app.
    try {
      win.showInactive();
    } catch {
      win.show();
    }
    await applyNoActivateByTitle();
  } else {
    await clearNoActivateByTitle();
    win.show();
    win.activate();
  }
  resolveRootHwnd("ZeroPaste");
  setDesiredCursor("arrow");
  panelVisible = true;
}

function hidePanel() {
  win.hide();
  panelVisible = false;
}

registerPanelVisibility({ hide: hidePanel, show: () => void showPanel() });

registerKeyboardFocus({
  enable: async () => {
    // Remember the caret app before we steal focus for typing.
    await captureFocusTargetIfExternal();
    await clearNoActivateByTitle();
    try {
      win.show();
      win.activate();
    } catch (err) {
      console.warn("[ZeroPaste] keyboard focus activate failed", err);
    }
  },
  disable: async () => {
    // Always re-arm NOACTIVATE in panel mode so clicks don't keep stealing focus.
    if (getWindowMode() !== "panel") return;
    await applyNoActivateByTitle();
    try {
      win.showInactive();
    } catch {
      /* ignore */
    }
  },
});

function togglePanel() {
  if (panelVisible) hidePanel();
  else void showPanel();
}

try {
  GlobalShortcut.register("CommandOrControl+Shift+V", () => togglePanel());
  console.log("[ZeroPaste] hotkey Ctrl+Shift+V registered");
} catch (err) {
  console.warn("[ZeroPaste] GlobalShortcut failed", err);
  addHostWarning(
    "Global hotkey Ctrl+Shift+V failed to register — it may be in use. Use the tray to show ZeroPaste.",
  );
}

function resolveTrayImage(): string {
  const local = join(import.meta.dir, "..", "..", "assets", "tray.png");
  try {
    if (Bun.file(local).size >= 0) return local;
  } catch {
    /* packaged */
  }
  return "views://mainview/tray.png";
}

try {
  const tray = new Tray({
    title: "ZeroPaste",
    image: resolveTrayImage(),
    width: 16,
    height: 16,
  });
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
  addHostWarning("System tray failed — ZeroPaste may be hard to reopen if the hotkey is also blocked.");
}

console.log(`[ZeroPaste] ${HOST_BUILD} ready\n`);

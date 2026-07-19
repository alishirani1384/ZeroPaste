import {
  BrowserWindow,
  GlobalShortcut,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";

import { startBridgeServer } from "./bridge-server";
import { startClipboardPoller } from "./clipboard-poller";
import { captureFocusTarget } from "./focus-target";
import { applyNoActivateByTitle, clearNoActivateByTitle } from "./noactivate";
import { registerPanelVisibility } from "./panel-visibility";
import { logLinuxPasteEnvironment } from "./platform/session";
import { setPaused } from "./store";
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
void logLinuxPasteEnvironment();

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

setTimeout(() => {
  console.log("[ZeroPaste] settle place vault");
  placeWindow("vault");
  try {
    win.setAlwaysOnTop(true);
  } catch {
    /* ignore */
  }
  // Vault needs keyboard — allow activation.
  void clearNoActivateByTitle();
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
  panelVisible = true;
}

function hidePanel() {
  win.hide();
  panelVisible = false;
}

registerPanelVisibility({ hide: hidePanel, show: () => void showPanel() });

function togglePanel() {
  if (panelVisible) hidePanel();
  else void showPanel();
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

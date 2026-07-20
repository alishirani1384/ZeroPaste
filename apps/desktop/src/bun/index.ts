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

// Create at MAX canvas (hit-test ceiling). /window-fit shrinks to the UI.
const size = resolveWindowSize();
const initial = { ...vaultFrame(), ...size };
console.log("[ZeroPaste] initial frame (create=max canvas)", initial);

/**
 * transparent:true for Paste-like chrome.
 * WebView2 cannot click-through; HWND is fitted to opaque UI.
 * MUST create at max size — growing past create size leaves dead click zones (#410).
 */
const win = new BrowserWindow({
  title: "ZeroPaste",
  url,
  titleBarStyle: "hidden",
  transparent: true,
  passthrough: true,
  activate: false,
  frame: initial,
  styleMask: {
    Titled: false,
    Closable: true,
    Resizable: false,
    Miniaturizable: false,
    Borderless: true,
    FullSizeContentView: true,
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
  console.log("[ZeroPaste] settle vault (position only — size from /window-fit)");
  placeWindow("vault");
  try {
    win.setAlwaysOnTop(true);
  } catch {
    /* ignore */
  }
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
  // Prefer packaged view asset (always copied by electrobun.config).
  const candidates = [
    process.platform === "win32"
      ? join(import.meta.dir, "..", "views", "mainview", "tray.ico")
      : "",
    join(import.meta.dir, "..", "views", "mainview", "tray.png"),
    join(import.meta.dir, "..", "..", "assets", "tray.ico"),
    join(import.meta.dir, "..", "..", "assets", "tray.png"),
  ].filter(Boolean);

  for (const path of candidates) {
    try {
      if (Bun.file(path).size > 0) {
        console.log("[ZeroPaste] tray image", path);
        return path;
      }
    } catch {
      /* try next */
    }
  }

  // Electrobun resolves views:// against the packaged Resources/app/views folder.
  return process.platform === "win32"
    ? "views://mainview/tray.ico"
    : "views://mainview/tray.png";
}

function quitApp() {
  console.log("[ZeroPaste] quitting from tray");
  try {
    Utils.quit();
  } catch (err) {
    console.warn("[ZeroPaste] Utils.quit failed", err);
  }
  // Ensure exit even if the native quit path is a no-op on this build.
  setTimeout(() => process.exit(0), 50);
}

try {
  const trayImage = resolveTrayImage();
  const tray = new Tray({
    title: "ZeroPaste",
    image: trayImage,
    // macOS template masking blanks the icon on Windows notify / overflow flyout.
    template: process.platform === "darwin",
    width: process.platform === "win32" ? 32 : 16,
    height: process.platform === "win32" ? 32 : 16,
  });
  tray.setMenu([
    { type: "normal", label: "Show ZeroPaste", action: "show" },
    { type: "normal", label: "Pause 5 minutes", action: "pause5" },
    { type: "normal", label: "Resume capture", action: "resume" },
    { type: "separator" },
    { type: "normal", label: "Quit", action: "quit" },
  ]);
  tray.on("tray-clicked", (event: unknown) => {
    // Electrobun emits ElectrobunEvent { data: { action } }, not a bare { action }.
    const payload =
      event && typeof event === "object" && "data" in event
        ? (event as { data?: { action?: string } }).data
        : (event as { action?: string } | null);
    const action = String(payload?.action ?? "").trim();
    console.log("[ZeroPaste] tray action", action || "(click)");

    if (action === "pause5") {
      setPaused(5 * 60_000);
      return;
    }
    if (action === "resume") {
      setPaused(null);
      return;
    }
    if (action === "quit") {
      try {
        tray.remove();
      } catch {
        /* ignore */
      }
      quitApp();
      return;
    }
    if (action === "show") {
      void showPanel();
      return;
    }
    // Empty action = left-click on the tray icon.
    if (action === "") {
      togglePanel();
    }
  });
} catch (err) {
  console.warn("[ZeroPaste] Tray failed", err);
  addHostWarning("System tray failed — ZeroPaste may be hard to reopen if the hotkey is also blocked.");
}

console.log(`[ZeroPaste] ${HOST_BUILD} ready\n`);

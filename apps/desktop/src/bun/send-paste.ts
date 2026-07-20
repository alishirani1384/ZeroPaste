/**
 * Inject Ctrl+V into the currently focused OS window.
 * Windows: bun:ffi SendInput. Linux: xdotool (X11) / ydotool|wtype|dotool (Wayland).
 */

import { dlopen, ptr } from "bun:ffi";

import { commandExists, getDisplayServer } from "./platform/session";

let sendCtrlVWin: (() => void) | null = null;

function initWinSend(): (() => void) | null {
  if (process.platform !== "win32") return null;
  try {
    const user32 = dlopen("user32.dll", {
      SendInput: {
        args: ["u32", "ptr", "i32"],
        returns: "u32",
      },
    });

    const INPUT_SIZE = 40;
    const KEYEVENTF_KEYUP = 0x0002;
    const VK_CONTROL = 0x11;
    const VK_V = 0x56;

    return () => {
      const buf = new ArrayBuffer(INPUT_SIZE * 4);
      const view = new DataView(buf);
      const writeKey = (index: number, vk: number, flags: number) => {
        const o = index * INPUT_SIZE;
        view.setInt32(o, 1, true);
        view.setUint16(o + 8, vk, true);
        view.setUint16(o + 10, 0, true);
        view.setUint32(o + 12, flags, true);
        view.setUint32(o + 16, 0, true);
      };
      writeKey(0, VK_CONTROL, 0);
      writeKey(1, VK_V, 0);
      writeKey(2, VK_V, KEYEVENTF_KEYUP);
      writeKey(3, VK_CONTROL, KEYEVENTF_KEYUP);
      const sent = user32.symbols.SendInput(4, ptr(buf), INPUT_SIZE);
      if (sent !== 4) console.warn("[ZeroPaste] SendInput sent", sent, "of 4");
    };
  } catch (err) {
    console.warn("[ZeroPaste] bun:ffi SendInput init failed", err);
    return null;
  }
}

async function run(cmd: string[], label: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      console.warn(`[ZeroPaste] ${label} failed`, err.trim());
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[ZeroPaste] ${label} missing/failed`, err);
    return false;
  }
}

async function sendCtrlVLinux(): Promise<boolean> {
  const server = getDisplayServer();

  if (server !== "wayland" && (await commandExists("xdotool"))) {
    if (await run(["xdotool", "key", "--clearmodifiers", "ctrl+v"], "xdotool")) return true;
  }

  if (await commandExists("wtype")) {
    if (await run(["wtype", "-M", "ctrl", "v", "-m", "ctrl"], "wtype")) return true;
  }
  if (await commandExists("ydotool")) {
    if (await run(["ydotool", "key", "29:1", "47:1", "47:0", "29:0"], "ydotool")) return true;
  }
  if (await commandExists("dotool")) {
    if (await run(["sh", "-c", "printf 'key ctrl+v\\n' | dotool"], "dotool")) return true;
  }

  if (await commandExists("xdotool")) {
    if (await run(["xdotool", "key", "--clearmodifiers", "ctrl+v"], "xdotool(xwayland)")) {
      return true;
    }
  }

  console.warn(
    "[ZeroPaste] No paste injector available. X11: install xdotool. Wayland: install ydotool or wtype.",
  );
  return false;
}

/** Returns false when no injector could run (UI should toast). */
export async function sendCtrlV(): Promise<boolean> {
  if (process.platform === "win32") {
    if (!sendCtrlVWin) sendCtrlVWin = initWinSend();
    if (sendCtrlVWin) {
      sendCtrlVWin();
      return true;
    }
    return run(
      [
        "powershell",
        "-NoProfile",
        "-STA",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ],
      "SendKeys",
    );
  }

  if (process.platform === "linux") {
    return sendCtrlVLinux();
  }

  console.warn("[ZeroPaste] sendCtrlV not implemented on", process.platform);
  return false;
}

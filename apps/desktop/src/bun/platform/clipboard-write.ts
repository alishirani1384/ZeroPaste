/**
 * Cross-platform clipboard write for paste.
 * Prefer Electrobun Utils; Linux falls back to wl-copy / xclip / xsel.
 */

import { Utils } from "electrobun/bun";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commandExists, getDisplayServer } from "./session";

async function writeTextLinux(text: string): Promise<void> {
  const server = getDisplayServer();
  if (server === "wayland" || (await commandExists("wl-copy"))) {
    if (await commandExists("wl-copy")) {
      const proc = Bun.spawn(["wl-copy", "--type", "text/plain"], {
        stdin: "pipe",
        stdout: "ignore",
        stderr: "pipe",
      });
      proc.stdin.write(text);
      proc.stdin.end();
      if ((await proc.exited) === 0) return;
    }
  }
  if (await commandExists("xclip")) {
    const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    });
    proc.stdin.write(text);
    proc.stdin.end();
    if ((await proc.exited) === 0) return;
  }
  if (await commandExists("xsel")) {
    const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    });
    proc.stdin.write(text);
    proc.stdin.end();
    if ((await proc.exited) === 0) return;
  }
  throw new Error("No Linux clipboard tool (wl-copy / xclip / xsel)");
}

async function writeImageLinuxPng(png: Uint8Array): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "zeropaste-"));
  const file = join(dir, "clip.png");
  await writeFile(file, png);
  try {
    if (await commandExists("wl-copy")) {
      const proc = Bun.spawn(["wl-copy", "--type", "image/png"], {
        stdin: Bun.file(file),
        stdout: "ignore",
        stderr: "pipe",
      });
      if ((await proc.exited) === 0) return;
    }
    if (await commandExists("xclip")) {
      const proc = Bun.spawn(
        ["xclip", "-selection", "clipboard", "-t", "image/png", "-i", file],
        { stdout: "ignore", stderr: "pipe" },
      );
      if ((await proc.exited) === 0) return;
    }
    throw new Error("No Linux image clipboard tool (wl-copy / xclip)");
  } finally {
    try {
      await unlink(file);
    } catch {
      /* ignore */
    }
  }
}

async function writeTextWinPowerShell(text: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "zeropaste-"));
  const file = join(dir, "clip.txt");
  await writeFile(file, text, "utf8");
  const psPath = file.replace(/'/g, "''");
  const proc = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-STA",
      "-Command",
      `
Add-Type -AssemblyName System.Windows.Forms
$t = [System.IO.File]::ReadAllText('${psPath}')
[System.Windows.Forms.Clipboard]::SetText($t)
`,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  try {
    await unlink(file);
  } catch {
    /* ignore */
  }
  if (code !== 0) throw new Error("Clipboard.SetText failed");
}

async function writeImageWinPowerShell(bytes: Uint8Array, ext: "bmp" | "png"): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "zeropaste-"));
  const file = join(dir, `clip.${ext}`);
  await writeFile(file, bytes);
  const psPath = file.replace(/'/g, "''");
  const proc = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-STA",
      "-Command",
      `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${psPath}')
[System.Windows.Forms.Clipboard]::SetImage($img)
$img.Dispose()
`,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  try {
    await unlink(file);
  } catch {
    /* ignore */
  }
  if (code !== 0) throw new Error("Clipboard.SetImage failed");
}

export async function writeClipboardText(text: string): Promise<void> {
  try {
    Utils.clipboardWriteText(text);
    return;
  } catch (err) {
    console.warn("[ZeroPaste] Utils.clipboardWriteText failed", err);
  }
  if (process.platform === "linux") {
    await writeTextLinux(text);
    return;
  }
  if (process.platform === "win32") {
    await writeTextWinPowerShell(text);
    return;
  }
  throw new Error("clipboard write unsupported");
}

/** Write image. Prefer PNG for Electrobun/Linux; Win can also take BMP via PowerShell. */
export async function writeClipboardImage(
  bytes: Uint8Array,
  mimeHint = "image/png",
): Promise<void> {
  const isPng = mimeHint.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
  try {
    if (isPng) {
      Utils.clipboardWriteImage(bytes);
      return;
    }
  } catch (err) {
    console.warn("[ZeroPaste] Utils.clipboardWriteImage failed", err);
  }

  if (process.platform === "linux") {
    if (!isPng) throw new Error("Linux image paste needs PNG bytes");
    try {
      Utils.clipboardWriteImage(bytes);
      return;
    } catch {
      await writeImageLinuxPng(bytes);
      return;
    }
  }

  if (process.platform === "win32") {
    const ext = isPng ? "png" : "bmp";
    try {
      await writeImageWinPowerShell(bytes, ext);
      return;
    } catch {
      if (isPng) Utils.clipboardWriteImage(bytes);
      else throw new Error("image clipboard write failed");
    }
    return;
  }

  throw new Error("clipboard image write unsupported");
}

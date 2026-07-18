import { createClipFromCapture } from "@paste/clipboard-core";
import { Utils } from "electrobun/bun";

import { isPaused, upsertClip } from "./store";

let lastFingerprint = "";
let timer: ReturnType<typeof setInterval> | null = null;

function fingerprint(formats: string[], text: string | null, imageLen: number): string {
  return `${formats.sort().join(",")}|${text?.slice(0, 2000) ?? ""}|img:${imageLen}`;
}

async function pollOnce() {
  if (isPaused()) return;

  try {
    const formats = Utils.clipboardAvailableFormats() ?? [];
    let text: string | null = null;
    let imageDataUrl: string | undefined;
    let imageLen = 0;

    if (formats.includes("text") || formats.includes("html")) {
      text = Utils.clipboardReadText() ?? null;
    }
    if (formats.includes("image")) {
      const png = Utils.clipboardReadImage();
      if (png && png.byteLength > 0) {
        imageLen = png.byteLength;
        const b64 = Buffer.from(png).toString("base64");
        imageDataUrl = `data:image/png;base64,${b64}`;
      }
    }

    if (!text && !imageDataUrl) return;

    const fp = fingerprint(formats, text, imageLen);
    if (fp === lastFingerprint) return;
    lastFingerprint = fp;

    const clip = await createClipFromCapture({
      body: text ?? "",
      imageDataUrl,
      mimeType: imageDataUrl ? "image/png" : "text/plain",
      kind: imageDataUrl ? "image" : undefined,
      source: {
        appName: "System",
        deviceName: "This PC",
        devicePlatform: process.platform === "linux" ? "linux" : "windows",
      },
    });

    upsertClip(clip);
  } catch (err) {
    console.warn("[clipboard-poller]", err);
  }
}

export function startClipboardPoller(intervalMs = 400) {
  if (timer) return;
  void pollOnce();
  timer = setInterval(() => void pollOnce(), intervalMs);
}

export function stopClipboardPoller() {
  if (timer) clearInterval(timer);
  timer = null;
}

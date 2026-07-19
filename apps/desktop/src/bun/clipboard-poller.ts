import { contentHash, createClipFromCapture } from "@paste/clipboard-core";
import { Utils } from "electrobun/bun";

import { normalizeClipboardImage } from "./image-format";
import { mediaUrlFor, putClipMedia } from "./media-store";
import {
  getState,
  isCaptureSuppressed,
  isPaused,
  takeExternalFingerprint,
  upsertClip,
} from "./store";

let lastFingerprint = "";
let timer: ReturnType<typeof setInterval> | null = null;

function fingerprint(formats: string[], text: string | null, imageLen: number): string {
  return `${formats.sort().join(",")}|${text?.slice(0, 2000) ?? ""}|img:${imageLen}`;
}

async function pollOnce() {
  const forced = takeExternalFingerprint();
  if (forced) lastFingerprint = forced;
  if (isPaused() || isCaptureSuppressed()) return;

  try {
    const formats = Utils.clipboardAvailableFormats() ?? [];
    let text: string | null = null;
    let imageBytes: Uint8Array | null = null;

    if (formats.includes("text") || formats.includes("html")) {
      text = Utils.clipboardReadText() ?? null;
    }
    if (formats.includes("image")) {
      const png = Utils.clipboardReadImage();
      if (png && png.byteLength > 0) {
        imageBytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      }
    }

    // Prefer image when both present (Windows often exposes a text path too).
    if (!text && !imageBytes) return;

    const fp = fingerprint(formats, text, imageBytes?.byteLength ?? 0);
    if (fp === lastFingerprint) return;
    lastFingerprint = fp;

    if (imageBytes && imageBytes.byteLength > 0) {
      const normalized = normalizeClipboardImage(imageBytes);
      const imgHash = await contentHash(
        Buffer.from(normalized.bytes).toString("base64"),
      );
      const existing = getState().clips.find(
        (c) => c.contentHash === imgHash && !c.deletedAt,
      );
      const id = existing?.id ?? crypto.randomUUID();
      putClipMedia(id, normalized.bytes, normalized.mimeType, imageBytes);
      const url = mediaUrlFor(id);
      const clip = await createClipFromCapture({
        id,
        body: url,
        imageDataUrl: url,
        mimeType: normalized.mimeType,
        kind: "image",
        byteSize: normalized.bytes.byteLength,
        source: {
          appName: "System",
          deviceName: "This PC",
          devicePlatform: process.platform === "linux" ? "linux" : "windows",
        },
      });
      clip.byteSize = normalized.bytes.byteLength;
      clip.preview = url;
      clip.body = url;
      clip.contentHash = imgHash;
      upsertClip(clip);
      console.log("[ZeroPaste] captured image", {
        id: id.slice(0, 8),
        bytes: normalized.bytes.byteLength,
        mime: normalized.mimeType,
      });
      return;
    }

    const clip = await createClipFromCapture({
      body: text ?? "",
      mimeType: "text/plain",
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

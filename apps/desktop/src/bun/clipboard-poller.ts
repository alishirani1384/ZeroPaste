import { contentHash, createClipFromCapture } from "@paste/clipboard-core";
import { Utils } from "electrobun/bun";

import { normalizeClipboardImage } from "./image-format";
import { mediaUrlFor, putClipMedia } from "./media-store";
import { deviceLabel, getForegroundSource } from "./source-app";
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
  const st = getState();
  if (!st.captureEnabled || isPaused() || isCaptureSuppressed()) return;

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

    if (!text && !imageBytes) return;

    // Never store recovery-key shaped secrets (64 hex chars).
    if (text && /^[0-9a-fA-F]{64}$/.test(text.trim())) {
      console.warn("[ZeroPaste] skipped capture that looks like a recovery key");
      lastFingerprint = fingerprint(formats, text, 0);
      return;
    }

    const fp = fingerprint(formats, text, imageBytes?.byteLength ?? 0);
    if (fp === lastFingerprint) return;
    lastFingerprint = fp;

    const fg = await getForegroundSource();
    const source = {
      appName: fg.appName,
      windowTitle: fg.windowTitle,
      deviceName: deviceLabel(),
      devicePlatform: (process.platform === "linux" ? "linux" : "windows") as
        | "linux"
        | "windows",
    };

    if (imageBytes && imageBytes.byteLength > 0) {
      const normalized = normalizeClipboardImage(imageBytes);
      const imgHash = await contentHash(Buffer.from(normalized.bytes).toString("base64"));
      const existing = getState().clips.find((c) => c.contentHash === imgHash && !c.deletedAt);
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
        source,
      });
      clip.byteSize = normalized.bytes.byteLength;
      clip.preview = url;
      clip.body = url;
      clip.contentHash = imgHash;
      upsertClip(clip);
      return;
    }

    const clip = await createClipFromCapture({
      body: text ?? "",
      mimeType: "text/plain",
      source,
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

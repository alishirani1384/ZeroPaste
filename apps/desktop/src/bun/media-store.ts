/** Image bytes keyed by clip id — kept out of SSE JSON so previews stay reliable. */

import { getBridgePort, getBridgeToken } from "./bridge-auth";

export type ClipMedia = {
  /** Browser-decodable bytes (usually BMP after DIB normalize). */
  display: Uint8Array;
  displayMime: string;
  /** Original clipboard payload for write-back / Electrobun clipboardWriteImage. */
  paste: Uint8Array;
};

const media = new Map<string, ClipMedia>();

let bridgeOrigin = "http://127.0.0.1:47821";

export function setBridgeOrigin(origin: string) {
  bridgeOrigin = origin.replace(/\/$/, "");
}

export function getBridgeOrigin(): string {
  return bridgeOrigin;
}

/** @deprecated use getBridgeOrigin() */
export const BRIDGE_ORIGIN = "http://127.0.0.1:47821";

export function mediaUrlFor(clipId: string): string {
  let token = "";
  try {
    token = getBridgeToken();
  } catch {
    /* token not ready yet */
  }
  const port = (() => {
    try {
      return getBridgePort();
    } catch {
      return 47821;
    }
  })();
  const origin = bridgeOrigin.includes("47821")
    ? `http://127.0.0.1:${port}`
    : bridgeOrigin;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${origin}/clip-media/${clipId}${q}`;
}

export function putClipMedia(
  clipId: string,
  display: Uint8Array,
  displayMime: string,
  paste?: Uint8Array,
) {
  media.set(clipId, {
    display,
    displayMime,
    paste: paste ?? display,
  });
}

export function getClipMedia(clipId: string) {
  return media.get(clipId) ?? null;
}

export function deleteClipMedia(clipId: string) {
  media.delete(clipId);
}

export function isBridgeMediaUrl(url: string): boolean {
  return /\/clip-media\//.test(url);
}

/** Image bytes keyed by clip id — kept out of SSE JSON so previews stay reliable. */

export type ClipMedia = {
  /** Browser-decodable bytes (usually BMP after DIB normalize). */
  display: Uint8Array;
  displayMime: string;
  /** Original clipboard payload for write-back / Electrobun clipboardWriteImage. */
  paste: Uint8Array;
};

const media = new Map<string, ClipMedia>();

export const BRIDGE_ORIGIN = "http://127.0.0.1:47821";

export function mediaUrlFor(clipId: string): string {
  return `${BRIDGE_ORIGIN}/clip-media/${clipId}`;
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
  return url.startsWith(`${BRIDGE_ORIGIN}/clip-media/`);
}

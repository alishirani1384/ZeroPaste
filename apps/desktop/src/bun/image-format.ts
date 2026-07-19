/**
 * Electrobun clipboardReadImage on Windows often returns a CF_DIB payload
 * (BITMAPINFOHEADER + optional masks + pixels), not a PNG.
 */

const BI_RGB = 0;
const BI_BITFIELDS = 3;
const BI_ALPHABITFIELDS = 6;

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  );
}

function isBmp(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

/** BITMAPINFOHEADER.biSize is typically 40 / 108 / 124. */
function looksLikeDib(bytes: Uint8Array): boolean {
  if (bytes.length < 40) return false;
  const biSize = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  return biSize === 40 || biSize === 108 || biSize === 124;
}

/**
 * Wrap CF_DIB bytes in a BITMAPFILEHEADER so <img> can load image/bmp.
 * Handles BI_BITFIELDS mask DWORDs that sit between the info header and pixels.
 */
export function dibToBmpFile(dib: Uint8Array): Uint8Array {
  const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength);
  const biSize = view.getUint32(0, true);
  const compression = dib.byteLength >= 20 ? view.getUint32(16, true) : BI_RGB;

  let maskBytes = 0;
  if (biSize === 40) {
    if (compression === BI_BITFIELDS) maskBytes = 12;
    else if (compression === BI_ALPHABITFIELDS) maskBytes = 16;
  }

  const pixelDataOffset = 14 + biSize + maskBytes;
  const out = new Uint8Array(14 + dib.byteLength);
  const outView = new DataView(out.buffer);
  out[0] = 0x42; // B
  out[1] = 0x4d; // M
  outView.setUint32(2, out.byteLength, true);
  outView.setUint32(10, pixelDataOffset, true);
  out.set(dib, 14);
  return out;
}

/** Repair BMPs we previously wrote with a wrong bfOffBits for BI_BITFIELDS. */
function repairBmp(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 54) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = view.getUint32(10, true);
  const biSize = view.getUint32(14, true);
  const compression = view.getUint32(30, true);
  if (biSize === 40 && compression === BI_BITFIELDS && off === 54) {
    return dibToBmpFile(bytes.subarray(14));
  }
  return bytes;
}

export function normalizeClipboardImage(raw: Uint8Array): {
  bytes: Uint8Array;
  mimeType: string;
} {
  if (isPng(raw)) return { bytes: raw, mimeType: "image/png" };
  if (isJpeg(raw)) return { bytes: raw, mimeType: "image/jpeg" };
  if (isGif(raw)) return { bytes: raw, mimeType: "image/gif" };
  if (isBmp(raw)) return { bytes: repairBmp(raw), mimeType: "image/bmp" };
  if (looksLikeDib(raw)) {
    return { bytes: dibToBmpFile(raw), mimeType: "image/bmp" };
  }
  console.warn(
    "[ZeroPaste] unknown clipboard image magic",
    [...raw.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join(" "),
  );
  return { bytes: dibToBmpFile(raw), mimeType: "image/bmp" };
}

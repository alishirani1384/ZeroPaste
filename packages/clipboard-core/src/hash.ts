/**
 * Soft-delete pull stubs and local capture may call this before subtle exists.
 * Prefer Web Crypto SHA-256; otherwise a stable FNV-1a fallback.
 */
export async function contentHash(input: string | ArrayBuffer): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);

  const subtle =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
      : undefined;

  if (subtle?.digest) {
    const digest = await subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

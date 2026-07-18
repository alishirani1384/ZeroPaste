/** Fast non-crypto content fingerprint for dedupe (not for security). */
export async function contentHash(input: string | ArrayBuffer): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Bun / Node fallback
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

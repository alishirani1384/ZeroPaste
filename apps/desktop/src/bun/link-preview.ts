/**
 * SSRF-hardened OG fetch for link previews.
 * Rejects non-http(s), private/loopback/link-local hosts, and redirect hops into those ranges.
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type LinkPreview = {
  title?: string;
  image?: string;
  description?: string;
  siteName?: string;
};

const memory = new Map<string, LinkPreview | null>();

function absolutize(base: string, maybe: string | undefined): string | undefined {
  if (!maybe) return undefined;
  try {
    return new URL(maybe, base).href;
  } catch {
    return undefined;
  }
}

function metaContent(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return undefined;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeHtml(m[1].trim()) : undefined;
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isPrivateIp(mapped);
    }
    return false;
  }
  return true;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("scheme_blocked");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("host_blocked");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("host_blocked");
    return parsed;
  }
  const records = await lookup(host, { all: true });
  if (!records.length) throw new Error("host_blocked");
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error("host_blocked");
  }
  return parsed;
}

async function fetchOg(url: string): Promise<LinkPreview | null> {
  try {
    let current = await assertSafeUrl(url);
    for (let hop = 0; hop < 3; hop++) {
      const res = await fetch(current.href, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "ZeroPaste/1.0 (link preview)",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = await assertSafeUrl(new URL(loc, current).href);
        continue;
      }
      if (!res.ok) return null;
      const html = (await res.text()).slice(0, 180_000);
      const title =
        metaContent(html, "og:title") ||
        metaContent(html, "twitter:title") ||
        titleTag(html);
      const image = absolutize(
        current.href,
        metaContent(html, "og:image") ||
          metaContent(html, "og:image:url") ||
          metaContent(html, "twitter:image") ||
          metaContent(html, "twitter:image:src"),
      );
      const description =
        metaContent(html, "og:description") || metaContent(html, "description");
      const siteName = metaContent(html, "og:site_name");
      if (!title && !image) return null;
      return { title, image, description, siteName };
    }
    return null;
  } catch {
    return null;
  }
}

/** Host-side OG fetch (no CORS). Cached in memory. */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const key = url.trim();
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) ?? null;
  const preview = await fetchOg(key);
  memory.set(key, preview);
  return preview;
}

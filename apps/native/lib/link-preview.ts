import AsyncStorage from "@react-native-async-storage/async-storage";

export type LinkPreview = {
  title?: string;
  image?: string;
  description?: string;
  siteName?: string;
};

const memory = new Map<string, LinkPreview | null>();
const KEY = (url: string) => `zp:og:${url}`;

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

async function fetchOg(url: string): Promise<LinkPreview | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ZeroPaste/1.0 (link preview)",
      },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 180_000);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleTag(html);
    const image = absolutize(
      url,
      metaContent(html, "og:image") ||
        metaContent(html, "og:image:url") ||
        metaContent(html, "twitter:image"),
    );
    const description =
      metaContent(html, "og:description") || metaContent(html, "description");
    const siteName = metaContent(html, "og:site_name");
    if (!title && !image) return null;
    return { title, image, description, siteName };
  } catch {
    return null;
  }
}

/** Cached OG preview for a URL. */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const key = url.trim();
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) ?? null;

  try {
    const cached = await AsyncStorage.getItem(KEY(key));
    if (cached) {
      const parsed = JSON.parse(cached) as LinkPreview;
      memory.set(key, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }

  const preview = await fetchOg(key);
  memory.set(key, preview);
  if (preview) {
    try {
      await AsyncStorage.setItem(KEY(key), JSON.stringify(preview));
    } catch {
      /* ignore */
    }
  }
  return preview;
}

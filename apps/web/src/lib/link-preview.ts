import { bridgeFetch } from "./bridge-client";

export type LinkPreview = {
  title?: string;
  image?: string;
  description?: string;
  siteName?: string;
};

const memory = new Map<string, LinkPreview | null>();
const KEY = (url: string) => `zp:og:${url}`;

/** Cached OG preview — prefers desktop bridge (no CORS), then localStorage. */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const key = url.trim();
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) ?? null;

  try {
    const cached = localStorage.getItem(KEY(key));
    if (cached) {
      const parsed = JSON.parse(cached) as LinkPreview;
      memory.set(key, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }

  let preview: LinkPreview | null = null;
  try {
    const res = await bridgeFetch("/link-preview", {
      method: "POST",
      body: JSON.stringify({ url: key }),
    });
    if (res.ok) {
      const data = (await res.json()) as { preview?: LinkPreview | null };
      preview = data.preview ?? null;
    }
  } catch {
    /* browser-only preview without host */
  }

  memory.set(key, preview);
  if (preview) {
    try {
      localStorage.setItem(KEY(key), JSON.stringify(preview));
    } catch {
      /* ignore */
    }
  }
  return preview;
}

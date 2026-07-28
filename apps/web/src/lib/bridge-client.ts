/**
 * Shared bridge client for the web UI talking to the Electrobun host.
 *
 * Token sources (in order):
 * 1. URL query (dev HMR only — views:// cannot take query params)
 * 2. sessionStorage (persists across soft navigations)
 * 3. GET /bridge-boot on 127.0.0.1:47821+ (packaged builds)
 */

const DEFAULT_PORT = 47821;
const PORT_SCAN = 32;
const TOKEN_KEY = "zeropaste.bridge.token";
const PORT_KEY = "zeropaste.bridge.port";

function readInjected(): { token: string; port: number } {
  if (typeof window === "undefined") {
    return { token: "", port: DEFAULT_PORT };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get("bridgeToken") ?? params.get("token");
    const qPort = params.get("bridgePort");
    if (qToken) {
      sessionStorage.setItem(TOKEN_KEY, qToken);
      if (qPort) sessionStorage.setItem(PORT_KEY, qPort);
      if (window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("bridgeToken");
          url.searchParams.delete("bridgePort");
          url.searchParams.delete("token");
          window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        } catch {
          /* views:// URL parsing can throw — leave the bar alone */
        }
      }
    }
  } catch {
    /* ignore */
  }
  const token = sessionStorage.getItem(TOKEN_KEY) ?? "";
  const port = Number(sessionStorage.getItem(PORT_KEY) || DEFAULT_PORT) || DEFAULT_PORT;
  return { token, port };
}

let cached = typeof window !== "undefined" ? readInjected() : { token: "", port: DEFAULT_PORT };
let bootPromise: Promise<void> | null = null;

async function discoverBridgeBoot(): Promise<void> {
  for (let i = 0; i < PORT_SCAN; i++) {
    const port = DEFAULT_PORT + i;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/bridge-boot`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { ok?: boolean; token?: string; port?: number };
      if (!data.token) continue;
      const resolvedPort = typeof data.port === "number" ? data.port : port;
      cached = { token: data.token, port: resolvedPort };
      try {
        sessionStorage.setItem(TOKEN_KEY, data.token);
        sessionStorage.setItem(PORT_KEY, String(resolvedPort));
      } catch {
        /* private mode */
      }
      console.info("[ZeroPaste] bridge boot via :", resolvedPort);
      return;
    } catch {
      /* try next port */
    }
  }
  console.warn("[ZeroPaste] bridge-boot discovery failed — host offline?");
}

/** Resolve token/port before any authenticated bridge call. */
export async function ensureBridgeBoot(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!cached.token) cached = readInjected();
  if (cached.token) return;
  if (!bootPromise) bootPromise = discoverBridgeBoot().finally(() => {
    /* keep promise for coalescing; allow retry if still empty */
    if (!cached.token) bootPromise = null;
  });
  await bootPromise;
}

export function getBridgeBase(): string {
  if (typeof window !== "undefined" && !cached.token) {
    cached = readInjected();
  }
  return `http://127.0.0.1:${cached.port}`;
}

export function getBridgeToken(): string {
  if (typeof window !== "undefined" && !cached.token) {
    cached = readInjected();
  }
  return cached.token;
}

export function bridgeUrl(path: string, withTokenQuery = false): string {
  const base = getBridgeBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!withTokenQuery) return `${base}${p}`;
  const token = getBridgeToken();
  const sep = p.includes("?") ? "&" : "?";
  return token ? `${base}${p}${sep}token=${encodeURIComponent(token)}` : `${base}${p}`;
}

export async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  await ensureBridgeBoot();
  const token = getBridgeToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("X-ZeroPaste-Token", token);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(bridgeUrl(path), { ...init, headers, cache: init?.cache ?? "no-store" });
}

/**
 * Shared bridge client for the web UI talking to the Electrobun host.
 * Token + port are injected via URL query on window load (or sessionStorage).
 */

const DEFAULT_PORT = 47821;
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
      // Strip secrets from the address bar without reloading.
      if (window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("bridgeToken");
        url.searchParams.delete("bridgePort");
        url.searchParams.delete("token");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
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
  const token = getBridgeToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("X-ZeroPaste-Token", token);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(bridgeUrl(path), { ...init, headers, cache: init?.cache ?? "no-store" });
}

/**
 * Per-install bridge token + dynamic port selection.
 * Token is required on every bridge request (header or ?token=) so arbitrary
 * websites cannot drive-by the host even when CORS is locked down.
 */

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = join(homedir(), ".zeropaste");
const TOKEN_FILE = join(ROOT, "bridge-token");
const PORT_FILE = join(ROOT, "bridge-port");

const DEFAULT_PORT = 47821;
const PORT_SCAN = 32;

let tokenCache: string | null = null;
let portCache: number | null = null;

export async function loadOrCreateBridgeToken(): Promise<string> {
  if (tokenCache) return tokenCache;
  await mkdir(ROOT, { recursive: true });
  try {
    const existing = (await readFile(TOKEN_FILE, "utf8")).trim();
    if (existing.length >= 32) {
      tokenCache = existing;
      return existing;
    }
  } catch {
    /* create */
  }
  const token = randomBytes(32).toString("hex");
  await writeFile(TOKEN_FILE, token, "utf8");
  if (process.platform !== "win32") {
    try {
      await chmod(TOKEN_FILE, 0o600);
    } catch {
      /* ignore */
    }
  }
  tokenCache = token;
  return token;
}

export function getBridgeToken(): string {
  if (!tokenCache) throw new Error("Bridge token not initialized");
  return tokenCache;
}

export async function recordBridgePort(port: number): Promise<void> {
  portCache = port;
  await mkdir(ROOT, { recursive: true });
  await writeFile(PORT_FILE, String(port), "utf8");
  if (process.platform !== "win32") {
    try {
      await chmod(PORT_FILE, 0o600);
    } catch {
      /* ignore */
    }
  }
}

export function getBridgePort(): number {
  return portCache ?? DEFAULT_PORT;
}

export { DEFAULT_PORT, PORT_SCAN };

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  // Packaged Electrobun WebView often sends Origin: null for views:// pages.
  const allow =
    !origin ||
    origin === "null" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("views://");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-ZeroPaste-Token",
  };
  if (allow) {
    // Echo a concrete origin when present; use * only when Origin is absent
    // (non-browser clients). Browsers that sent Origin: null need ACAO null.
    if (!origin) {
      headers["Access-Control-Allow-Origin"] = "*";
    } else {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
  }
  return headers;
}

export function extractBridgeToken(req: Request, url: URL): string | null {
  const header = req.headers.get("X-ZeroPaste-Token");
  if (header?.trim()) return header.trim();
  const q = url.searchParams.get("token");
  if (q?.trim()) return q.trim();
  return null;
}

export function isAuthorized(req: Request, url: URL): boolean {
  const provided = extractBridgeToken(req, url);
  if (!provided || !tokenCache) return false;
  return provided === tokenCache;
}

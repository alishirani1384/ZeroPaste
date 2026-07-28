/**
 * Encrypt ~/.zeropaste sensitive files at rest.
 *
 * Strategy: AES-256-GCM for all payloads (avoids PowerShell cmdline limits).
 * On Windows the 32-byte host key itself is DPAPI-protected (CurrentUser).
 */

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { spawnHiddenPowerShell } from "./platform/hidden-powershell";
import { atomicWriteFile } from "./atomic-write";

const ROOT = join(homedir(), ".zeropaste");
const HOST_KEY_FILE = join(ROOT, ".host-key");
const HOST_KEY_DPAPI_FILE = join(ROOT, ".host-key.dpapi");

const MAGIC = "ZPENC1";

/** DPAPI-protect a small buffer via a temp file (never inline large payloads into -Command). */
async function dpapiProtectBytes(plain: Buffer): Promise<Buffer | null> {
  if (process.platform !== "win32") return null;
  const tmpIn = join(ROOT, `.dpapi-in-${process.pid}-${Date.now()}.bin`);
  const tmpOut = join(ROOT, `.dpapi-out-${process.pid}-${Date.now()}.bin`);
  try {
    await mkdir(ROOT, { recursive: true });
    await writeFile(tmpIn, plain);
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$bytes = [IO.File]::ReadAllBytes('${tmpIn.replace(/'/g, "''")}')
$prot = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes('${tmpOut.replace(/'/g, "''")}', $prot)
`.trim();
    const { code, stderr } = await spawnHiddenPowerShell(["-Command", script]);
    if (code !== 0) {
      console.warn("[ZeroPaste] DPAPI protect failed", stderr);
      return null;
    }
    return await readFile(tmpOut);
  } catch (err) {
    console.warn("[ZeroPaste] DPAPI protect error", err);
    return null;
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

async function dpapiUnprotectBytes(prot: Buffer): Promise<Buffer | null> {
  if (process.platform !== "win32") return null;
  const tmpIn = join(ROOT, `.dpapi-in-${process.pid}-${Date.now()}.bin`);
  const tmpOut = join(ROOT, `.dpapi-out-${process.pid}-${Date.now()}.bin`);
  try {
    await mkdir(ROOT, { recursive: true });
    await writeFile(tmpIn, prot);
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$bytes = [IO.File]::ReadAllBytes('${tmpIn.replace(/'/g, "''")}')
$plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes('${tmpOut.replace(/'/g, "''")}', $plain)
`.trim();
    const { code, stderr } = await spawnHiddenPowerShell(["-Command", script]);
    if (code !== 0) {
      console.warn("[ZeroPaste] DPAPI unprotect failed", stderr);
      return null;
    }
    return await readFile(tmpOut);
  } catch (err) {
    console.warn("[ZeroPaste] DPAPI unprotect error", err);
    return null;
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

/** Process-lifetime cache — avoid re-running DPAPI PowerShell on every seal/open. */
let cachedHostKey: Buffer | null = null;

async function persistHostKey(key: Buffer): Promise<void> {
  cachedHostKey = key;
  await mkdir(ROOT, { recursive: true });
  if (process.platform === "win32") {
    const prot = await dpapiProtectBytes(key);
    if (prot) {
      await writeFile(HOST_KEY_DPAPI_FILE, prot);
      // Remove legacy plaintext key if present.
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(HOST_KEY_FILE).catch(() => {});
      } catch {
        /* ignore */
      }
      return;
    }
  }
  await writeFile(HOST_KEY_FILE, key);
  if (process.platform !== "win32") {
    try {
      await chmod(HOST_KEY_FILE, 0o600);
    } catch {
      /* ignore */
    }
  }
}

async function loadOrCreateHostKey(): Promise<Buffer> {
  if (cachedHostKey && cachedHostKey.byteLength === 32) return cachedHostKey;

  await mkdir(ROOT, { recursive: true });

  // Prefer DPAPI-wrapped key on Windows.
  try {
    const prot = await readFile(HOST_KEY_DPAPI_FILE);
    const plain = await dpapiUnprotectBytes(prot);
    if (plain && plain.byteLength === 32) {
      cachedHostKey = plain;
      return plain;
    }
  } catch {
    /* fall through */
  }

  // Legacy plaintext host key (migrate to DPAPI when possible).
  try {
    const raw = await readFile(HOST_KEY_FILE);
    if (raw.byteLength === 32) {
      const key = Buffer.from(raw);
      await persistHostKey(key);
      return key;
    }
  } catch {
    /* create */
  }

  const key = randomBytes(32);
  await persistHostKey(key);
  return key;
}

function aesEncrypt(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function aesDecrypt(key: Buffer, blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** Encrypt UTF-8 text → sealed file bytes. */
export async function sealUtf8(plaintext: string): Promise<Uint8Array> {
  const key = await loadOrCreateHostKey();
  const enc = aesEncrypt(key, Buffer.from(plaintext, "utf8"));
  return Buffer.concat([Buffer.from(MAGIC, "utf8"), Buffer.from("aes:", "utf8"), enc]);
}

/** Decrypt sealed bytes → UTF-8. Falls back to legacy plaintext / old dpapi: envelopes. */
export async function openUtf8(raw: Uint8Array | Buffer): Promise<string> {
  const buf = Buffer.from(raw);
  const magic = buf.subarray(0, MAGIC.length).toString("utf8");
  if (magic !== MAGIC) {
    return buf.toString("utf8");
  }
  const body = buf.subarray(MAGIC.length);
  const asText = body.toString("utf8");

  // Legacy: whole payload DPAPI'd via PowerShell (may fail to open if huge; rare).
  if (asText.startsWith("dpapi:")) {
    const protB64 = asText.slice("dpapi:".length);
    const prot = Buffer.from(protB64, "base64");
    const plain = await dpapiUnprotectBytes(prot);
    if (!plain) throw new Error("DPAPI unprotect failed");
    return plain.toString("utf8");
  }

  if (asText.startsWith("aes:") || body.subarray(0, 4).toString("utf8") === "aes:") {
    const prefix = Buffer.from("aes:", "utf8");
    const payload = body.subarray(prefix.length);
    const key = await loadOrCreateHostKey();
    return aesDecrypt(key, payload).toString("utf8");
  }

  throw new Error("Unknown sealed envelope");
}

export async function atomicWriteSealed(path: string, plaintext: string): Promise<void> {
  const sealed = await sealUtf8(plaintext);
  await atomicWriteFile(path, sealed, { mode: 0o600 });
}

export async function readMaybeSealed(path: string): Promise<string> {
  const raw = await readFile(path);
  return openUtf8(raw);
}

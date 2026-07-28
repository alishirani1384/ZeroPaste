/**
 * Encrypt ~/.zeropaste sensitive files at rest.
 * Windows: DPAPI (CurrentUser) via PowerShell ProtectedData.
 * Other platforms: AES-256-GCM with a machine-local key file (mode 0600).
 */

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { spawnHiddenPowerShell } from "./platform/hidden-powershell";
import { atomicWriteFile } from "./atomic-write";

const ROOT = join(homedir(), ".zeropaste");
const HOST_KEY_FILE = join(ROOT, ".host-key");

const MAGIC = "ZPENC1";

async function loadOrCreateHostKey(): Promise<Buffer> {
  await mkdir(ROOT, { recursive: true });
  try {
    const raw = await readFile(HOST_KEY_FILE);
    if (raw.byteLength === 32) return Buffer.from(raw);
  } catch {
    /* create */
  }
  const key = randomBytes(32);
  await writeFile(HOST_KEY_FILE, key);
  if (process.platform !== "win32") {
    try {
      await chmod(HOST_KEY_FILE, 0o600);
    } catch {
      /* ignore */
    }
  }
  return key;
}

async function dpapiProtect(plainB64: string): Promise<string | null> {
  if (process.platform !== "win32") return null;
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${plainB64}')
$prot = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($prot)
`.trim();
  const { stdout, code } = await spawnHiddenPowerShell(["-Command", script]);
  if (code !== 0 || !stdout) return null;
  return stdout.trim();
}

async function dpapiUnprotect(protB64: string): Promise<string | null> {
  if (process.platform !== "win32") return null;
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${protB64}')
$plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($plain)
`.trim();
  const { stdout, code } = await spawnHiddenPowerShell(["-Command", script]);
  if (code !== 0 || !stdout) return null;
  return stdout.trim();
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

/** Encrypt UTF-8 text → file bytes (magic + envelope). */
export async function sealUtf8(plaintext: string): Promise<Uint8Array> {
  const plain = Buffer.from(plaintext, "utf8");
  if (process.platform === "win32") {
    const prot = await dpapiProtect(plain.toString("base64"));
    if (prot) {
      const body = Buffer.from(`dpapi:${prot}`, "utf8");
      return Buffer.concat([Buffer.from(MAGIC, "utf8"), body]);
    }
  }
  const key = await loadOrCreateHostKey();
  const enc = aesEncrypt(key, plain);
  const body = Buffer.concat([Buffer.from("aes:", "utf8"), enc]);
  return Buffer.concat([Buffer.from(MAGIC, "utf8"), body]);
}

/** Decrypt file bytes → UTF-8 text. Falls back to treating raw as plaintext (legacy). */
export async function openUtf8(raw: Uint8Array | Buffer): Promise<string> {
  const buf = Buffer.from(raw);
  const magic = buf.subarray(0, MAGIC.length).toString("utf8");
  if (magic !== MAGIC) {
    // Legacy plaintext JSON
    return buf.toString("utf8");
  }
  const body = buf.subarray(MAGIC.length);
  const asText = body.toString("utf8");
  if (asText.startsWith("dpapi:")) {
    const plainB64 = await dpapiUnprotect(asText.slice("dpapi:".length));
    if (!plainB64) throw new Error("DPAPI unprotect failed");
    return Buffer.from(plainB64, "base64").toString("utf8");
  }
  if (asText.startsWith("aes:") || body[0] === 0x61 /* 'a' */) {
    // binary after "aes:" prefix
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

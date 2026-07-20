import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";

const memory = new Map<string, string>();
let dirReady: Promise<void> | null = null;

function cacheDir() {
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error("No file system cache directory");
  return `${base}zeropaste-images/`;
}

async function ensureDir() {
  if (!dirReady) {
    dirReady = FileSystem.makeDirectoryAsync(cacheDir(), { intermediates: true }).catch(() => undefined);
  }
  await dirReady;
}

function extForMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "img";
}

/** Prefer http/file; materialize huge data: URIs to disk so RN Image stays responsive. */
export async function resolveImageUri(
  raw: string | undefined | null,
  cacheKey: string,
): Promise<string | null> {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:")) {
    return value;
  }
  if (!value.startsWith("data:image")) return null;

  const hit = memory.get(cacheKey);
  if (hit) return hit;

  const m = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!m) return null;

  try {
    await ensureDir();
    const path = `${cacheDir()}${cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extForMime(m[1]!)}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.writeAsStringAsync(path, m[2]!, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    memory.set(cacheKey, path);
    return path;
  } catch (err) {
    console.warn("[image-uri]", err);
    if (value.length < 120_000) return value;
    return null;
  }
}

export function pickImageSource(clip: { body?: string; preview?: string }) {
  const preview = clip.preview?.trim() ?? "";
  const body = clip.body?.trim() ?? "";
  if (preview.startsWith("http") || preview.startsWith("file:") || preview.startsWith("data:image")) {
    return preview;
  }
  if (body.startsWith("http") || body.startsWith("file:") || body.startsWith("data:image")) {
    return body;
  }
  return undefined;
}

export function useResolvedImageUri(
  raw: string | undefined | null,
  cacheKey: string,
): { uri: string | null; loading: boolean } {
  const [uri, setUri] = useState<string | null>(() => {
    if (!raw) return null;
    if (raw.startsWith("http") || raw.startsWith("file:")) return raw;
    return memory.get(cacheKey) ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!raw) return false;
    if (raw.startsWith("http") || raw.startsWith("file:")) return false;
    return !memory.has(cacheKey) && raw.startsWith("data:image");
  });

  useEffect(() => {
    let cancelled = false;
    if (!raw) {
      setUri(null);
      setLoading(false);
      return;
    }
    if (raw.startsWith("http") || raw.startsWith("file:")) {
      setUri(raw);
      setLoading(false);
      return;
    }
    setLoading(true);
    void resolveImageUri(raw, cacheKey).then((resolved) => {
      if (!cancelled) {
        setUri(resolved);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [raw, cacheKey]);

  return { uri, loading };
}

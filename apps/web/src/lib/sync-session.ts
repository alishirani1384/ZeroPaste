import type { ClipItem } from "@paste/clipboard-core";
import { decryptClip, pullClips, pushClip, subscribeClips, type ClipRow } from "@paste/sync";

import { getSupabaseBrowser } from "./supabase";

const MAX_CLOUD_IMAGE_BYTES = 2 * 1024 * 1024;

/** Resolve bridge media URLs into a data URL so encrypt/push has real payload. */
async function materializeForPush(clip: ClipItem): Promise<ClipItem | null> {
  if (clip.kind !== "image") return clip;
  if (clip.byteSize > MAX_CLOUD_IMAGE_BYTES) return null;

  const src = clip.preview || clip.body;
  if (!src.startsWith("http://127.0.0.1:47821/clip-media/")) {
    // Already a data URL / remote URL under size cap
    if (src.startsWith("data:") && clip.byteSize > MAX_CLOUD_IMAGE_BYTES) return null;
    return clip;
  }

  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_CLOUD_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const dataUrl = `data:image/png;base64,${btoa(binary)}`;
    return { ...clip, body: dataUrl, preview: dataUrl, byteSize: buf.byteLength };
  } catch {
    return null;
  }
}

/** Push a clip when vault + Supabase auth are available. Failures are soft. */
export async function tryPushEncryptedClip(
  clip: ClipItem,
  vaultKey: Uint8Array,
): Promise<"pushed" | "skipped" | "local_only" | "error"> {
  if (clip.kind === "image" && clip.byteSize > MAX_CLOUD_IMAGE_BYTES) {
    console.info("[sync] image >2MB kept local only", clip.id.slice(0, 8));
    return "local_only";
  }

  const client = getSupabaseBrowser();
  if (!client) return "skipped";
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return "skipped";

  const payload = await materializeForPush(clip);
  if (!payload) {
    if (clip.kind === "image") return "local_only";
    return "error";
  }

  try {
    await pushClip(client, session.user.id, null, payload, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] push failed", err);
    return "error";
  }
}

export async function tryPullEncryptedClips(vaultKey: Uint8Array): Promise<ClipItem[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return [];
  return pullClips(client, session.user.id, vaultKey);
}

export function trySubscribeEncryptedClips(
  vaultKey: Uint8Array,
  onClip: (clip: ClipItem) => void,
): (() => void) | null {
  const client = getSupabaseBrowser();
  if (!client) return null;

  let unsub: (() => void) | null = null;

  void client.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    const channel = subscribeClips(client, session.user.id, (row: ClipRow) => {
      if (row.deleted_at) return;
      try {
        onClip(
          decryptClip(vaultKey, {
            version: 1,
            ciphertext: row.ciphertext,
            nonce: row.nonce,
            wrappedKey: row.wrapped_key,
          }),
        );
      } catch (err) {
        console.warn("[sync] realtime decrypt failed", err);
      }
    });
    unsub = () => {
      void client.removeChannel(channel);
    };
  });

  return () => unsub?.();
}

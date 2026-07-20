import type { ClipItem, Pinboard } from "@paste/clipboard-core";
import {
  decryptClip,
  loadLocalDeviceId,
  pullClips,
  pullPinboards,
  pushClip,
  pushPinboard,
  registerDevice,
  softDeleteRemoteClip,
  subscribeClips,
  type ClipRow,
} from "@paste/sync";

import { getSupabaseBrowser } from "./supabase";

let cachedDeviceId: string | null = loadLocalDeviceId();

async function ensureDeviceId(): Promise<string | null> {
  if (cachedDeviceId) return cachedDeviceId;
  const client = getSupabaseBrowser();
  if (!client) return null;
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  try {
    cachedDeviceId = await registerDevice(client, session.user.id);
    return cachedDeviceId;
  } catch (err) {
    console.warn("[sync] device register failed", err);
    return null;
  }
}

export async function tryRegisterDevice(): Promise<string | null> {
  return ensureDeviceId();
}

const MAX_CLOUD_IMAGE_BYTES = 2 * 1024 * 1024;

/** Resolve bridge media URLs into a data URL so encrypt/push has real payload. */
async function materializeForPush(clip: ClipItem): Promise<ClipItem | null> {
  // Tombstones never need media — push an empty encrypted stub if needed.
  if (clip.deletedAt) {
    return {
      ...clip,
      body: "",
      preview: "",
      byteSize: 0,
      title: clip.title || "Deleted",
    };
  }

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
  if (!clip.deletedAt && clip.kind === "image" && clip.byteSize > MAX_CLOUD_IMAGE_BYTES) {
    console.info("[sync] image >2MB kept local only", clip.id.slice(0, 8));
    return "local_only";
  }

  const client = getSupabaseBrowser();
  if (!client) return "skipped";
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return "skipped";

  // Prefer a lightweight UPDATE for deletes so missing local media cannot block sync.
  if (clip.deletedAt) {
    try {
      const updated = await softDeleteRemoteClip(
        client,
        session.user.id,
        clip.id,
        clip.deletedAt,
        clip.updatedAt,
      );
      if (updated) return "pushed";

      const stub = await materializeForPush(clip);
      if (!stub) return "error";
      const deviceId = await ensureDeviceId();
      await pushClip(client, session.user.id, deviceId, stub, vaultKey);
      return "pushed";
    } catch (err) {
      console.warn("[sync] delete push failed", err);
      return "error";
    }
  }

  const payload = await materializeForPush(clip);
  if (!payload) {
    if (clip.kind === "image") return "local_only";
    return "error";
  }

  try {
    const deviceId = await ensureDeviceId();
    await pushClip(client, session.user.id, deviceId, payload, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] push failed", err);
    return "error";
  }
}

export async function tryPullEncryptedPinboards(vaultKey: Uint8Array): Promise<Pinboard[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return [];
  try {
    return await pullPinboards(client, session.user.id, vaultKey);
  } catch (err) {
    console.warn("[sync] pullPinboards failed", err);
    return [];
  }
}

export async function tryPushEncryptedPinboard(
  board: Pinboard,
  vaultKey: Uint8Array,
): Promise<"pushed" | "skipped" | "error"> {
  if (board.id === "history") return "skipped";
  const client = getSupabaseBrowser();
  if (!client) return "skipped";
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return "skipped";
  try {
    await pushPinboard(client, session.user.id, board, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] pinboard push failed", err);
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
  try {
    return await pullClips(client, session.user.id, vaultKey);
  } catch (err) {
    // Missing table/column or RLS — treat as empty so onboarding doesn't loop toasts.
    console.warn("[sync] pullClips failed", err);
    throw err;
  }
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
      try {
        if (row.deleted_at) {
          onClip({
            id: row.id,
            kind: (row.kind as ClipItem["kind"]) || "other",
            title: "Deleted",
            preview: "",
            body: "",
            mimeType: "text/plain",
            byteSize: 0,
            contentHash: row.id,
            source: {
              appName: "Cloud",
              deviceName: "Sync",
              devicePlatform: "web",
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            pinnedBoardIds: [],
            deletedAt: row.deleted_at,
          });
          return;
        }
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

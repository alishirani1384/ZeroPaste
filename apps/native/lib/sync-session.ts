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

import { getSupabaseNative } from "./supabase";

let cachedDeviceId: string | null = null;

async function ensureDeviceId(): Promise<string | null> {
  if (cachedDeviceId) return cachedDeviceId;
  cachedDeviceId = loadLocalDeviceId();
  if (cachedDeviceId) return cachedDeviceId;
  const client = getSupabaseNative();
  if (!client) return null;
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  try {
    cachedDeviceId = await registerDevice(client, session.user.id, {
      platform: "android",
      name: "ZeroPaste · Android",
    });
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

export async function tryPushEncryptedClip(
  clip: ClipItem,
  vaultKey: Uint8Array,
): Promise<"pushed" | "skipped" | "local_only" | "error"> {
  if (!clip.deletedAt && clip.kind === "image" && clip.byteSize > MAX_CLOUD_IMAGE_BYTES) {
    return "local_only";
  }

  const client = getSupabaseNative();
  if (!client) return "skipped";
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return "skipped";

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
      const deviceId = await ensureDeviceId();
      await pushClip(
        client,
        session.user.id,
        deviceId,
        { ...clip, body: "", preview: "", byteSize: 0, title: clip.title || "Deleted" },
        vaultKey,
      );
      return "pushed";
    } catch (err) {
      console.warn("[sync] delete push failed", err);
      return "error";
    }
  }

  try {
    const deviceId = await ensureDeviceId();
    await pushClip(client, session.user.id, deviceId, clip, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] push failed", err);
    return "error";
  }
}

export async function tryPullEncryptedPinboards(vaultKey: Uint8Array): Promise<Pinboard[]> {
  const client = getSupabaseNative();
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
  const client = getSupabaseNative();
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
  const client = getSupabaseNative();
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
  const client = getSupabaseNative();
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

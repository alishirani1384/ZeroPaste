import type { ClipItem, Pinboard } from "@paste/clipboard-core";
import {
  decryptClip,
  loadClipsPullCursor,
  loadLocalDeviceId,
  pullClips,
  pullPinboards,
  pushClip,
  pushPinboard,
  registerDevice,
  saveClipsPullCursor,
  softDeleteRemoteClip,
  softDeleteRemotePinboard,
  subscribeClips,
  type ClipRow,
  type PullClipsOptions,
  type PullClipsResult,
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

export async function tryPullEncryptedPinboards(
  vaultKey: Uint8Array,
): Promise<{ boards: Pinboard[]; failedCount: number }> {
  const client = getSupabaseNative();
  if (!client) return { boards: [], failedCount: 0 };
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return { boards: [], failedCount: 0 };
  try {
    return await pullPinboards(client, session.user.id, vaultKey);
  } catch (err) {
    console.warn("[sync] pullPinboards failed", err);
    return { boards: [], failedCount: 0 };
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

/** Soft-delete a pinboard remotely, mirroring the clip delete flow. */
export async function trySoftDeletePinboard(
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
  const deletedAt = board.deletedAt ?? new Date().toISOString();
  try {
    const updated = await softDeleteRemotePinboard(
      client,
      session.user.id,
      board.id,
      deletedAt,
      deletedAt,
    );
    if (updated) return "pushed";
    await pushPinboard(client, session.user.id, { ...board, deletedAt }, vaultKey);
    return "pushed";
  } catch (err) {
    console.warn("[sync] pinboard delete push failed", err);
    return "error";
  }
}

export async function tryPullEncryptedClips(
  vaultKey: Uint8Array,
  opts?: {
    full?: boolean;
    onPage?: PullClipsOptions["onPage"];
    signal?: AbortSignal;
    onFirstPage?: () => void;
  },
): Promise<PullClipsResult> {
  const client = getSupabaseNative();
  if (!client) return { items: [], failedCount: 0, maxUpdatedAt: null };
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return { items: [], failedCount: 0, maxUpdatedAt: null };
  const since = opts?.full ? undefined : await loadClipsPullCursor(session.user.id);
  let first = true;
  const result = await pullClips(client, session.user.id, vaultKey, {
    since,
    strategy: since ? "incremental" : "full",
    // Hermes is heavier than desktop — keep concurrency moderate.
    decryptConcurrency: 8,
    signal: opts?.signal,
    onPage: (page, meta) => {
      if (first && page.length > 0) {
        first = false;
        opts?.onFirstPage?.();
      }
      opts?.onPage?.(page, meta);
    },
  });
  if (result.maxUpdatedAt) {
    await saveClipsPullCursor(session.user.id, result.maxUpdatedAt);
  }
  return result;
}

export function trySubscribeEncryptedClips(
  vaultKey: Uint8Array,
  onClip: (clip: ClipItem) => void,
): (() => void) | null {
  const client = getSupabaseNative();
  if (!client) return null;

  let cancelled = false;
  let unsub: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = () => {
    if (cancelled) return;
    void client.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;

      const channel = subscribeClips(
        client,
        session.user.id,
        (row: ClipRow) => {
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
        },
        (status) => {
          if (status === "SUBSCRIBED") {
            attempt = 0;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (cancelled) return;
            unsub = null;
            void client.removeChannel(channel);
            const delay = Math.min(1000 * 2 ** attempt, 30000);
            attempt++;
            reconnectTimer = setTimeout(connect, delay);
          }
        },
      );

      if (cancelled) {
        void client.removeChannel(channel);
        return;
      }
      unsub = () => {
        void client.removeChannel(channel);
      };
    });
  };

  connect();

  return () => {
    cancelled = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    unsub?.();
  };
}

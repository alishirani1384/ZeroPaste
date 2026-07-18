import type { ClipItem } from "@paste/clipboard-core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptClip } from "./clip-crypto";
import type { ClipRow } from "./types";

export async function pullClips(
  client: SupabaseClient,
  userId: string,
  vaultKey: Uint8Array,
  since?: string,
): Promise<ClipItem[]> {
  let query = client
    .from("clips")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true });

  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query;
  if (error) throw error;

  const items: ClipItem[] = [];
  for (const row of (data ?? []) as ClipRow[]) {
    if (row.deleted_at) {
      items.push({
        id: row.id,
        kind: "other",
        title: "",
        preview: "",
        body: "",
        mimeType: "text/plain",
        byteSize: 0,
        contentHash: "",
        source: {
          appName: "Remote",
          deviceName: "Sync",
          devicePlatform: "web",
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pinnedBoardIds: [],
        deletedAt: row.deleted_at,
      });
      continue;
    }
    try {
      items.push(
        decryptClip(vaultKey, {
          version: 1,
          ciphertext: row.ciphertext,
          nonce: row.nonce,
          wrappedKey: row.wrapped_key,
        }),
      );
    } catch (err) {
      console.warn("[sync] failed to decrypt clip", row.id, err);
    }
  }
  return items;
}

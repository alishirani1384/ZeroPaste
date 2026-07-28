import type { ClipItem } from "@paste/clipboard-core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptClip } from "./clip-crypto";
import type { ClipRow } from "./types";

const PAGE_SIZE = 500;

export async function pullClips(
  client: SupabaseClient,
  userId: string,
  vaultKey: Uint8Array,
  since?: string,
): Promise<{ items: ClipItem[]; failedCount: number }> {
  const items: ClipItem[] = [];
  let failedCount = 0;
  let from = 0;

  for (;;) {
    let query = client
      .from("clips")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (since) query = query.gt("updated_at", since);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ClipRow[];
    for (const row of rows) {
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
        failedCount++;
        console.warn("[sync] failed to decrypt clip", row.id, err);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { items, failedCount };
}

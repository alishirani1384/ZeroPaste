import type { Pinboard } from "@paste/clipboard-core";
import { decryptJson, encryptJson } from "@paste/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PinboardRow = {
  id: string;
  user_id: string;
  ciphertext: string;
  nonce: string;
  wrapped_key: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Built-in History board stays local-only. */
export function isSyncablePinboard(board: Pinboard): boolean {
  return board.id !== "history";
}

export async function pushPinboard(
  client: SupabaseClient,
  userId: string,
  board: Pinboard,
  vaultKey: Uint8Array,
) {
  if (!isSyncablePinboard(board)) return;
  const envelope = encryptJson(vaultKey, board);
  const now = new Date().toISOString();
  const { error } = await client.from("pinboards").upsert({
    id: board.id,
    user_id: userId,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
    wrapped_key: envelope.wrappedKey,
    sort_order: board.sortOrder,
    created_at: board.createdAt || now,
    updated_at: now,
    deleted_at: null,
  });
  if (error) throw error;
}

export async function pullPinboards(
  client: SupabaseClient,
  userId: string,
  vaultKey: Uint8Array,
): Promise<Pinboard[]> {
  const { data, error } = await client
    .from("pinboards")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const boards: Pinboard[] = [];
  for (const row of (data ?? []) as PinboardRow[]) {
    try {
      const board = decryptJson<Pinboard>(vaultKey, {
        version: 1,
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        wrappedKey: row.wrapped_key,
      });
      if (isSyncablePinboard(board)) boards.push(board);
    } catch (err) {
      console.warn("[sync] failed to decrypt pinboard", row.id, err);
    }
  }
  return boards;
}

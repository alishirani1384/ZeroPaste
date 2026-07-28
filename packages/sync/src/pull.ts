import type { ClipItem } from "@paste/clipboard-core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptClip } from "./clip-crypto";
import type { ClipRow } from "./types";

const PAGE_SIZE = 200;
/** Parallel AES unwraps per page — big win when history has image data-URLs. */
const DECRYPT_CONCURRENCY = 8;

export type PullClipsResult = {
  items: ClipItem[];
  failedCount: number;
  /** Highest updated_at seen in this pull (for incremental cursor). */
  maxUpdatedAt: string | null;
};

export type PullClipsOptions = {
  since?: string;
  /** Called after each page is decrypted so UI can merge progressively. */
  onPage?: (page: ClipItem[], meta: { pageIndex: number; failedCount: number }) => void;
  signal?: AbortSignal;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

function tombstoneFromRow(row: ClipRow): ClipItem {
  return {
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
  };
}

async function decryptRows(
  rows: ClipRow[],
  vaultKey: Uint8Array,
): Promise<{ items: ClipItem[]; failedCount: number }> {
  type Slot =
    | { kind: "tombstone"; item: ClipItem }
    | { kind: "live"; row: ClipRow }
    | { kind: "done"; item: ClipItem | null; failed: boolean };

  const slots: Slot[] = rows.map((row) =>
    row.deleted_at
      ? { kind: "tombstone", item: tombstoneFromRow(row) }
      : { kind: "live", row },
  );

  const liveIdx: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.kind === "live") liveIdx.push(i);
  }

  const liveRows = liveIdx.map((i) => (slots[i] as { kind: "live"; row: ClipRow }).row);
  const decrypted = await mapPool(liveRows, DECRYPT_CONCURRENCY, async (row) => {
    try {
      const item = decryptClip(vaultKey, {
        version: 1,
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        wrappedKey: row.wrapped_key,
      });
      return { item, failed: false as const };
    } catch (err) {
      console.warn("[sync] failed to decrypt clip", row.id, err);
      return { item: null, failed: true as const };
    }
  });

  let failedCount = 0;
  const items: ClipItem[] = [];
  let liveCursor = 0;
  for (const slot of slots) {
    if (slot.kind === "tombstone") {
      items.push(slot.item);
      continue;
    }
    const result = decrypted[liveCursor++]!;
    if (result.failed || !result.item) {
      failedCount++;
      continue;
    }
    items.push(result.item);
  }
  return { items, failedCount };
}

function maxIso(a: string | null, b: string): string {
  if (!a) return b;
  return a >= b ? a : b;
}

export async function pullClips(
  client: SupabaseClient,
  userId: string,
  vaultKey: Uint8Array,
  sinceOrOpts?: string | PullClipsOptions,
): Promise<PullClipsResult> {
  const opts: PullClipsOptions =
    typeof sinceOrOpts === "string" || sinceOrOpts === undefined
      ? { since: sinceOrOpts }
      : sinceOrOpts;

  const items: ClipItem[] = [];
  let failedCount = 0;
  let maxUpdatedAt: string | null = opts.since ?? null;
  let from = 0;
  let pageIndex = 0;

  for (;;) {
    if (opts.signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }

    let query = client
      .from("clips")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (opts.since) query = query.gt("updated_at", opts.since);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ClipRow[];
    for (const row of rows) {
      maxUpdatedAt = maxIso(maxUpdatedAt, row.updated_at);
    }

    const page = await decryptRows(rows, vaultKey);
    failedCount += page.failedCount;
    items.push(...page.items);
    opts.onPage?.(page.items, { pageIndex, failedCount: page.failedCount });
    pageIndex++;

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { items, failedCount, maxUpdatedAt };
}

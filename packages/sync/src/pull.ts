import type { ClipItem } from "@paste/clipboard-core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptClip } from "./clip-crypto";
import type { ClipRow } from "./types";

const PAGE_SIZE = 150;
/** Default parallel AES unwraps per page (callers can lower on mobile). */
const DEFAULT_DECRYPT_CONCURRENCY = 16;

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
  /** Parallel decrypt workers (default 16). */
  decryptConcurrency?: number;
  /**
   * `full` — newest-first; light/non-image clips before heavy images (first open).
   * `incremental` — oldest-first from cursor (default when `since` is set).
   */
  strategy?: "full" | "incremental";
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
  concurrency: number,
): Promise<{ items: ClipItem[]; failedCount: number }> {
  type Slot =
    | { kind: "tombstone"; item: ClipItem }
    | { kind: "live"; row: ClipRow };

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
  const decrypted = await mapPool(liveRows, concurrency, async (row) => {
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

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const err = new Error("Aborted");
  err.name = "AbortError";
  throw err;
}

type PageFilter = "all" | "light" | "heavy";

async function fetchClipPage(
  client: SupabaseClient,
  userId: string,
  opts: {
    from: number;
    since?: string;
    ascending: boolean;
    filter: PageFilter;
  },
): Promise<ClipRow[]> {
  let query = client
    .from("clips")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: opts.ascending })
    .range(opts.from, opts.from + PAGE_SIZE - 1);

  if (opts.since) query = query.gt("updated_at", opts.since);

  // Prefer plaintext `kind` so first open can show text/links before fat image rows.
  if (opts.filter === "light") {
    query = query.or("kind.is.null,kind.neq.image");
  } else if (opts.filter === "heavy") {
    query = query.eq("kind", "image");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClipRow[];
}

/**
 * Fetch page N+1 while decrypting page N so network and CPU overlap.
 */
async function pullFiltered(
  client: SupabaseClient,
  userId: string,
  vaultKey: Uint8Array,
  opts: {
    since?: string;
    ascending: boolean;
    filter: PageFilter;
    decryptConcurrency: number;
    onPage?: PullClipsOptions["onPage"];
    signal?: AbortSignal;
    pageIndexStart: number;
  },
): Promise<{ items: ClipItem[]; failedCount: number; maxUpdatedAt: string | null; pages: number }> {
  const items: ClipItem[] = [];
  let failedCount = 0;
  let maxUpdatedAt: string | null = opts.since ?? null;
  let from = 0;
  let pageIndex = opts.pageIndexStart;

  let pending = fetchClipPage(client, userId, {
    from,
    since: opts.since,
    ascending: opts.ascending,
    filter: opts.filter,
  });

  for (;;) {
    throwIfAborted(opts.signal);
    const rows = await pending;
    if (rows.length === 0) break;

    for (const row of rows) {
      maxUpdatedAt = maxIso(maxUpdatedAt, row.updated_at);
    }

    const hasMore = rows.length === PAGE_SIZE;
    const nextFrom = from + PAGE_SIZE;
    pending = hasMore
      ? fetchClipPage(client, userId, {
          from: nextFrom,
          since: opts.since,
          ascending: opts.ascending,
          filter: opts.filter,
        })
      : Promise.resolve([]);

    const page = await decryptRows(rows, vaultKey, opts.decryptConcurrency);
    failedCount += page.failedCount;
    items.push(...page.items);
    opts.onPage?.(page.items, { pageIndex, failedCount: page.failedCount });
    pageIndex++;

    if (!hasMore) break;
    from = nextFrom;
  }

  return { items, failedCount, maxUpdatedAt, pages: pageIndex - opts.pageIndexStart };
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

  const decryptConcurrency = opts.decryptConcurrency ?? DEFAULT_DECRYPT_CONCURRENCY;
  const strategy =
    opts.strategy ?? (opts.since ? ("incremental" as const) : ("full" as const));

  if (strategy === "incremental" || opts.since) {
    // Cursor catch-up: oldest → newest so we never skip gaps.
    return pullFiltered(client, userId, vaultKey, {
      since: opts.since,
      ascending: true,
      filter: "all",
      decryptConcurrency,
      onPage: opts.onPage,
      signal: opts.signal,
      pageIndexStart: 0,
    });
  }

  // First open / full restore: newest light clips first, then images.
  const light = await pullFiltered(client, userId, vaultKey, {
    ascending: false,
    filter: "light",
    decryptConcurrency,
    onPage: opts.onPage,
    signal: opts.signal,
    pageIndexStart: 0,
  });

  const heavy = await pullFiltered(client, userId, vaultKey, {
    ascending: false,
    filter: "heavy",
    decryptConcurrency,
    onPage: opts.onPage,
    signal: opts.signal,
    pageIndexStart: light.pages,
  });

  let maxUpdatedAt = light.maxUpdatedAt;
  if (heavy.maxUpdatedAt) {
    maxUpdatedAt = maxUpdatedAt
      ? maxIso(maxUpdatedAt, heavy.maxUpdatedAt)
      : heavy.maxUpdatedAt;
  }

  return {
    items: [...light.items, ...heavy.items],
    failedCount: light.failedCount + heavy.failedCount,
    maxUpdatedAt,
  };
}

import type { ClipFilter, ClipItem } from "./types";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD");
}

/** Accurate local search over decrypted metadata + body (100% match on client cache). */
export function searchClips(items: ClipItem[], filter: ClipFilter = {}): ClipItem[] {
  const q = filter.query?.trim() ? normalize(filter.query) : "";
  const kinds = filter.kinds?.length ? new Set(filter.kinds) : null;
  const from = filter.from ? new Date(filter.from).getTime() : null;
  const to = filter.to ? new Date(filter.to).getTime() : null;

  const filtered = items.filter((item) => {
    if (item.deletedAt) return false;
    if (filter.boardId && filter.boardId !== "history") {
      if (!item.pinnedBoardIds.includes(filter.boardId)) return false;
    }
    if (kinds && !kinds.has(item.kind)) return false;
    if (filter.sourceApp && item.source.appName !== filter.sourceApp) return false;
    const t = new Date(item.createdAt).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    if (!q) return true;
    const hay = normalize(
      [
        item.title,
        item.preview,
        item.body,
        item.source.appName,
        item.source.windowTitle ?? "",
        item.source.url ?? "",
        item.kind,
        item.language ?? "",
        item.mimeType,
      ].join("\n"),
    );
    return hay.includes(q);
  });

  if (filter.preserveOrder) return filtered;
  return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

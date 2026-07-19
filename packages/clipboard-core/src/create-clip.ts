import { classifyText, previewFromContent, titleFromContent } from "./classify";
import { contentHash } from "./hash";
import type { ClipItem, ClipKind, ClipSource } from "./types";

export type CreateClipInput = {
  body: string;
  kind?: ClipKind;
  mimeType?: string;
  source: ClipSource;
  html?: string;
  imageDataUrl?: string;
  id?: string;
  createdAt?: string;
  /** Override size (e.g. raw PNG bytes instead of URL string length). */
  byteSize?: number;
};

export async function createClipFromCapture(input: CreateClipInput): Promise<ClipItem> {
  const kind =
    input.kind ??
    (input.imageDataUrl ? "image" : classifyText(input.body));
  const body = input.imageDataUrl ?? input.body;
  const now = input.createdAt ?? new Date().toISOString();
  const hash = await contentHash(body);

  return {
    id: input.id ?? crypto.randomUUID(),
    kind,
    title: titleFromContent(kind, kind === "image" ? "Image" : input.body),
    preview: previewFromContent(kind, body),
    body,
    html: input.html,
    mimeType: input.mimeType ?? (kind === "image" ? "image/png" : "text/plain"),
    byteSize: input.byteSize ?? new TextEncoder().encode(body).byteLength,
    contentHash: hash,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    pinnedBoardIds: [],
  };
}

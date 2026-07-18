import type { ClipItem, Pinboard } from "./types";

const now = Date.now();

function ago(ms: number): string {
  return new Date(now - ms).toISOString();
}

export const SEED_PINBOARDS: Pinboard[] = [
  {
    id: "board-snippets",
    name: "Snippets",
    color: "oklch(0.62 0.19 32)",
    createdAt: ago(86_400_000 * 30),
    sortOrder: 0,
  },
  {
    id: "board-design",
    name: "Design",
    color: "oklch(0.58 0.16 250)",
    createdAt: ago(86_400_000 * 20),
    sortOrder: 1,
  },
  {
    id: "board-links",
    name: "Links",
    color: "oklch(0.65 0.14 155)",
    createdAt: ago(86_400_000 * 10),
    sortOrder: 2,
  },
];

export const SEED_CLIPS: ClipItem[] = [
  {
    id: "clip-1",
    kind: "link",
    title: "pasteapp.io",
    preview: "https://pasteapp.io/",
    body: "https://pasteapp.io/",
    mimeType: "text/uri-list",
    byteSize: 20,
    contentHash: "seed1",
    source: {
      appName: "Chrome",
      deviceName: "Desktop",
      devicePlatform: "windows",
      url: "https://pasteapp.io/",
    },
    createdAt: ago(45_000),
    updatedAt: ago(45_000),
    pinnedBoardIds: ["board-links"],
  },
  {
    id: "clip-2",
    kind: "code",
    title: "export async function syncClips",
    preview:
      "export async function syncClips(vaultKey: Uint8Array) {\n  const envelope = await encryptClip(item, vaultKey);\n  await supabase.from('clips').upsert(envelope);\n}",
    body: "export async function syncClips(vaultKey: Uint8Array) {\n  const envelope = await encryptClip(item, vaultKey);\n  await supabase.from('clips').upsert(envelope);\n}",
    mimeType: "text/plain",
    byteSize: 180,
    contentHash: "seed2",
    source: {
      appName: "Cursor",
      windowTitle: "packages/sync/src/push.ts",
      deviceName: "Desktop",
      devicePlatform: "windows",
    },
    createdAt: ago(180_000),
    updatedAt: ago(180_000),
    pinnedBoardIds: ["board-snippets"],
    language: "typescript",
  },
  {
    id: "clip-3",
    kind: "text",
    title: "Your clipboard, supercharged and secure",
    preview:
      "ZeroPaste keeps everything you copy organized and searchable — with default-on end-to-end encryption.",
    body: "ZeroPaste keeps everything you copy organized and searchable — with default-on end-to-end encryption.",
    mimeType: "text/plain",
    byteSize: 98,
    contentHash: "seed3",
    source: {
      appName: "Notes",
      deviceName: "Desktop",
      devicePlatform: "windows",
    },
    createdAt: ago(900_000),
    updatedAt: ago(900_000),
    pinnedBoardIds: [],
  },
  {
    id: "clip-4",
    kind: "color",
    title: "#E85D4C",
    preview: "#E85D4C",
    body: "#E85D4C",
    mimeType: "text/plain",
    byteSize: 7,
    contentHash: "seed4",
    source: {
      appName: "Figma",
      deviceName: "Desktop",
      devicePlatform: "windows",
    },
    createdAt: ago(3_600_000),
    updatedAt: ago(3_600_000),
    pinnedBoardIds: ["board-design"],
  },
  {
    id: "clip-5",
    kind: "image",
    title: "Screenshot",
    preview:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1c1c1e"/><stop offset="100%" stop-color="#3a3a3c"/>
          </linearGradient></defs>
          <rect width="480" height="300" fill="url(#g)"/>
          <rect x="40" y="48" width="400" height="204" rx="16" fill="#2c2c2e" stroke="#48484a"/>
          <circle cx="88" cy="96" r="10" fill="#ff5f57"/><circle cx="120" cy="96" r="10" fill="#febc2e"/><circle cx="152" cy="96" r="10" fill="#28c840"/>
          <text x="240" y="170" text-anchor="middle" fill="#f5f5f7" font-family="system-ui" font-size="22" font-weight="600">ZeroPaste</text>
          <text x="240" y="200" text-anchor="middle" fill="#a1a1a6" font-family="system-ui" font-size="13">Clipboard preview</text>
        </svg>`,
      ),
    body: "",
    mimeType: "image/svg+xml",
    byteSize: 1200,
    contentHash: "seed5",
    source: {
      appName: "Snipping Tool",
      deviceName: "Desktop",
      devicePlatform: "windows",
    },
    createdAt: ago(7_200_000),
    updatedAt: ago(7_200_000),
    pinnedBoardIds: [],
    imageWidth: 480,
    imageHeight: 300,
  },
  {
    id: "clip-6",
    kind: "link",
    title: "entilitystudio.com",
    preview: "https://www.entilitystudio.com/copycat-clipboard",
    body: "https://www.entilitystudio.com/copycat-clipboard",
    mimeType: "text/uri-list",
    byteSize: 50,
    contentHash: "seed6",
    source: {
      appName: "Firefox",
      deviceName: "Laptop",
      devicePlatform: "linux",
    },
    createdAt: ago(14_400_000),
    updatedAt: ago(14_400_000),
    pinnedBoardIds: ["board-links"],
  },
  {
    id: "clip-7",
    kind: "code",
    title: "CREATE POLICY clips_owner",
    preview:
      "create policy clips_owner on public.clips\n  for all using (auth.uid() = user_id)\n  with check (auth.uid() = user_id);",
    body: "create policy clips_owner on public.clips\n  for all using (auth.uid() = user_id)\n  with check (auth.uid() = user_id);",
    mimeType: "text/plain",
    byteSize: 120,
    contentHash: "seed7",
    source: {
      appName: "pgAdmin",
      deviceName: "Desktop",
      devicePlatform: "windows",
    },
    createdAt: ago(28_800_000),
    updatedAt: ago(28_800_000),
    pinnedBoardIds: ["board-snippets"],
    language: "sql",
  },
  {
    id: "clip-8",
    kind: "text",
    title: "Ctrl+Shift+V opens ZeroPaste",
    preview: "Use Ctrl+Shift+V to open your clipboard history. Press 1–9 for Quick Paste.",
    body: "Use Ctrl+Shift+V to open your clipboard history. Press 1–9 for Quick Paste.",
    mimeType: "text/plain",
    byteSize: 76,
    contentHash: "seed8",
    source: {
      appName: "ZeroPaste",
      deviceName: "Phone",
      devicePlatform: "android",
    },
    createdAt: ago(86_400_000),
    updatedAt: ago(86_400_000),
    pinnedBoardIds: [],
  },
];

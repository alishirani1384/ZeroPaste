export type ClipKind = "text" | "link" | "image" | "code" | "file" | "color" | "other";

export type ClipSource = {
  appName: string;
  appId?: string;
  windowTitle?: string;
  url?: string;
  deviceName: string;
  devicePlatform: "windows" | "linux" | "android" | "web" | "macos" | "ios";
};

export type ClipItem = {
  id: string;
  kind: ClipKind;
  title: string;
  preview: string;
  /** Plaintext body for text/link/code; data URL or storage key for images */
  body: string;
  html?: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  source: ClipSource;
  createdAt: string;
  updatedAt: string;
  pinnedBoardIds: string[];
  language?: string;
  imageWidth?: number;
  imageHeight?: number;
  deletedAt?: string | null;
};

export type Pinboard = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  sortOrder: number;
};

export type ClipFilter = {
  query?: string;
  kinds?: ClipKind[];
  sourceApp?: string;
  boardId?: string | "history";
  from?: string;
  to?: string;
};

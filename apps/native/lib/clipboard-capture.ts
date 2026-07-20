import { createClipFromCapture, type ClipItem } from "@paste/clipboard-core";
import * as Clipboard from "expo-clipboard";
import * as Device from "expo-device";
import { AppState, type AppStateStatus, Platform } from "react-native";

import {
  getLastForegroundApp,
  hasUsageAccess,
  isSourceModuleAvailable,
  suppressNextClipboardCapture,
  type NativeClipboardCapture,
} from "zeropaste-source";

let lastHash = "";
let lastForegroundHint: { appName: string; appId?: string; windowTitle?: string } | null = null;

const RECOVERY_KEY_RE = /^[0-9a-f]{64}$/i;

const KNOWN_LABELS: Record<string, string> = {
  "com.android.chrome": "Chrome",
  "com.chrome.browser": "Chrome",
  "com.google.android.gm": "Gmail",
  "com.whatsapp": "WhatsApp",
  "org.telegram.messenger": "Telegram",
  "com.instagram.android": "Instagram",
  "com.twitter.android": "X",
  "com.discord": "Discord",
  "com.slack": "Slack",
  "com.microsoft.office.outlook": "Outlook",
  "com.google.android.apps.messaging": "Messages",
  "com.samsung.android.messaging": "Messages",
  "com.android.systemui": "System",
};

export type SourceApp = {
  appName: string;
  appId?: string;
  windowTitle?: string;
};

/**
 * Best-effort source app.
 * - Synced desktop clips keep real names from the host.
 * - On Android with Usage Access + native module: last foreground app before return.
 * - Expo Go cannot include the native module → falls back to a generic label.
 */
export async function resolveSourceApp(): Promise<SourceApp> {
  if (lastForegroundHint) return lastForegroundHint;

  if (Platform.OS === "android" && isSourceModuleAvailable() && hasUsageAccess()) {
    try {
      const info = getLastForegroundApp();
      if (info?.packageName && !/zeropaste/i.test(info.packageName)) {
        const appName =
          KNOWN_LABELS[info.packageName] ??
          info.label?.trim() ??
          info.packageName.split(".").pop() ??
          "Android app";
        lastForegroundHint = {
          appName: appName.slice(0, 80),
          appId: info.packageName,
          windowTitle: (info.className || info.label || appName).slice(0, 240),
        };
        return lastForegroundHint;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    appName: isSourceModuleAvailable() ? "Android app" : "Other app",
  };
}

export function bindForegroundTracking() {
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "background" || state === "inactive") {
      // Clear cached hint so the next resume re-queries UsageStats.
      lastForegroundHint = null;
    }
  });
  return () => sub.remove();
}

/**
 * Read system clipboard if it changed since the last successful capture.
 * Android only allows this while our process is in the foreground (or just resumed).
 */
export async function captureClipboardIfChanged(): Promise<ClipItem | null> {
  // Android often needs a beat after resume before clipboard is readable.
  const hasString = await Clipboard.hasStringAsync().catch(() => false);
  if (!hasString) return null;

  const text = await Clipboard.getStringAsync().catch(() => "");
  if (!text?.trim()) return null;
  if (RECOVERY_KEY_RE.test(text.trim())) return null;

  const sourceApp = await resolveSourceApp();
  const deviceName = Device.modelName ?? Device.deviceName ?? "Android";

  const clip = await createClipFromCapture({
    body: text,
    source: {
      appName: sourceApp.appName,
      appId: sourceApp.appId,
      windowTitle: sourceApp.windowTitle,
      deviceName,
      devicePlatform: "android",
    },
  });

  if (clip.contentHash === lastHash) return null;
  lastHash = clip.contentHash;
  lastForegroundHint = null;
  return clip;
}

/** Seed dedupe hash from the newest local clip so we don't re-ingest it on launch. */
export function rememberContentHash(hash: string | undefined) {
  if (hash) lastHash = hash;
}

export async function copyClipToClipboard(clip: ClipItem) {
  suppressNextClipboardCapture();
  if (clip.kind === "image") {
    if (clip.body.startsWith("data:")) {
      await Clipboard.setImageAsync(clip.body.replace(/^data:image\/\w+;base64,/, ""));
      return;
    }
  }
  await Clipboard.setStringAsync(clip.body || clip.preview || clip.title);
  // Avoid immediately re-capturing our own write.
  if (clip.contentHash) lastHash = clip.contentHash;
}

/** Build a clip from a native background capture payload. */
export async function clipFromNativeCapture(
  capture: NativeClipboardCapture,
): Promise<ClipItem | null> {
  const text = capture.text?.trim();
  if (!text) return null;
  if (RECOVERY_KEY_RE.test(text)) return null;

  const appName =
    capture.appName?.trim() ||
    (capture.packageName ? KNOWN_LABELS[capture.packageName] : undefined) ||
    "Android app";
  const deviceName = Device.modelName ?? Device.deviceName ?? "Android";

  const clip = await createClipFromCapture({
    body: text,
    source: {
      appName: appName.slice(0, 80),
      appId: capture.packageName ?? undefined,
      windowTitle: appName.slice(0, 240),
      deviceName,
      devicePlatform: "android",
    },
  });

  if (clip.contentHash === lastHash) return null;
  lastHash = clip.contentHash;
  lastForegroundHint = null;
  return clip;
}

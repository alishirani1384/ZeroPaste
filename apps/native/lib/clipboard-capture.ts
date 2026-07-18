import { createClipFromCapture, type ClipItem } from "@paste/clipboard-core";
import * as Clipboard from "expo-clipboard";

let lastHash = "";

export async function captureClipboardIfChanged(
  deviceName = "Android",
): Promise<ClipItem | null> {
  const hasString = await Clipboard.hasStringAsync();
  if (!hasString) return null;

  const text = await Clipboard.getStringAsync();
  if (!text?.trim()) return null;

  const clip = await createClipFromCapture({
    body: text,
    source: {
      appName: "Clipboard",
      deviceName,
      devicePlatform: "android",
    },
  });

  if (clip.contentHash === lastHash) return null;
  lastHash = clip.contentHash;
  return clip;
}

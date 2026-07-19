import { captureFocusTargetIfExternal, restoreFocusTarget } from "./focus-target";
import { getClipMedia } from "./media-store";
import { isZeroPasteForeground } from "./noactivate";
import { writeClipboardImage, writeClipboardText } from "./platform/clipboard-write";
import { sendCtrlV } from "./send-paste";
import { getState, noteClipboardFingerprint, suppressCapture } from "./store";

/**
 * Paste like Win11 Clipboard / Ditto persistent mode (cross-platform):
 * 1) Keep shelf from activating (NOACTIVATE / showInactive)
 * 2) Put clip on the OS clipboard
 * 3) Ctrl+V into the caret app — soft-restore focus only if shelf stole it
 */
export async function pasteClipById(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clip = getState().clips.find((c) => c.id === id && !c.deletedAt);
  if (!clip) return { ok: false, error: "not_found" };

  suppressCapture(2500);
  await captureFocusTargetIfExternal();

  try {
    if (clip.kind === "image") {
      const media = getClipMedia(clip.id);
      if (!media) return { ok: false, error: "no_media" };
      noteClipboardFingerprint(["image"], null, media.paste.byteLength);
      // Electrobun/Linux want PNG; Windows PowerShell accepts PNG or BMP.
      const pngMagic =
        media.display[0] === 0x89 && media.display[1] === 0x50
          ? media.display
          : media.paste[0] === 0x89 && media.paste[1] === 0x50
            ? media.paste
            : null;
      if (process.platform === "linux") {
        if (!pngMagic) return { ok: false, error: "image_needs_png" };
        await writeClipboardImage(pngMagic, "image/png");
      } else {
        await writeClipboardImage(
          media.displayMime.includes("png") || pngMagic ? (pngMagic ?? media.display) : media.display,
          media.displayMime,
        );
      }
    } else {
      noteClipboardFingerprint(["text"], clip.body, 0);
      await writeClipboardText(clip.body);
    }
  } catch (err) {
    console.warn("[ZeroPaste] clipboard write failed", err);
    return { ok: false, error: "clipboard_write_failed" };
  }

  const shelfFocused = await isZeroPasteForeground();
  if (shelfFocused) {
    console.log("[ZeroPaste] shelf focused — soft restore caret app");
    await restoreFocusTarget();
    await Bun.sleep(50);
  } else {
    console.log("[ZeroPaste] caret app still focused — Ctrl+V only");
  }

  await sendCtrlV();
  console.log("[ZeroPaste] pasted", id.slice(0, 8), clip.kind, {
    shelfFocused,
    platform: process.platform,
  });
  return { ok: true };
}

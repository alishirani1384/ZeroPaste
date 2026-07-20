import { captureFocusTargetIfExternal, restoreFocusTarget } from "./focus-target";
import { disableKeyboardFocus, isKeyboardFocusActive } from "./keyboard-focus";
import { getClipMedia } from "./media-store";
import { writeClipboardImage, writeClipboardText } from "./platform/clipboard-write";
import { sendCtrlV } from "./send-paste";
import { getState, noteClipboardFingerprint, suppressCapture } from "./store";

/**
 * Paste fast path (Win11 Clipboard / Ditto style):
 * - Normal click: clipboard write → Ctrl+V (no PowerShell focus dance)
 * - Search/typing: exit typing, restore caret app, then Ctrl+V
 */
export async function pasteClipById(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clip = getState().clips.find((c) => c.id === id && !c.deletedAt);
  if (!clip) return { ok: false, error: "not_found" };

  const wasTyping = isKeyboardFocusActive();
  suppressCapture(2500);

  if (wasTyping) {
    // Search stole OS focus — leave typing mode and put caret app back.
    await disableKeyboardFocus();
    await captureFocusTargetIfExternal();
    await restoreFocusTarget();
    await Bun.sleep(16);
  }

  try {
    if (clip.kind === "image") {
      const media = getClipMedia(clip.id);
      if (!media) return { ok: false, error: "no_media" };
      noteClipboardFingerprint(["image"], null, media.paste.byteLength);
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

  // Panel uses NOACTIVATE / showInactive — caret app should still be focused.
  // Only re-check when we were typing (focus was stolen).
  if (wasTyping) {
    await restoreFocusTarget();
    await Bun.sleep(16);
  }

  const injected = await sendCtrlV();
  if (!injected) {
    return { ok: false, error: "paste_inject_failed" };
  }
  console.log("[ZeroPaste] pasted", id.slice(0, 8), clip.kind, {
    wasTyping,
    platform: process.platform,
  });
  return { ok: true };
}

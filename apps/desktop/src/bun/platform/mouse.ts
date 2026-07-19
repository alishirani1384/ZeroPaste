/**
 * Cross-platform left-button state for drag-to-paste.
 * Prefer Electrobun Screen.getMouseButtons (Win/Linux/macOS); fall back to user32 on Win.
 */

import { Screen } from "electrobun/bun";
import { dlopen } from "bun:ffi";

const user32 =
  process.platform === "win32"
    ? dlopen("user32.dll", {
        GetAsyncKeyState: { args: ["i32"], returns: "i16" },
      })
    : null;

export function isLeftButtonDown(): boolean {
  try {
    const bits = Screen.getMouseButtons();
    // bit 0 = left (Electrobun docs)
    if (typeof bits === "bigint") return (bits & 1n) !== 0n;
    return (Number(bits) & 1) !== 0;
  } catch {
    /* fall through */
  }

  if (user32) {
    const state = user32.symbols.GetAsyncKeyState(0x01);
    return (state & 0x8000) !== 0;
  }
  return false;
}

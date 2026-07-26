/**
 * Temporarily allow the shelf to take keyboard focus (search, editors).
 * Registered from the host BrowserWindow in index.ts.
 */

let enableImpl: () => void | Promise<void> = () => {};
let disableImpl: () => void | Promise<void> = () => {};
let active = false;
/** Bumps on every enable/disable so stale async work cannot reverse the latest intent. */
let epoch = 0;

export function registerKeyboardFocus(api: {
  enable: () => void | Promise<void>;
  disable: () => void | Promise<void>;
}) {
  enableImpl = api.enable;
  disableImpl = api.disable;
}

export function isKeyboardFocusActive() {
  return active;
}

export async function enableKeyboardFocus() {
  const my = ++epoch;
  active = true;
  await enableImpl();
  // A newer disable/enable won — don't leave stale state.
  if (my !== epoch) return;
  active = true;
}

export async function disableKeyboardFocus() {
  const my = ++epoch;
  active = false;
  await disableImpl();
  if (my !== epoch) return;
  active = false;
}

/**
 * Temporarily allow the shelf to take keyboard focus (search, editors).
 * Registered from the host BrowserWindow in index.ts.
 */

let enableImpl: () => void | Promise<void> = () => {};
let disableImpl: () => void | Promise<void> = () => {};
let active = false;

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
  active = true;
  await enableImpl();
}

export async function disableKeyboardFocus() {
  active = false;
  await disableImpl();
}

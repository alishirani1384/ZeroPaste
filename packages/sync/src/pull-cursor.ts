import { getSyncStorage } from "./storage";

/** Per-user cursor so refresh only fetches clips newer than the last successful pull. */
export function clipsPullCursorKey(userId: string): string {
  return `zeropaste.sync.clipsCursor.${userId}`;
}

export async function loadClipsPullCursor(userId: string): Promise<string | undefined> {
  const storage = getSyncStorage();
  if (!storage) return undefined;
  try {
    const v = await storage.getItem(clipsPullCursorKey(userId));
    return v?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function saveClipsPullCursor(userId: string, iso: string): Promise<void> {
  const storage = getSyncStorage();
  if (!storage || !iso) return;
  try {
    await storage.setItem(clipsPullCursorKey(userId), iso);
  } catch {
    /* ignore quota */
  }
}

export async function clearClipsPullCursor(userId: string): Promise<void> {
  const storage = getSyncStorage();
  if (!storage) return;
  try {
    await storage.removeItem(clipsPullCursorKey(userId));
  } catch {
    /* ignore */
  }
}

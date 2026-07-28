/**
 * Crash-safe file writes: write to a sibling temp file, then rename into place.
 * `rename` is atomic on the same volume on Windows and POSIX.
 */

import { chmod, rename, writeFile } from "node:fs/promises";

export async function atomicWriteFile(
  path: string,
  data: string | Uint8Array,
  opts?: { mode?: number },
): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
  if (opts?.mode != null && process.platform !== "win32") {
    try {
      await chmod(path, opts.mode);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Spawn PowerShell without a visible console window.
 * Prefer Win32 FFI over this when possible — PS is still used for a few clipboard paths.
 */
export async function spawnHiddenPowerShell(
  args: string[],
  opts?: { stdout?: "pipe" | "ignore"; stderr?: "pipe" | "ignore" },
): Promise<{ stdout: string; stderr: string; code: number }> {
  const proc = Bun.spawn(["powershell", "-NoProfile", "-WindowStyle", "Hidden", ...args], {
    stdout: opts?.stdout ?? "pipe",
    stderr: opts?.stderr ?? "pipe",
    windowsHide: true,
  } as Parameters<typeof Bun.spawn>[1]);
  const [stdout, stderr, code] = await Promise.all([
    opts?.stdout === "ignore" ? Promise.resolve("") : new Response(proc.stdout as ReadableStream).text(),
    opts?.stderr === "ignore" ? Promise.resolve("") : new Response(proc.stderr as ReadableStream).text(),
    proc.exited,
  ]);
  return { stdout: stdout.trim(), stderr: stderr.trim(), code };
}

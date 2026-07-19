/** Detect Linux display server (X11 vs Wayland) for paste/focus tooling. */

export type DisplayServer = "win32" | "x11" | "wayland" | "unknown";

let cached: DisplayServer | null = null;

export function getDisplayServer(): DisplayServer {
  if (cached) return cached;
  if (process.platform === "win32") {
    cached = "win32";
    return cached;
  }
  if (process.platform !== "linux") {
    cached = "unknown";
    return cached;
  }
  const session = (process.env.XDG_SESSION_TYPE ?? "").toLowerCase();
  const wayland = process.env.WAYLAND_DISPLAY;
  if (session === "wayland" || wayland) {
    cached = "wayland";
  } else if (session === "x11" || process.env.DISPLAY) {
    cached = "x11";
  } else {
    cached = "unknown";
  }
  return cached;
}

export async function commandExists(bin: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["sh", "-c", `command -v ${bin}`], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const out = (await new Response(proc.stdout).text()).trim();
    return (await proc.exited) === 0 && out.length > 0;
  } catch {
    return false;
  }
}

export async function logLinuxPasteEnvironment() {
  if (process.platform !== "linux") return;
  const server = getDisplayServer();
  const tools = ["xdotool", "ydotool", "wtype", "dotool", "wl-copy", "xclip", "xsel"];
  const present: string[] = [];
  for (const t of tools) {
    if (await commandExists(t)) present.push(t);
  }
  console.log(`[ZeroPaste] Linux session=${server} tools=[${present.join(", ") || "none"}]`);
  if (server === "x11" && !present.includes("xdotool")) {
    console.warn("[ZeroPaste] Install xdotool for click-to-paste on X11: sudo apt install xdotool");
  }
  if (server === "wayland" && !present.some((t) => ["ydotool", "wtype", "dotool"].includes(t))) {
    console.warn(
      "[ZeroPaste] Wayland: install ydotool or wtype for paste injection (xdotool usually will not work)",
    );
  }
}

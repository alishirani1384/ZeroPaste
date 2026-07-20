import type { SupabaseClient } from "@supabase/supabase-js";

export type DevicePlatform = "windows" | "linux" | "macos" | "web" | "android" | "ios";

const DEVICE_ID_KEY = "zeropaste.device.id";

export function loadLocalDeviceId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export function saveLocalDeviceId(id: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("linux")) return "linux";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  return "web";
}

export function defaultDeviceName(platform: DevicePlatform = detectDevicePlatform()): string {
  const label =
    platform === "windows"
      ? "Windows"
      : platform === "linux"
        ? "Linux"
        : platform === "macos"
          ? "macOS"
          : "Device";
  return `ZeroPaste · ${label}`;
}

/** Register or refresh this device row; persists id in localStorage. */
export async function registerDevice(
  client: SupabaseClient,
  userId: string,
  opts?: { name?: string; platform?: DevicePlatform },
): Promise<string> {
  const platform = opts?.platform ?? detectDevicePlatform();
  const name = opts?.name ?? defaultDeviceName(platform);
  const existing = loadLocalDeviceId();
  const id = existing ?? crypto.randomUUID();
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await client
      .from("devices")
      .update({ name, platform, last_seen_at: now })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if ((data?.length ?? 0) > 0) {
      saveLocalDeviceId(id);
      return id;
    }
    // Row was deleted remotely — re-insert below.
  }

  {
    const { error } = await client.from("devices").insert({
      id,
      user_id: userId,
      name,
      platform,
      last_seen_at: now,
    });
    if (error) throw error;
  }

  saveLocalDeviceId(id);
  return id;
}

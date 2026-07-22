import { EventEmitter, type EventSubscription, requireNativeModule } from "expo-modules-core";
import { PermissionsAndroid, Platform } from "react-native";

export type ForegroundAppInfo = {
  label: string;
  packageName: string;
  className?: string;
};

export type NativeClipboardCapture = {
  text: string;
  appName?: string | null;
  packageName?: string | null;
  capturedAt?: number;
};

type ZeropasteSourceNative = {
  hasUsageAccess: () => boolean;
  openUsageAccessSettings: () => boolean;
  getLastForegroundApp: () => ForegroundAppInfo | null;
  isClipboardWatchAvailable: () => boolean;
  isClipboardWatchEnabled: () => boolean;
  setClipboardWatchEnabled: (enabled: boolean) => boolean;
  isClipboardWatchRunning: () => boolean;
  startClipboardWatch: () => Promise<boolean>;
  stopClipboardWatch: () => Promise<boolean>;
  suppressNextClipboardCapture: () => boolean;
  drainPendingCaptures: () => NativeClipboardCapture[];
  openNotificationSettings: () => boolean;
  isIgnoringBatteryOptimizations: () => boolean;
  requestIgnoreBatteryOptimizations: () => boolean;
};

function getModule(): ZeropasteSourceNative | null {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<ZeropasteSourceNative>("ZeropasteSource");
  } catch {
    return null;
  }
}

function getEmitter(): EventEmitter | null {
  const mod = getModule();
  if (!mod) return null;
  try {
    return new EventEmitter(mod as unknown as object);
  } catch {
    return null;
  }
}

/** True when the native UsageStats module is linked (dev/production build, not Expo Go). */
export function isSourceModuleAvailable(): boolean {
  return getModule() != null;
}

export function hasUsageAccess(): boolean {
  return getModule()?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): boolean {
  return getModule()?.openUsageAccessSettings() ?? false;
}

export function getLastForegroundApp(): ForegroundAppInfo | null {
  try {
    return getModule()?.getLastForegroundApp() ?? null;
  } catch {
    return null;
  }
}

export function isClipboardWatchAvailable(): boolean {
  return getModule()?.isClipboardWatchAvailable() ?? false;
}

export function isClipboardWatchEnabled(): boolean {
  return getModule()?.isClipboardWatchEnabled() ?? false;
}

export function setClipboardWatchEnabled(enabled: boolean): boolean {
  return getModule()?.setClipboardWatchEnabled(enabled) ?? false;
}

export function isClipboardWatchRunning(): boolean {
  return getModule()?.isClipboardWatchRunning() ?? false;
}

export async function requestClipboardWatchNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (typeof Platform.Version === "number" && Platform.Version < 33) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function startClipboardWatch(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  await requestClipboardWatchNotificationPermission();
  try {
    mod.setClipboardWatchEnabled(true);
    return await mod.startClipboardWatch();
  } catch {
    return false;
  }
}

export async function stopClipboardWatch(opts?: { disable?: boolean }): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    if (opts?.disable) mod.setClipboardWatchEnabled(false);
    return await mod.stopClipboardWatch();
  } catch {
    return false;
  }
}

export function suppressNextClipboardCapture(): void {
  try {
    getModule()?.suppressNextClipboardCapture();
  } catch {
    /* ignore */
  }
}

export function drainPendingCaptures(): NativeClipboardCapture[] {
  try {
    return getModule()?.drainPendingCaptures() ?? [];
  } catch {
    return [];
  }
}

export function openNotificationSettings(): boolean {
  return getModule()?.openNotificationSettings() ?? false;
}

export function isIgnoringBatteryOptimizations(): boolean {
  return getModule()?.isIgnoringBatteryOptimizations() ?? true;
}

export function requestIgnoreBatteryOptimizations(): boolean {
  return getModule()?.requestIgnoreBatteryOptimizations() ?? false;
}

export function addClipboardCaptureListener(
  listener: (capture: NativeClipboardCapture) => void,
): EventSubscription | { remove: () => void } {
  const mod = getModule() as (ZeropasteSourceNative & {
    addListener?: (event: string, cb: (c: NativeClipboardCapture) => void) => EventSubscription;
  }) | null;
  if (!mod) return { remove: () => undefined };
  if (typeof mod.addListener === "function") {
    return mod.addListener("onClipboardCaptured", listener);
  }
  const emitter = getEmitter();
  if (!emitter) return { remove: () => undefined };
  return emitter.addListener("onClipboardCaptured", listener);
}

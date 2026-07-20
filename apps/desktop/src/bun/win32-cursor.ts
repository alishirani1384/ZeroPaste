/**
 * Electrobun transparent windows use CEF OSR. OSR often leaves the blue
 * IDC_APPSTARTING spinner stuck (bridge HTTP calls even show isMain=1 in logs).
 * While the pointer is over our window tree we re-assert SetCursor every frame.
 */
import { dlopen, ptr } from "bun:ffi";

export type NativeCursorKind = "arrow" | "hand" | "ibeam" | "sizeall" | "no";

const IDC_ARROW = 32512;
const IDC_IBEAM = 32513;
const IDC_SIZEALL = 32646;
const IDC_NO = 32648;
const IDC_HAND = 32649;
const GA_ROOT = 2;

let user32: ReturnType<typeof dlopen> | null = null;
let handles: Partial<Record<NativeCursorKind, number | bigint>> = {};
let rootHwnd: number | bigint | null = null;
let desired: NativeCursorKind = "arrow";
let enforcer: ReturnType<typeof setInterval> | null = null;
let pointBuf: Buffer | null = null;

function init(): boolean {
  if (process.platform !== "win32") return false;
  if (user32) return true;
  try {
    user32 = dlopen("user32.dll", {
      LoadCursorW: { args: ["ptr", "i32"], returns: "ptr" },
      SetCursor: { args: ["ptr"], returns: "ptr" },
      GetCursorPos: { args: ["ptr"], returns: "i32" },
      WindowFromPoint: { args: ["i64"], returns: "ptr" },
      GetAncestor: { args: ["ptr", "i32"], returns: "ptr" },
      GetParent: { args: ["ptr"], returns: "ptr" },
      IsWindow: { args: ["ptr"], returns: "i32" },
      FindWindowW: { args: ["ptr", "ptr"], returns: "ptr" },
    });

    const load = (id: number) => user32!.symbols.LoadCursorW(null, id);
    handles = {
      arrow: load(IDC_ARROW),
      ibeam: load(IDC_IBEAM),
      hand: load(IDC_HAND),
      sizeall: load(IDC_SIZEALL),
      no: load(IDC_NO),
    };
    pointBuf = Buffer.alloc(8);
    return true;
  } catch (err) {
    console.warn("[ZeroPaste] win32-cursor init failed", err);
    user32 = null;
    return false;
  }
}

function utf16Ptr(text: string) {
  return ptr(Buffer.from(text + "\0", "utf16le"));
}

function hwndOk(h: unknown): h is number | bigint {
  if (h === null || h === undefined) return false;
  try {
    return BigInt(h as number | bigint) !== 0n;
  } catch {
    return false;
  }
}

export function resolveRootHwnd(title = "ZeroPaste"): number | bigint | null {
  if (!init() || !user32) return null;
  try {
    const h = user32.symbols.FindWindowW(null, utf16Ptr(title));
    if (hwndOk(h) && user32.symbols.IsWindow(h)) {
      rootHwnd = h as number | bigint;
      return rootHwnd;
    }
  } catch {
    /* ignore */
  }
  return rootHwnd;
}

function normalizeKind(kind: string): NativeCursorKind {
  const c = kind.trim().toLowerCase();
  if (c === "pointer") return "hand";
  if (c === "text" || c === "vertical-text") return "ibeam";
  if (c === "grab" || c === "grabbing" || c === "move" || c === "all-scroll") return "sizeall";
  if (c === "not-allowed" || c === "no-drop") return "no";
  // Never allow wait/progress — OSR sticks on the blue loading spinner.
  if (c === "wait" || c === "progress") return "arrow";
  if (c === "hand") return "hand";
  if (c === "ibeam") return "ibeam";
  if (c === "sizeall") return "sizeall";
  if (c === "no") return "no";
  if (c === "arrow") return "arrow";
  return "arrow";
}

export function setDesiredCursor(kind: string) {
  desired = normalizeKind(kind);
  // Web only sends this while the pointer is in the OSR view — apply immediately.
  applyDesired();
}

function applyDesired() {
  if (!user32) return;
  const h = handles[desired] ?? handles.arrow;
  if (!h) return;
  try {
    user32.symbols.SetCursor(h);
  } catch {
    /* ignore */
  }
}

function belongsToRoot(hit: number | bigint, root: number | bigint): boolean {
  if (!user32) return false;
  try {
    if (BigInt(hit) === BigInt(root)) return true;
    const anc = user32.symbols.GetAncestor(hit, GA_ROOT);
    if (hwndOk(anc) && BigInt(anc as number | bigint) === BigInt(root)) return true;
    let h: unknown = hit;
    for (let i = 0; i < 24; i++) {
      if (!hwndOk(h)) break;
      if (BigInt(h) === BigInt(root)) return true;
      h = user32.symbols.GetParent(h);
    }
  } catch {
    return false;
  }
  return false;
}

function isPointerOverUs(): boolean {
  if (!user32 || !pointBuf) return false;
  const root = rootHwnd ?? resolveRootHwnd();
  if (!hwndOk(root)) return false;
  try {
    const ok = user32.symbols.GetCursorPos(ptr(pointBuf));
    if (!ok) return false;
    const x = pointBuf.readInt32LE(0);
    const y = pointBuf.readInt32LE(4);
    const packed = (BigInt(x | 0) & 0xffffffffn) | ((BigInt(y | 0) & 0xffffffffn) << 32n);
    const hit = user32.symbols.WindowFromPoint(packed);
    if (!hwndOk(hit)) return false;
    return belongsToRoot(hit, root);
  } catch {
    return false;
  }
}

export function startCursorEnforcer(title = "ZeroPaste") {
  if (process.platform !== "win32") return;
  if (!init()) return;
  resolveRootHwnd(title);
  if (enforcer) return;

  let ticks = 0;
  enforcer = setInterval(() => {
    ticks++;
    if (ticks % 60 === 1) resolveRootHwnd(title);
    if (!isPointerOverUs()) return;
    applyDesired();
  }, 16);

  console.log("[ZeroPaste] OSR cursor enforcer on (overrides stuck loading cursor)");
}

export function stopCursorEnforcer() {
  if (enforcer) clearInterval(enforcer);
  enforcer = null;
}

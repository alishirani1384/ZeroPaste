import type { ClipItem, Pinboard } from "@paste/clipboard-core";

export type BridgeState = {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
  captureEnabled?: boolean;
  hostWarnings?: string[];
};

const BRIDGE = "http://127.0.0.1:47821";

export const FALLBACK_STATE: BridgeState = {
  clips: [],
  pinboards: [
    {
      id: "history",
      name: "History",
      color: "#888888",
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    },
  ],
  pausedUntil: null,
  compact: false,
  captureEnabled: false,
  hostWarnings: [],
};

export async function fetchBridgeState(): Promise<BridgeState | null> {
  try {
    const res = await fetch(`${BRIDGE}/state`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BridgeState;
  } catch {
    return null;
  }
}

export function subscribeBridge(onState: (s: BridgeState) => void): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const startPoll = () => {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      const s = await fetchBridgeState();
      if (s && !closed) onState(s);
    }, 800);
  };

  try {
    es = new EventSource(`${BRIDGE}/events`);
    es.onmessage = (ev) => {
      try {
        onState(JSON.parse(ev.data) as BridgeState);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      startPoll();
    };
  } catch {
    startPoll();
  }

  void fetchBridgeState().then((s) => {
    if (!closed) onState(s ?? FALLBACK_STATE);
  });

  return () => {
    closed = true;
    es?.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}

export async function pasteClip(id: string, plain = false): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BRIDGE}/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, plain }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "paste_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "bridge_offline" };
  }
}

export async function dragPaste(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/drag-paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return !!data.ok;
  } catch {
    return false;
  }
}

export async function cancelDragPaste() {
  try {
    await fetch(`${BRIDGE}/drag-paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  } catch {
    /* ignore */
  }
}

export async function pauseCapture(durationMs: number | null) {
  try {
    await fetch(`${BRIDGE}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMs }),
    });
  } catch {
    /* demo mode */
  }
}

export async function updateClipBody(id: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/clip-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setCaptureEnabled(enabled: boolean) {
  try {
    await fetch(`${BRIDGE}/capture-enabled`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  } catch {
    /* ignore */
  }
}

export async function suppressCapture(ms = 5000) {
  try {
    await fetch(`${BRIDGE}/suppress-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ms }),
    });
  } catch {
    /* ignore */
  }
}

export async function createPinboard(name: string, color?: string): Promise<Pinboard | null> {
  try {
    const res = await fetch(`${BRIDGE}/pinboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { board?: Pinboard };
    return data.board ?? null;
  } catch {
    return null;
  }
}

export async function pinClipToBoard(clipId: string, boardId: string) {
  try {
    await fetch(`${BRIDGE}/pin-clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId, boardId }),
    });
  } catch {
    /* ignore */
  }
}

export async function mergeClipsFromCloud(clips: ClipItem[]): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/clips-merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function upsertClipFromCloud(clip: ClipItem): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/clip-upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clip }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mergePinboardsFromCloud(pinboards: Pinboard[]): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/pinboards-merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinboards }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAutostartEnabled(): Promise<boolean | null> {
  try {
    const res = await fetch(`${BRIDGE}/autostart`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { enabled?: boolean };
    return Boolean(data.enabled);
  } catch {
    return null;
  }
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/autostart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteClip(id: string) {
  try {
    await fetch(`${BRIDGE}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    /* ignore */
  }
}

export type DesktopWindowMode = "panel" | "vault";

export async function setDesktopWindowMode(mode: DesktopWindowMode) {
  try {
    const res = await fetch(`${BRIDGE}/window-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) console.warn("[ZeroPaste] window-mode failed", res.status);
  } catch {
    /* browser preview */
  }
}

/** Hide the desktop window (hotkey brings it back). No-op in browser preview. */
export async function hideDesktopWindow() {
  try {
    const res = await fetch(`${BRIDGE}/window-hide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) console.warn("[ZeroPaste] window-hide failed", res.status);
  } catch {
    /* browser preview */
  }
}

/**
 * Allow the shelf to take OS keyboard focus (search / editors).
 * Cleared on blur so paste can keep the caret in the target app.
 */
export async function setDesktopKeyboardFocus(enabled: boolean) {
  try {
    await fetch(`${BRIDGE}/keyboard-focus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  } catch {
    /* browser preview */
  }
}

export async function reorderClips(ids: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/clips-reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { fitDesktopWindow, observeDesktopFit, anchorForMode } from "./window-fit";

import { SEED_CLIPS, SEED_PINBOARDS, type ClipItem, type Pinboard } from "@paste/clipboard-core";

export type BridgeState = {
  clips: ClipItem[];
  pinboards: Pinboard[];
  pausedUntil: number | null;
  compact: boolean;
};

const BRIDGE = "http://127.0.0.1:47821";

export const FALLBACK_STATE: BridgeState = {
  clips: SEED_CLIPS,
  pinboards: SEED_PINBOARDS,
  pausedUntil: null,
  compact: false,
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

export async function pasteClip(id: string, plain = false) {
  try {
    await fetch(`${BRIDGE}/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, plain }),
    });
  } catch {
    const clip = FALLBACK_STATE.clips.find((c) => c.id === id);
    if (clip && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(clip.kind === "image" ? clip.title : clip.body);
    }
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

export type DesktopWindowMode = "panel" | "vault";

/** Ask Electrobun host to switch panel/vault preset. Prefer observeDesktopFit for exact size. */
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

export { fitDesktopWindow, observeDesktopFit, anchorForMode } from "./window-fit";

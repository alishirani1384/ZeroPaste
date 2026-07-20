import { ensureDefaultAutostart, isAutostartEnabled, setAutostartEnabled } from "./autostart";
import { cancelDragPaste, runDragPaste } from "./drag-paste";
import { normalizeClipboardImage } from "./image-format";
import { disableKeyboardFocus, enableKeyboardFocus } from "./keyboard-focus";
import { getClipMedia, putClipMedia } from "./media-store";
import { hidePanel } from "./panel-visibility";
import { pasteClipById } from "./paste";
import { setDesiredCursor } from "./win32-cursor";
import {
  createPinboard,
  getState,
  mergeClip,
  pinClipToBoard,
  removeClip,
  reorderClips,
  replaceClipsFromCloud,
  replacePinboardsFromCloud,
  setCaptureEnabled,
  setCompact,
  setPaused,
  subscribe,
  suppressCapture,
  updateClipBody,
  type DesktopState,
} from "./store";
import {
  HOST_BUILD,
  fitWindow,
  getWindowMode,
  moveWindowDrag,
  placeWindow,
  startWindowDrag,
  stopWindowDrag,
  type WindowMode,
} from "./window-layout";

const PORT = 47821;

function statePayload(s: DesktopState = getState()) {
  return { ...s, windowMode: getWindowMode(), hostBuild: HOST_BUILD };
}

export function startBridgeServer() {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (req.method === "OPTIONS") return new Response(null, { headers });

      if (url.pathname === "/health") {
        return Response.json(
          {
            ok: true,
            app: "ZeroPaste",
            hostBuild: HOST_BUILD,
            mode: getWindowMode(),
            platform: process.platform,
          },
          { headers },
        );
      }

      if (url.pathname === "/state" && req.method === "GET") {
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/window-mode" && req.method === "POST") {
        const body = (await req.json()) as { mode?: WindowMode };
        console.log("[ZeroPaste] POST /window-mode", body);
        if (body.mode === "panel" || body.mode === "vault") {
          placeWindow(body.mode);
          return Response.json({ ok: true, mode: body.mode, hostBuild: HOST_BUILD }, { headers });
        }
        return Response.json({ error: "invalid_mode" }, { status: 400, headers });
      }

      if (url.pathname === "/window-hide" && req.method === "POST") {
        hidePanel();
        return Response.json({ ok: true, hostBuild: HOST_BUILD }, { headers });
      }

      if (url.pathname === "/keyboard-focus" && req.method === "POST") {
        const body = (await req.json()) as { enabled?: boolean };
        if (body.enabled) await enableKeyboardFocus();
        else await disableKeyboardFocus();
        return Response.json({ ok: true, enabled: !!body.enabled, hostBuild: HOST_BUILD }, { headers });
      }

      if (url.pathname === "/cursor" && req.method === "POST") {
        const body = (await req.json()) as { cursor?: string };
        if (typeof body.cursor === "string") setDesiredCursor(body.cursor);
        return Response.json({ ok: true }, { headers });
      }

      if (url.pathname === "/clips-reorder" && req.method === "POST") {
        const body = (await req.json()) as { ids?: unknown };
        if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === "string")) {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        reorderClips(body.ids as string[]);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/window-fit" && req.method === "POST") {
        const body = (await req.json()) as {
          anchor?: string;
          width?: number;
          height?: number;
        };
        fitWindow({
          width: body.width ?? 1100,
          height: body.height ?? 320,
          anchor: body.anchor === "center" ? "center" : "bottom-center",
        });
        return Response.json({ ok: true, hostBuild: HOST_BUILD }, { headers });
      }

      if (url.pathname === "/window-drag" && req.method === "POST") {
        const body = (await req.json()) as {
          phase?: "start" | "move" | "stop";
          screenX?: number;
          screenY?: number;
        };
        if (body.phase === "start") {
          startWindowDrag(body.screenX, body.screenY);
          return Response.json({ ok: true }, { headers });
        }
        if (body.phase === "move") {
          moveWindowDrag(body.screenX ?? 0, body.screenY ?? 0);
          return Response.json({ ok: true }, { headers });
        }
        if (body.phase === "stop") {
          stopWindowDrag();
          return Response.json({ ok: true }, { headers });
        }
        return Response.json({ error: "invalid_drag" }, { status: 400, headers });
      }

      if (url.pathname === "/events" && req.method === "GET") {
        let unsub = () => {};
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            const send = (data: unknown) => {
              controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
            };
            send(statePayload());
            unsub = subscribe((s) => send(statePayload(s)));
          },
          cancel() {
            unsub();
          },
        });
        return new Response(stream, {
          headers: {
            ...headers,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      if (url.pathname.startsWith("/clip-media/") && req.method === "GET") {
        const id = url.pathname.slice("/clip-media/".length);
        const media = getClipMedia(id);
        if (!media) return new Response("Not found", { status: 404, headers });
        const normalized = normalizeClipboardImage(media.display);
        if (
          normalized.mimeType !== media.displayMime ||
          normalized.bytes.byteLength !== media.display.byteLength
        ) {
          putClipMedia(id, normalized.bytes, normalized.mimeType, media.paste);
        }
        return new Response(normalized.bytes, {
          headers: {
            ...headers,
            "Content-Type": normalized.mimeType,
            "Cache-Control": "no-store",
          },
        });
      }

      if (url.pathname === "/clip-update" && req.method === "POST") {
        const body = (await req.json()) as { id?: string; body?: string };
        if (!body.id || typeof body.body !== "string") {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        const ok = await updateClipBody(body.id, body.body);
        if (!ok) return Response.json({ error: "not_editable" }, { status: 400, headers });
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/paste" && req.method === "POST") {
        const body = (await req.json()) as { id?: string; plain?: boolean };
        if (!body.id) return Response.json({ error: "missing_id" }, { status: 400, headers });
        const result = await pasteClipById(body.id);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 400, headers });
        }
        return Response.json({ ok: true }, { headers });
      }

      if (url.pathname === "/drag-paste" && req.method === "POST") {
        const body = (await req.json()) as { id?: string; action?: "start" | "cancel" };
        if (body.action === "cancel") {
          cancelDragPaste();
          return Response.json({ ok: true }, { headers });
        }
        if (!body.id) return Response.json({ error: "missing_id" }, { status: 400, headers });
        const result = await runDragPaste(body.id);
        if (!result.ok) {
          return Response.json(
            { ok: false, error: result.error ?? "drag_failed" },
            { status: result.error === "cancelled" ? 200 : 400, headers },
          );
        }
        return Response.json({ ok: true }, { headers });
      }

      if (url.pathname === "/pause" && req.method === "POST") {
        const body = (await req.json()) as { durationMs?: number | null };
        setPaused(body.durationMs ?? null);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/compact" && req.method === "POST") {
        const body = (await req.json()) as { compact: boolean };
        setCompact(!!body.compact);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/delete" && req.method === "POST") {
        const body = (await req.json()) as { id: string };
        removeClip(body.id);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/capture-enabled" && req.method === "POST") {
        const body = (await req.json()) as { enabled?: boolean };
        setCaptureEnabled(!!body.enabled);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/suppress-capture" && req.method === "POST") {
        const body = (await req.json()) as { ms?: number };
        suppressCapture(body.ms ?? 5000);
        return Response.json({ ok: true }, { headers });
      }

      if (url.pathname === "/pinboard" && req.method === "POST") {
        const body = (await req.json()) as { name?: string; color?: string };
        const board = createPinboard(body.name ?? "Pinboard", body.color);
        return Response.json({ ok: true, board, ...statePayload() }, { headers });
      }

      if (url.pathname === "/pin-clip" && req.method === "POST") {
        const body = (await req.json()) as { clipId?: string; boardId?: string };
        if (!body.clipId || !body.boardId) {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        pinClipToBoard(body.clipId, body.boardId);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/clips-merge" && req.method === "POST") {
        const body = (await req.json()) as { clips?: unknown };
        if (!Array.isArray(body.clips)) {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        replaceClipsFromCloud(body.clips as Parameters<typeof replaceClipsFromCloud>[0]);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/clip-upsert" && req.method === "POST") {
        const body = (await req.json()) as { clip?: unknown };
        if (!body.clip || typeof body.clip !== "object") {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        mergeClip(body.clip as Parameters<typeof mergeClip>[0]);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/pinboards-merge" && req.method === "POST") {
        const body = (await req.json()) as { pinboards?: unknown };
        if (!Array.isArray(body.pinboards)) {
          return Response.json({ error: "invalid" }, { status: 400, headers });
        }
        replacePinboardsFromCloud(body.pinboards as Parameters<typeof replacePinboardsFromCloud>[0]);
        return Response.json(statePayload(), { headers });
      }

      if (url.pathname === "/autostart" && req.method === "GET") {
        const enabled = await isAutostartEnabled();
        return Response.json({ ok: true, enabled, platform: process.platform }, { headers });
      }

      if (url.pathname === "/autostart" && req.method === "POST") {
        const body = (await req.json()) as { enabled?: boolean };
        const ok = await setAutostartEnabled(Boolean(body.enabled));
        const enabled = await isAutostartEnabled();
        return Response.json({ ok, enabled }, { headers: { ...headers }, status: ok ? 200 : 500 });
      }

      return new Response("Not found", { status: 404, headers });
    },
  });

  void ensureDefaultAutostart();
  console.log(`[ZeroPaste] bridge http://127.0.0.1:${PORT} (${HOST_BUILD})`);
  return server;
}

export const BRIDGE_PORT = PORT;

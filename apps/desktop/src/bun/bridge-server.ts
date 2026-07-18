import { Utils } from "electrobun/bun";

import { getState, removeClip, setCompact, setPaused, subscribe } from "./store";
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
          { ok: true, app: "ZeroPaste", hostBuild: HOST_BUILD, mode: getWindowMode() },
          { headers },
        );
      }

      if (url.pathname === "/state" && req.method === "GET") {
        return Response.json(
          { ...getState(), windowMode: getWindowMode(), hostBuild: HOST_BUILD },
          { headers },
        );
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

      if (url.pathname === "/window-fit" && req.method === "POST") {
        const body = (await req.json()) as {
          anchor?: string;
          width?: number;
          height?: number;
        };
        console.log("[ZeroPaste] POST /window-fit", body);
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
          // Host uses OS cursor — web coords are ignored (HiDPI mismatch).
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
            send({ ...getState(), windowMode: getWindowMode(), hostBuild: HOST_BUILD });
            unsub = subscribe((s) =>
              send({ ...s, windowMode: getWindowMode(), hostBuild: HOST_BUILD }),
            );
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

      if (url.pathname === "/paste" && req.method === "POST") {
        const body = (await req.json()) as { id?: string; plain?: boolean };
        const clip = getState().clips.find((c) => c.id === body.id && !c.deletedAt);
        if (!clip) return Response.json({ error: "not_found" }, { status: 404, headers });
        const text = clip.kind === "image" ? clip.title : clip.body;
        Utils.clipboardWriteText(text);
        return Response.json({ ok: true }, { headers });
      }

      if (url.pathname === "/pause" && req.method === "POST") {
        const body = (await req.json()) as { durationMs?: number | null };
        setPaused(body.durationMs ?? null);
        return Response.json(getState(), { headers });
      }

      if (url.pathname === "/compact" && req.method === "POST") {
        const body = (await req.json()) as { compact: boolean };
        setCompact(!!body.compact);
        return Response.json(getState(), { headers });
      }

      if (url.pathname === "/delete" && req.method === "POST") {
        const body = (await req.json()) as { id: string };
        removeClip(body.id);
        return Response.json(getState(), { headers });
      }

      return new Response("Not found", { status: 404, headers });
    },
  });

  console.log(`[ZeroPaste] bridge http://127.0.0.1:${PORT} (${HOST_BUILD})`);
  return server;
}

export const BRIDGE_PORT = PORT;

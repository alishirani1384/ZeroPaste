"use client";

import { searchClips, type ClipItem } from "@paste/clipboard-core";
import { Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  FALLBACK_STATE,
  createPinboard,
  deleteClip,
  pasteClip,
  pauseCapture,
  pinClipToBoard,
  reorderClips,
  setDesktopKeyboardFocus,
  setDesktopWindowMode,
  subscribeBridge,
  suppressCapture,
  updateClipBody,
  type BridgeState,
} from "@/lib/bridge";
import { useVault } from "@/components/vault/vault-context";

import { ClipCard, ClipCardFace } from "./clip-card";
import { ClipContextMenu, type ClipMenuAction } from "./clip-context-menu";
import { NewPinboardPopover, type NewPinboardAnchor } from "./new-pinboard-popover";
import { PanelToolbar } from "./panel-toolbar";
import { QuickLook } from "./quick-look";
import { shelfSlots, useShelfReorder } from "./use-shelf-reorder";

type PinComposer = {
  anchor: NewPinboardAnchor;
  pinClipId?: string;
};

export function ClipboardPanel() {
  const vault = useVault();
  const [state, setState] = useState<BridgeState>(FALLBACK_STATE);
  const [activeBoard, setActiveBoard] = useState("history");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [quickLook, setQuickLook] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [pinComposer, setPinComposer] = useState<PinComposer | null>(null);
  /** Optimistic order so drop doesn't snap back while host persists. */
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [sorting, setSorting] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);
  const warnedHost = useRef<Set<string>>(new Set());

  useEffect(() => subscribeBridge(setState), []);

  useEffect(() => {
    for (const w of state.hostWarnings ?? []) {
      if (warnedHost.current.has(w)) continue;
      warnedHost.current.add(w);
      toast.error(w, { duration: 8000 });
    }
  }, [state.hostWarnings]);

  const paused = state.pausedUntil !== null && Date.now() < (state.pausedUntil ?? 0);

  const baseClips = useMemo(() => {
    return searchClips(state.clips, {
      query,
      boardId: activeBoard === "history" ? undefined : activeBoard,
      preserveOrder: true,
    });
  }, [state.clips, query, activeBoard]);

  const clips = useMemo(() => {
    if (!orderOverride) return baseClips;
    const byId = new Map(baseClips.map((c) => [c.id, c]));
    const ordered = orderOverride.map((id) => byId.get(id)).filter(Boolean) as ClipItem[];
    // Append any new clips not in override (e.g. just copied).
    for (const c of baseClips) {
      if (!orderOverride.includes(c.id)) ordered.unshift(c);
    }
    return ordered;
  }, [baseClips, orderOverride]);

  const clipIds = useMemo(() => clips.map((c) => c.id), [clips]);

  // Clear override once host state matches.
  useEffect(() => {
    if (!orderOverride) return;
    const hostIds = searchClips(state.clips, {
      query,
      boardId: activeBoard === "history" ? undefined : activeBoard,
      preserveOrder: true,
    }).map((c) => c.id);
    if (
      hostIds.length === orderOverride.length &&
      hostIds.every((id, i) => id === orderOverride[i])
    ) {
      setOrderOverride(null);
    }
  }, [state.clips, orderOverride, query, activeBoard]);

  useEffect(() => {
    if (!selectedId && clips[0]) setSelectedId(clips[0].id);
    if (selectedId && !clips.some((c) => c.id === selectedId)) {
      setSelectedId(clips[0]?.id ?? null);
    }
  }, [clips, selectedId]);

  const selectedIndex = clips.findIndex((c) => c.id === selectedId);
  const selected = clips.find((c) => c.id === selectedId) ?? null;

  const activate = useCallback(async (clip: ClipItem) => {
    const ae = document.activeElement;
    const typing =
      ae instanceof HTMLInputElement ||
      ae instanceof HTMLTextAreaElement ||
      (ae instanceof HTMLElement && ae.isContentEditable);
    if (ae instanceof HTMLElement) ae.blur();
    // Only round-trip keyboard-focus when search/typing stole OS focus.
    // Host paste already exits typing mode; awaiting NOACTIVATE here was a major delay.
    if (typing) void setDesktopKeyboardFocus(false);

    const result = await pasteClip(clip.id);
    if (!result.ok) {
      if (result.error === "paste_inject_failed") {
        toast.error("Paste failed — install xdotool (X11) or wtype/ydotool (Wayland)");
      } else if (result.error === "no_media") {
        toast.error("Image media missing — cannot paste");
      } else {
        toast.error(`Paste failed (${result.error ?? "unknown"})`);
      }
    }
  }, []);

  const createBoard = useCallback(async (name: string, color: string, pinClipId?: string) => {
    const board = await createPinboard(name, color);
    if (!board) {
      toast.error("Could not create pinboard");
      return;
    }
    if (pinClipId) {
      await pinClipToBoard(pinClipId, board.id);
      toast.success(`Pinned to “${board.name}”`);
    } else {
      toast.success(`Created “${board.name}”`);
    }
    setActiveBoard(board.id);
    setPinComposer(null);
  }, []);

  const openQuickLook = useCallback((id?: string) => {
    if (id) setSelectedId(id);
    setQuickLook(true);
  }, []);

  const copyClip = useCallback(async (clip: ClipItem) => {
    await suppressCapture(4000);
    try {
      if (clip.kind === "image") {
        const src = clip.body || clip.preview;
        if (!src) throw new Error("No image data");
        const res = await fetch(src);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || "image/png"]: blob }),
        ]);
      } else {
        await navigator.clipboard.writeText(clip.body);
      }
      toast.success("Copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const onMenuAction = useCallback(
    async (clip: ClipItem, action: ClipMenuAction) => {
      if (action === "preview") {
        openQuickLook(clip.id);
        return;
      }
      if (action === "paste") {
        await activate(clip);
        return;
      }
      if (action === "pastePlain") {
        const result = await pasteClip(clip.id, true);
        if (!result.ok) toast.error(`Paste failed (${result.error ?? "unknown"})`);
        return;
      }
      if (action === "copy") {
        await copyClip(clip);
        return;
      }
      if (action === "delete") {
        await deleteClip(clip.id);
        toast.message("Deleted");
        return;
      }
      if (action === "newPinboard") {
        setPinComposer({
          anchor: { kind: "point", x: menu?.x ?? 40, y: menu?.y ?? 40 },
          pinClipId: clip.id,
        });
        return;
      }
      if (typeof action === "object" && "pin" in action) {
        if (clip.pinnedBoardIds.includes(action.pin)) return;
        await pinClipToBoard(clip.id, action.pin);
        const board = state.pinboards.find((b) => b.id === action.pin);
        toast.success(board ? `Pinned to ${board.name}` : "Pinned");
      }
    },
    [activate, copyClip, menu?.x, menu?.y, openQuickLook, state.pinboards],
  );

  const onReorder = useCallback((nextIds: string[]) => {
    setOrderOverride(nextIds);
    void reorderClips(nextIds);
  }, []);

  const { drag, onPointerDown } = useShelfReorder({
    ids: clipIds,
    scrollerRef,
    onReorder,
    onDragActiveChange: setSorting,
    onClickItem: (id) => {
      const clip = clips.find((c) => c.id === id);
      if (!clip) return;
      setSelectedId(id);
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae.closest("input, textarea")) ae.blur();
      void activate(clip);
    },
  });

  const dragClip = drag ? (clips.find((c) => c.id === drag.id) ?? null) : null;
  const slots = useMemo(() => shelfSlots(clipIds, drag), [clipIds, drag]);
  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);

  const menuClip = menu ? (state.clips.find((c) => c.id === menu.clipId) ?? null) : null;
  const composerPinClip = pinComposer?.pinClipId
    ? (state.clips.find((c) => c.id === pinComposer.pinClipId) ?? null)
    : null;
  const activeBoardMeta = state.pinboards.find((b) => b.id === activeBoard);
  const viewingCustomBoard = activeBoard !== "history";
  const isCompact = compact || state.compact;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || didInitScroll.current || clips.length === 0) return;
    el.scrollLeft = 0;
    didInitScroll.current = true;
  }, [clips.length]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (quickLook || menu || sorting) return;
      const el = scrollerRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 2) return;
      const target = e.target;
      if (target instanceof Element) {
        if (target.closest("input, textarea, .zp-ql, .zp-ctx, .zp-pin-pop")) return;
      }
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      el.scrollLeft += dx;
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [quickLook, menu, clips.length, sorting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          if (quickLook) {
            e.preventDefault();
            setQuickLook(false);
          } else {
            (e.target as HTMLElement).blur();
          }
        }
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        if (selected) setQuickLook((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (menu) {
          e.preventDefault();
          setMenu(null);
          return;
        }
        if (quickLook) {
          e.preventDefault();
          setQuickLook(false);
          return;
        }
      }

      if (quickLook || menu || sorting) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = clips[Math.min(selectedIndex + 1, clips.length - 1)];
        if (next) {
          setSelectedId(next.id);
          scrollerRef.current
            ?.querySelector<HTMLElement>(`[aria-selected="true"]`)
            ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = clips[Math.max(selectedIndex - 1, 0)];
        if (prev) {
          setSelectedId(prev.id);
          requestAnimationFrame(() => {
            scrollerRef.current
              ?.querySelector<HTMLElement>(`[aria-selected="true"]`)
              ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
          });
        }
      }
      if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        const clip = clips.find((c) => c.id === selectedId);
        if (clip) void activate(clip);
      }
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void setDesktopKeyboardFocus(true).then(() => {
          document.querySelector<HTMLInputElement>(".zp-search input")?.focus();
        });
      }
      if (/^[1-9]$/.test(e.key) && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const clip = clips[Number(e.key) - 1];
        if (clip) void activate(clip);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activate, clips, selectedId, selectedIndex, quickLook, selected, menu, sorting]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setCompact(h < 240);
    });
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void setDesktopWindowMode("panel"), 100);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      ref={panelRef}
      className="zp-panel"
      onMouseDown={(e) => {
        const t = e.target;
        if (
          t instanceof HTMLElement &&
          t.closest("input, textarea, button, a, label.zp-search, [contenteditable='true']")
        ) {
          return;
        }
        e.preventDefault();
      }}
    >
      <div className="zp-resize-hint" aria-hidden />
      <PanelToolbar
        boards={state.pinboards}
        activeBoard={activeBoard}
        query={query}
        paused={paused}
        onBoardChange={setActiveBoard}
        onQueryChange={setQuery}
        onTogglePause={() => void pauseCapture(paused ? null : 5 * 60_000)}
        onLock={() => vault.lock()}
        onNewBoard={(rect) => setPinComposer({ anchor: { kind: "element", rect } })}
        onSearchFocus={() => void setDesktopKeyboardFocus(true)}
        onSearchBlur={() => void setDesktopKeyboardFocus(false)}
      />

      <div
        ref={scrollerRef}
        className={sorting ? "zp-timeline zp-timeline--sorting" : "zp-timeline"}
        role="listbox"
        aria-label="Clipboard history"
      >
        {clips.length === 0 ? (
          <div className="zp-empty">
            <p className="zp-empty-title">
              {viewingCustomBoard
                ? `No pins in ${activeBoardMeta?.name ?? "this board"}`
                : "Nothing here yet"}
            </p>
            <p className="zp-empty-body">
              {viewingCustomBoard
                ? "Right-click any clip in History and choose Pin to, or create a board from New."
                : "Copy text, links, code, or images — ZeroPaste keeps a searchable history with source and time."}
            </p>
          </div>
        ) : (
          slots.map((slot, i) => {
            if (slot.type === "gap" && drag) {
              return (
                <div
                  key={`gap-${i}`}
                  data-shelf-slot="gap"
                  className="zp-drop-gap"
                  style={{ width: drag.width, height: drag.height }}
                  aria-hidden
                />
              );
            }
            if (slot.type !== "item") return null;
            const clip = byId.get(slot.id);
            if (!clip) return null;
            return (
              <ClipCard
                key={clip.id}
                clip={clip}
                index={slot.index}
                selected={clip.id === selectedId}
                compact={isCompact}
                sorting={sorting}
                onPointerDown={onPointerDown}
                onSelect={() => setSelectedId(clip.id)}
                onContextMenu={(x, y) => setMenu({ x, y, clipId: clip.id })}
              />
            );
          })
        )}
      </div>

      {drag && dragClip
        ? createPortal(
            <div
              className={[
                "zp-card zp-card--floating flex flex-col",
                isCompact ? "h-[148px] w-[132px]" : "h-[220px] w-[200px]",
              ].join(" ")}
              style={{
                width: drag.width,
                height: drag.height,
                transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
              }}
            >
              <ClipCardFace clip={dragClip} index={0} compact={isCompact} showIndex={false} />
            </div>,
            document.body,
          )
        : null}

      <footer className="zp-footer">
        <span className="inline-flex items-center gap-2">
          <Lock className="size-3 opacity-50" />
          Vault unlocked · {clips.length} item{clips.length === 1 ? "" : "s"}
          {paused ? " · Capture paused" : ""}
        </span>
        <span className="zp-footer-hints">
          {sorting ? (
            <span className="zp-drag-hint">Drop to place</span>
          ) : (
            <>Click to paste · drag to reorder · right-click for menu</>
          )}
        </span>
      </footer>

      {menu && menuClip ? (
        <ClipContextMenu
          x={menu.x}
          y={menu.y}
          clip={menuClip}
          boards={state.pinboards}
          onClose={() => setMenu(null)}
          onAction={(action) => void onMenuAction(menuClip, action)}
        />
      ) : null}

      {pinComposer ? (
        <NewPinboardPopover
          anchor={pinComposer.anchor}
          pinClipTitle={composerPinClip?.title ?? null}
          onClose={() => setPinComposer(null)}
          onCreate={(name, color) => createBoard(name, color, pinComposer.pinClipId)}
        />
      ) : null}

      {quickLook && selected ? (
        <QuickLook
          clip={selected}
          onClose={() => setQuickLook(false)}
          onSave={async (body) => {
            const ok = await updateClipBody(selected.id, body);
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}

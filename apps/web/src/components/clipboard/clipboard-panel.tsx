"use client";

import { searchClips, type ClipItem } from "@paste/clipboard-core";
import { Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FALLBACK_STATE,
  pasteClip,
  pauseCapture,
  setDesktopWindowMode,
  subscribeBridge,
  updateClipBody,
  type BridgeState,
} from "@/lib/bridge";
import { useVault } from "@/components/vault/vault-context";

import { ClipCard } from "./clip-card";
import { PanelToolbar } from "./panel-toolbar";
import { QuickLook } from "./quick-look";

export function ClipboardPanel() {
  const vault = useVault();
  const [state, setState] = useState<BridgeState>(FALLBACK_STATE);
  const [activeBoard, setActiveBoard] = useState("history");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [quickLook, setQuickLook] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);

  useEffect(() => subscribeBridge(setState), []);

  const paused = state.pausedUntil !== null && Date.now() < state.pausedUntil;

  const clips = useMemo(() => {
    return searchClips(state.clips, {
      query,
      boardId: activeBoard === "history" ? undefined : activeBoard,
    });
  }, [state.clips, query, activeBoard]);

  useEffect(() => {
    if (!selectedId && clips[0]) setSelectedId(clips[0].id);
    if (selectedId && !clips.some((c) => c.id === selectedId)) {
      setSelectedId(clips[0]?.id ?? null);
    }
  }, [clips, selectedId]);

  const selectedIndex = clips.findIndex((c) => c.id === selectedId);
  const selected = clips.find((c) => c.id === selectedId) ?? null;

  const activate = useCallback(async (clip: ClipItem) => {
    await pasteClip(clip.id);
  }, []);

  const openQuickLook = useCallback((id?: string) => {
    if (id) setSelectedId(id);
    setQuickLook(true);
  }, []);

  // Start at the left (#1) — do not scrollIntoView on boot (that centered the shelf).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || didInitScroll.current || clips.length === 0) return;
    el.scrollLeft = 0;
    didInitScroll.current = true;
  }, [clips.length]);

  // CEF often delivers wheel to the window, not the overflow element — capture globally.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (quickLook) return;
      const el = scrollerRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 2) return;
      const target = e.target;
      if (target instanceof Element) {
        if (target.closest("input, textarea, .zp-ql")) return;
      }
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      el.scrollLeft += dx;
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [quickLook, clips.length]);

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

      if (e.key === " " ) {
        e.preventDefault();
        if (selected) setQuickLook((v) => !v);
        return;
      }
      if (e.key === "Escape" && quickLook) {
        e.preventDefault();
        setQuickLook(false);
        return;
      }

      if (quickLook) return;

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
        document.querySelector<HTMLInputElement>(".zp-search input")?.focus();
      }
      if (/^[1-9]$/.test(e.key) && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const clip = clips[Number(e.key) - 1];
        if (clip) void activate(clip);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activate, clips, selectedId, selectedIndex, quickLook, selected]);

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
        // Keep OS caret in the target app — don't focus shelf chrome on click.
        const t = e.target;
        if (
          t instanceof HTMLElement &&
          t.closest("input, textarea, button, a, [contenteditable='true']")
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
      />

      <div ref={scrollerRef} className="zp-timeline" role="listbox" aria-label="Clipboard history">
        {clips.length === 0 ? (
          <div className="zp-empty">
            <p className="zp-empty-title">Nothing here yet</p>
            <p className="zp-empty-body">
              Copy text, links, code, or images — ZeroPaste keeps a searchable history with source and
              time metadata.
            </p>
          </div>
        ) : (
          clips.map((clip, i) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              index={i}
              selected={clip.id === selectedId}
              compact={compact || state.compact}
              onSelect={() => setSelectedId(clip.id)}
              onPaste={() => void activate(clip)}
              onQuickLook={() => openQuickLook(clip.id)}
              onDraggingChange={setDragActive}
            />
          ))
        )}
      </div>

      <footer className="zp-footer">
        <span className="inline-flex items-center gap-2">
          <Lock className="size-3 opacity-50" />
          Vault unlocked · {clips.length} item{clips.length === 1 ? "" : "s"}
          {paused ? " · Capture paused" : ""}
        </span>
        <span className="zp-footer-hints">
          {dragActive ? (
            <span className="zp-drag-hint">Release to paste into the app under the caret</span>
          ) : (
            <>
              Click to paste · drag &amp; release to paste · <kbd>Space</kbd> Quick Look
            </>
          )}
        </span>
      </footer>

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

"use client";

import type { Pinboard } from "@paste/clipboard-core";
import { Cloud, CloudOff, GripHorizontal, Loader2, Plus, RefreshCw, Search, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { WindowCloseButton } from "@/components/window-close-button";
import { useSyncStatus } from "@/components/vault/sync-status";
import { useAuth } from "@/lib/auth-session";
import { setDesktopKeyboardFocus } from "@/lib/bridge";
import { windowDragHandlers } from "@/lib/window-drag";

import { SyncStatusPopover } from "./sync-status-popover";

type Props = {
  boards: Pinboard[];
  activeBoard: string;
  query: string;
  onBoardChange: (id: string) => void;
  onQueryChange: (q: string) => void;
  onNewBoard?: (anchorRect: DOMRect) => void;
  onOpenAccount?: () => void;
  onBoardContextMenu?: (board: Pinboard, clientX: number, clientY: number) => void;
};

export function PanelToolbar({
  boards,
  activeBoard,
  query,
  onBoardChange,
  onQueryChange,
  onNewBoard,
  onOpenAccount,
  onBoardContextMenu,
}: Props) {
  const drag = useMemo(() => windowDragHandlers(), []);
  const auth = useAuth();
  const { phase, detail, refreshFromCloud } = useSyncStatus();
  const signedIn = Boolean(auth.session);
  const offline = auth.offlineChosen || !auth.configured;
  const pulling = phase === "pulling";
  const canRefresh = signedIn && !offline && auth.configured;
  const addRef = useRef<HTMLButtonElement>(null);
  const cloudRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  /** Host is clearing NOACTIVATE / activating — ignore blur from that dance. */
  const armingRef = useRef(false);
  /** Host already in typing mode; skip re-activate loops from our own refocus. */
  const typingRef = useRef(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncAnchor, setSyncAnchor] = useState<DOMRect | null>(null);
  const customBoards = boards.filter((b) => b.id !== "history");

  const cloudTitle = pulling
    ? (detail ?? "Restoring from cloud…")
    : phase === "error"
      ? (detail ?? "Cloud sync error")
      : phase === "synced"
        ? (detail ?? "Everything synced")
        : signedIn
          ? "Cloud sync status"
          : offline
            ? "Sync off — this device only"
            : "Not signed in";

  const focusSearch = () => {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    if (armingRef.current || typingRef.current) return;
    armingRef.current = true;
    void setDesktopKeyboardFocus(true)
      .then(() => {
        typingRef.current = true;
        // Host activate() can bounce DOM focus — put it back on the input.
        searchRef.current?.focus({ preventScroll: true });
      })
      .finally(() => {
        armingRef.current = false;
      });
  };

  const blurSearch = () => {
    if (armingRef.current) return;
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => {
      blurTimer.current = null;
      if (armingRef.current) return;
      const el = searchRef.current;
      if (el && document.activeElement === el) return;
      if (el?.closest(".zp-search")?.contains(document.activeElement)) return;
      typingRef.current = false;
      void setDesktopKeyboardFocus(false);
    }, 400);
  };

  return (
    <header className="zp-toolbar">
      <div className="zp-drag-strip" title="Drag to move" {...drag}>
        <GripHorizontal className="size-3.5 opacity-45" />
      </div>

      <nav className="zp-boards" aria-label="Pinboards">
        <button
          type="button"
          className={activeBoard === "history" ? "zp-board zp-board--active" : "zp-board"}
          onClick={() => onBoardChange("history")}
        >
          History
        </button>
        {customBoards.map((b) => (
          <button
            key={b.id}
            type="button"
            className={activeBoard === b.id ? "zp-board zp-board--active" : "zp-board"}
            onClick={() => onBoardChange(b.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBoardContextMenu?.(b, e.clientX, e.clientY);
            }}
          >
            <span className="zp-board-dot" style={{ background: b.color }} />
            {b.name}
          </button>
        ))}
        <button
          ref={addRef}
          type="button"
          className="zp-board zp-board--add"
          aria-label="New pinboard"
          title="New pinboard"
          onClick={() => {
            const rect = addRef.current?.getBoundingClientRect();
            if (rect) onNewBoard?.(rect);
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          <span>New</span>
        </button>
      </nav>

      <div className="zp-toolbar-actions">
        <label className="zp-search">
          <Search className="size-3.5 opacity-50" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search"
            spellCheck={false}
            onMouseDown={(e) => {
              e.stopPropagation();
              focusSearch();
            }}
            onFocus={focusSearch}
            onBlur={blurSearch}
          />
        </label>
        <button
          type="button"
          className="zp-icon-btn"
          title={
            canRefresh
              ? pulling
                ? "Refreshing from cloud…"
                : "Refresh from cloud"
              : "Sign in to refresh from cloud"
          }
          aria-label="Refresh from cloud"
          disabled={!canRefresh || pulling}
          onClick={() => void refreshFromCloud()}
        >
          <RefreshCw className={`size-4${pulling ? " animate-spin" : ""}`} aria-hidden />
        </button>
        <button
          ref={cloudRef}
          type="button"
          className="zp-icon-btn"
          title={cloudTitle}
          aria-label="Cloud sync status"
          aria-expanded={syncOpen}
          onClick={() => {
            const rect = cloudRef.current?.getBoundingClientRect();
            if (rect) setSyncAnchor(rect);
            setSyncOpen((v) => !v);
          }}
        >
          {pulling ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : phase === "synced" ? (
            <Cloud className="size-4 text-emerald-400" />
          ) : signedIn ? (
            <Cloud className={`size-4${phase === "error" ? " text-red-400" : ""}`} />
          ) : (
            <CloudOff className="size-4 opacity-70" />
          )}
        </button>
        <button
          type="button"
          className="zp-icon-btn"
          title="Account"
          aria-label="Account"
          onClick={() => onOpenAccount?.()}
        >
          <User className="size-4" />
        </button>
        <WindowCloseButton className="zp-icon-btn" title="Close" />
      </div>

      {syncOpen && syncAnchor ? (
        <SyncStatusPopover
          anchorRect={syncAnchor}
          onClose={() => {
            setSyncOpen(false);
            setSyncAnchor(null);
          }}
        />
      ) : null}
    </header>
  );
}

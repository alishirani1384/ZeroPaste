"use client";

import type { Pinboard } from "@paste/clipboard-core";
import {
  Cloud,
  CloudOff,
  GripHorizontal,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef } from "react";

import { WindowCloseButton } from "@/components/window-close-button";
import { useSyncStatus } from "@/components/vault/sync-status";
import { useAuth } from "@/lib/auth-session";
import { windowDragHandlers } from "@/lib/window-drag";

type Props = {
  boards: Pinboard[];
  activeBoard: string;
  query: string;
  paused: boolean;
  onBoardChange: (id: string) => void;
  onQueryChange: (q: string) => void;
  onTogglePause: () => void;
  onLock?: () => void;
  onNewBoard?: (anchorRect: DOMRect) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
};

export function PanelToolbar({
  boards,
  activeBoard,
  query,
  paused,
  onBoardChange,
  onQueryChange,
  onTogglePause,
  onLock,
  onNewBoard,
  onSearchFocus,
  onSearchBlur,
}: Props) {
  const drag = useMemo(() => windowDragHandlers(), []);
  const auth = useAuth();
  const { phase, detail } = useSyncStatus();
  const signedIn = Boolean(auth.session);
  const offline = auth.offlineChosen || !auth.configured;
  const pulling = phase === "pulling";
  const cloudTitle = pulling
    ? (detail ?? "Restoring from cloud…")
    : phase === "error"
      ? (detail ?? "Cloud sync error")
      : phase === "synced"
        ? (detail ?? "Cloud sync ready")
        : signedIn
          ? `Signed in as ${auth.session?.user.email ?? "account"}`
          : offline
            ? "Account — offline / sync off"
            : "Sign in for cloud sync";
  const addRef = useRef<HTMLButtonElement>(null);
  const customBoards = boards.filter((b) => b.id !== "history");

  return (
    <header className="zp-toolbar">
      <div className="zp-drag-strip" title="Drag to move" {...drag}>
        <GripHorizontal className="size-3.5 opacity-45" />
      </div>

      <div className="zp-brand" {...drag}>
        <span className="zp-brand-mark" aria-hidden />
        <span className="zp-brand-name">ZeroPaste</span>
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
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search titles, content, apps…"
            spellCheck={false}
            onMouseDown={(e) => {
              // Clear NOACTIVATE before this click finishes so the input can type.
              e.stopPropagation();
              onSearchFocus?.();
            }}
            onFocus={() => onSearchFocus?.()}
            onBlur={() => onSearchBlur?.()}
          />
        </label>
        <Link
          href="/account"
          className="zp-icon-btn"
          title={cloudTitle}
          aria-label={pulling ? "Restoring from cloud" : "Account and sync"}
        >
          {pulling ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : signedIn ? (
            <Cloud className={`size-4${phase === "error" ? " text-red-400" : ""}`} />
          ) : (
            <CloudOff className="size-4 opacity-70" />
          )}
        </Link>
        <Link href="/account" className="zp-icon-btn" title="Account" aria-label="Account">
          <User className="size-4" />
        </Link>
        <button
          type="button"
          className="zp-icon-btn"
          onClick={onTogglePause}
          title={paused ? "Resume capture" : "Pause capture"}
          aria-pressed={paused}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        {onLock ? (
          <button
            type="button"
            className="zp-icon-btn"
            title="Lock vault"
            aria-label="Lock vault"
            onClick={onLock}
          >
            <Lock className="size-4" />
          </button>
        ) : null}
        <WindowCloseButton className="zp-icon-btn" title="Close" />
      </div>
    </header>
  );
}

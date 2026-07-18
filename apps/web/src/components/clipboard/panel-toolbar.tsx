"use client";

import type { Pinboard } from "@paste/clipboard-core";
import { GripHorizontal, Lock, Pause, Play, Plus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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
}: Props) {
  const drag = useMemo(() => windowDragHandlers(), []);

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
        {boards.map((b) => (
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
        <button type="button" className="zp-board zp-board--ghost" aria-label="New pinboard">
          <Plus className="size-3.5" />
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
          />
        </label>
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
        <Link href="/account" className="zp-icon-btn" title="Account & sync" aria-label="Account">
          <Settings2 className="size-4" />
        </Link>
      </div>
    </header>
  );
}

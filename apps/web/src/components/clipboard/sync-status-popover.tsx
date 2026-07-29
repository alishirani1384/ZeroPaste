"use client";

import { CheckCircle2, Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useSyncStatus } from "@/components/vault/sync-status";
import { useAuth } from "@/lib/auth-session";

type Props = {
  anchorRect: DOMRect;
  onClose: () => void;
};

export function SyncStatusPopover({ anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const { phase, detail } = useSyncStatus();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const left = Math.min(anchorRect.right - 240, window.innerWidth - 248);
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 160);

  let title = "Cloud sync";
  let body = detail ?? "Idle";
  let Icon = Cloud;
  let tone: "ok" | "warn" | "err" | "busy" | "mute" = "mute";

  if (phase === "pulling") {
    title = "Restoring in background";
    body = detail ?? "Newest clips appear first — you can keep using ZeroPaste.";
    Icon = Loader2;
    tone = "busy";
  } else if (phase === "synced") {
    title = "Everything synced";
    body = detail ?? "Your shelf matches the cloud. New clips upload automatically.";
    Icon = CheckCircle2;
    tone = "ok";
  } else if (phase === "error") {
    title = "Sync error";
    body = detail ?? "Could not reach the cloud. Clips stay on this device.";
    Icon = TriangleAlert;
    tone = "err";
  } else if (phase === "offline" || auth.offlineChosen || !auth.configured) {
    title = "On this device";
    body = "Cloud sync is off. Sign in from Account to sync across devices.";
    Icon = CloudOff;
    tone = "warn";
  } else if (phase === "unsigned" || !auth.session) {
    title = "Not signed in";
    body = "Clips stay local until you sign in.";
    Icon = CloudOff;
    tone = "warn";
  } else if (phase === "idle") {
    title = "Ready";
    body = detail ?? "Waiting for the next sync.";
    Icon = Cloud;
    tone = "mute";
  }

  return createPortal(
    <div
      ref={ref}
      className={`zp-sync-pop zp-sync-pop--${tone}`}
      role="dialog"
      aria-label="Cloud sync status"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      <div className="zp-sync-pop-icon">
        <Icon className={`size-5${phase === "pulling" ? " animate-spin" : ""}`} aria-hidden />
      </div>
      <div className="zp-sync-pop-copy">
        <strong>{title}</strong>
        <p>{body}</p>
        {auth.session?.user.email ? (
          <span className="zp-sync-pop-meta">{auth.session.user.email}</span>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

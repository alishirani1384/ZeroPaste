"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { AuthPanel } from "@/components/vault/auth-panel";
import { useDesktopWindowFit } from "@/components/desktop-window-fit";
import { fitDesktopWindow } from "@/lib/bridge";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * In-shelf account sheet — expands the host window so the form is usable.
 * Vault mode clears NOACTIVATE via Win32 FFI (no PowerShell / keyboard-focus dance).
 */
export function AccountSheet({ open, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useDesktopWindowFit(sheetRef, "vault", open, open ? "account" : "closed");

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const el = sheetRef.current;
      if (!el) {
        void fitDesktopWindow({ width: 400, height: 520, anchor: "center" });
        return;
      }
      const rect = el.getBoundingClientRect();
      void fitDesktopWindow({
        width: Math.max(380, Math.ceil(rect.width)),
        height: Math.max(420, Math.ceil(rect.height)),
        anchor: "center",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="zp-account-root">
      <div className="zp-account-sheet" ref={sheetRef}>
        <header className="zp-account-chrome">
          <span>Account</span>
          <button
            type="button"
            className="zp-account-close"
            title="Close"
            aria-label="Close account"
            onClick={onClose}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </header>
        <div className="zp-account-body">
          <AuthPanel />
        </div>
      </div>
    </div>
  );
}

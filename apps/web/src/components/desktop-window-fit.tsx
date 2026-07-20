"use client";

import { useEffect, type RefObject } from "react";

import type { DesktopWindowMode } from "@/lib/bridge";
import { anchorForMode, observeDesktopFit } from "@/lib/window-fit";

/**
 * Resize the desktop host window to match `targetRef` whenever the UI box changes.
 * Pass `revision` when the observed node is swapped (e.g. onboarding step changes).
 */
export function useDesktopWindowFit(
  targetRef: RefObject<HTMLElement | null>,
  mode: DesktopWindowMode,
  enabled = true,
  revision: string | number = 0,
) {
  useEffect(() => {
    if (!enabled) return;

    let stop = () => {};
    const boot = window.setTimeout(() => {
      stop = observeDesktopFit(targetRef.current, anchorForMode(mode));
    }, 0);

    return () => {
      window.clearTimeout(boot);
      stop();
    };
  }, [targetRef, mode, enabled, revision]);
}

"use client";

import { useEffect, useState } from "react";

import { getLinkPreview, type LinkPreview } from "@/lib/link-preview";

export function useLinkPreview(url: string | undefined, enabled: boolean) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !url) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getLinkPreview(url).then((p) => {
      if (!cancelled) {
        setPreview(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, url]);

  return { preview, loading };
}

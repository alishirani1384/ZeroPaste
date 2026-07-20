import { useEffect, useState } from "react";
import { Image } from "react-native";

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

export function useImageSize(uri: string | undefined, known?: { w?: number; h?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(
    known?.w && known?.h ? { w: known.w, h: known.h } : null,
  );

  useEffect(() => {
    if (known?.w && known?.h) {
      setSize({ w: known.w, h: known.h });
      return;
    }
    if (!uri || uri.startsWith("data:")) {
      setSize(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setSize({ w, h });
      },
      () => {
        if (!cancelled) setSize(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri, known?.w, known?.h]);

  return size;
}

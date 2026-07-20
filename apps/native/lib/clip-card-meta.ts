/** Paste-style kind chrome for clip cards. */
export const KIND_CHROME: Record<
  string,
  { label: string; header: string }
> = {
  link: { label: "Link", header: "#007AFF" },
  text: { label: "Text", header: "#F5BC00" },
  image: { label: "Image", header: "#FF3B30" },
  code: { label: "Code", header: "#30D158" },
  color: { label: "Color", header: "#AF52DE" },
  file: { label: "File", header: "#8E8E93" },
  other: { label: "Clip", header: "#8E8E93" },
};

export function kindChrome(kind: string) {
  return KIND_CHROME[kind] ?? KIND_CHROME.other;
}

/** Display path under link title: host + pathname (no protocol). */
export function linkPathLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, "").slice(0, 48);
  }
}

export function characterCountLabel(text: string): string {
  const n = [...text].length;
  return `${n.toLocaleString()} character${n === 1 ? "" : "s"}`;
}

export function imageSizeLabel(w?: number | null, h?: number | null): string | null {
  if (!w || !h) return null;
  return `${w} × ${h}`;
}

/** Paste-style relative time: "3 minutes ago", "2 hours ago". */
export function pasteRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 45) return "Just now";
  if (sec < 3600) {
    const m = Math.max(1, Math.round(sec / 60));
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (sec < 86_400) {
    const h = Math.max(1, Math.round(sec / 3600));
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (sec < 86_400 * 7) {
    const d = Math.max(1, Math.round(sec / 86_400));
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(then);
}

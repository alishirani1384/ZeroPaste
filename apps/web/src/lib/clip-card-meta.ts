/** Paste-style kind chrome for clip cards (matches native). */
export const KIND_CHROME: Record<string, { label: string; header: string }> = {
  link: { label: "Link", header: "#007AFF" },
  text: { label: "Text", header: "#F5BC00" },
  image: { label: "Image", header: "#FF3B30" },
  code: { label: "Code", header: "#30D158" },
  color: { label: "Color", header: "#AF52DE" },
  file: { label: "File", header: "#8E8E93" },
  other: { label: "Clip", header: "#8E8E93" },
};

export function kindChrome(kind: string) {
  return KIND_CHROME[kind] ?? KIND_CHROME.other!;
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

export function detectCodeLanguage(
  code: string,
  explicit?: string | null,
): { id: string; label: string } {
  const fromExplicit = explicit?.trim().toLowerCase();
  if (fromExplicit) {
    const map: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      rs: "rust",
      sh: "bash",
      shell: "bash",
      html: "xml",
      c: "cpp",
      "c++": "cpp",
    };
    const id = map[fromExplicit] ?? fromExplicit;
    const labels: Record<string, string> = {
      javascript: "JavaScript",
      typescript: "TypeScript",
      python: "Python",
      rust: "Rust",
      sql: "SQL",
      go: "Go",
      php: "PHP",
      cpp: "C / C++",
      java: "Java",
      kotlin: "Kotlin",
      json: "JSON",
      xml: "HTML / XML",
      css: "CSS",
      bash: "Shell",
      plaintext: "Snippet",
    };
    return { id, label: labels[id] ?? explicit!.trim() };
  }

  if (/^\s*import\s+.+\s+from\s+['"]/.test(code) || /:\s*(string|number|boolean|React\.|FC<)/.test(code)) {
    return { id: "typescript", label: "TypeScript" };
  }
  if (/^\s*(def |async def |from .+ import |class .+:)/.test(code) || /\bself\b/.test(code)) {
    return { id: "python", label: "Python" };
  }
  if (/^\s*(fn |use |pub |mod |impl |let mut )/.test(code)) {
    return { id: "rust", label: "Rust" };
  }
  if (/^\s*(SELECT |INSERT |UPDATE |DELETE |CREATE TABLE)/i.test(code)) {
    return { id: "sql", label: "SQL" };
  }
  if (/^\s*(package |func |import \()/.test(code)) {
    return { id: "go", label: "Go" };
  }
  if (/function |const |let |=>|console\./.test(code)) {
    return { id: "javascript", label: "JavaScript" };
  }
  if (/^\s*{[\s\S]*}\s*$/.test(code.trim()) && /"[^"]+"\s*:/.test(code)) {
    return { id: "json", label: "JSON" };
  }
  if (/^\s*<[!?]?[a-zA-Z]/.test(code)) {
    return { id: "xml", label: "HTML / XML" };
  }
  return { id: "plaintext", label: "Snippet" };
}

export const TYPE_ICON_SRC: Record<string, string> = {
  link: "/type/link.jpg",
  text: "/type/text.jpg",
  image: "/type/image.jpg",
  code: "/type/code.jpg",
  color: "/type/color.jpg",
  file: "/type/text.jpg",
  other: "/type/text.jpg",
};

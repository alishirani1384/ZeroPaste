import type { ClipKind } from "./types";

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CODE_HINTS =
  /^(import |export |const |let |var |function |class |def |fn |package |using |#include |<\?php|SELECT |CREATE TABLE)/m;

export function classifyText(text: string): ClipKind {
  const trimmed = text.trim();
  if (!trimmed) return "other";
  if (COLOR_RE.test(trimmed) || /^rgba?\(|hsla?\(/i.test(trimmed)) return "color";
  if (URL_RE.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return "link";
  if (
    CODE_HINTS.test(trimmed) ||
    (trimmed.includes("\n") && /[{};()[\]]/.test(trimmed) && trimmed.length > 40)
  ) {
    return "code";
  }
  return "text";
}

export function titleFromContent(kind: ClipKind, body: string): string {
  const line = body.trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (kind === "link") {
    try {
      const url = new URL(line.startsWith("http") ? line : `https://${line}`);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return line.slice(0, 48) || "Link";
    }
  }
  if (kind === "color") return line.toUpperCase();
  if (kind === "code") return line.slice(0, 56) || "Code snippet";
  if (kind === "image") return "Image";
  return line.slice(0, 72) || "Text";
}

export function previewFromContent(kind: ClipKind, body: string): string {
  if (kind === "image") return body;
  const trimmed = body.trim();
  if (kind === "link") return trimmed;
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
}

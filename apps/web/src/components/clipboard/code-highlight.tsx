"use client";

import { useMemo } from "react";

import { detectCodeLanguage } from "@/lib/clip-card-meta";
import { highlightToLines } from "@/lib/syntax-lines";
import { SYNTAX_CANVAS, SYNTAX_FG } from "@/lib/syntax-theme";

type Props = {
  code: string;
  language?: string | null;
  /** Omit or pass null for no line limit (Quick Look). */
  maxLines?: number | null;
  className?: string;
};

export function CodeHighlight({ code, language, maxLines = 9, className }: Props) {
  const detected = useMemo(() => detectCodeLanguage(code, language), [code, language]);
  const lines = useMemo(() => {
    const all = highlightToLines(code, detected.id);
    if (typeof maxLines === "number" && all.length > maxLines) {
      return [...all.slice(0, maxLines), [{ text: "…", color: "#8B949E" }]];
    }
    return all;
  }, [code, detected.id, maxLines]);

  return (
    <pre
      className={className}
      style={{ background: SYNTAX_CANVAS, color: SYNTAX_FG, margin: 0 }}
    >
      {lines.map((line, i) => (
        <span key={i} className="zp-mcard-code-line">
          {line.map((tok, j) => (
            <span key={j} style={{ color: tok.color }}>
              {tok.text}
            </span>
          ))}
        </span>
      ))}
    </pre>
  );
}

export { detectCodeLanguage };

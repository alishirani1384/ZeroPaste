import { common, createLowlight, type Root } from "lowlight";

import { colorForClasses, SYNTAX_FG } from "@/lib/syntax-theme";

export type SyntaxToken = { text: string; color: string };
export type SyntaxLine = SyntaxToken[];

const lowlight = createLowlight(common);

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

function walk(node: HastNode, classStack: string[], out: SyntaxToken[]) {
  if (node.type === "text") {
    const text = node.value ?? "";
    if (!text) return;
    out.push({ text, color: colorForClasses(classStack) });
    return;
  }
  if (node.type === "element") {
    const next = [...classStack, ...(node.properties?.className ?? [])];
    for (const child of node.children ?? []) walk(child, next, out);
    return;
  }
  if (node.type === "root") {
    for (const child of node.children ?? []) walk(child, classStack, out);
  }
}

/** Flatten hast tokens then split on newlines into visual lines. */
export function highlightToLines(code: string, language?: string | null): SyntaxLine[] {
  const source = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!source) return [[{ text: " ", color: SYNTAX_FG }]];

  let tree: Root;
  try {
    if (language && language !== "plaintext" && lowlight.registered(language)) {
      tree = lowlight.highlight(language, source);
    } else {
      tree = lowlight.highlightAuto(source);
    }
  } catch {
    return source.split("\n").map((line) => [{ text: line.length ? line : " ", color: SYNTAX_FG }]);
  }

  const flat: SyntaxToken[] = [];
  walk(tree as unknown as HastNode, [], flat);

  const lines: SyntaxLine[] = [[]];
  for (const tok of flat) {
    const parts = tok.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const piece = parts[i]!;
      if (piece.length) lines[lines.length - 1]!.push({ text: piece, color: tok.color });
    }
  }

  // Ensure empty lines still take vertical space.
  return lines.map((line) => (line.length ? line : [{ text: " ", color: SYNTAX_FG }]));
}

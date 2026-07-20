/** Map display labels + hljs language ids from clip language or heuristics. */
export function detectCodeLanguage(code: string, explicit?: string | null): {
  id: string;
  label: string;
} {
  const fromExplicit = explicit?.trim().toLowerCase();
  if (fromExplicit) {
    const id = normalizeLangId(fromExplicit);
    return { id, label: labelFor(id) };
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
  if (/<\?php|\becho\b|\$[a-zA-Z_]/.test(code)) {
    return { id: "php", label: "PHP" };
  }
  if (/^\s*(#include |int main\s*\()/.test(code)) {
    return { id: "cpp", label: "C / C++" };
  }
  if (/^\s*(public class |System\.out)/.test(code)) {
    return { id: "java", label: "Java" };
  }
  if (/^\s*(fun |val |var |package )/.test(code) && /\bKotlin\b|Android/.test(code) === false) {
    if (/\bfun\b/.test(code)) return { id: "kotlin", label: "Kotlin" };
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
  if (/^\s*(\.|#|@media)/.test(code) || /:\s*[^;]+;/.test(code)) {
    return { id: "css", label: "CSS" };
  }
  if (/^\s*#!/.test(code) || /\becho\b|\bif\s+\[/.test(code)) {
    return { id: "bash", label: "Shell" };
  }

  return { id: "plaintext", label: "Snippet" };
}

function normalizeLangId(raw: string): string {
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rs: "rust",
    c: "c",
    "c++": "cpp",
    cxx: "cpp",
    "c#": "csharp",
    cs: "csharp",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    html: "xml",
    htm: "xml",
  };
  return map[raw] ?? raw.replace(/^\./, "");
}

function labelFor(id: string): string {
  const labels: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    rust: "Rust",
    sql: "SQL",
    go: "Go",
    php: "PHP",
    cpp: "C / C++",
    c: "C",
    java: "Java",
    kotlin: "Kotlin",
    json: "JSON",
    xml: "HTML / XML",
    css: "CSS",
    bash: "Shell",
    csharp: "C#",
    yaml: "YAML",
    markdown: "Markdown",
    plaintext: "Snippet",
  };
  return labels[id] ?? id;
}

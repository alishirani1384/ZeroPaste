/** Atom One Dark–inspired token colors (text only, no backgrounds). */
export const SYNTAX_CANVAS = "#0D1117";
export const SYNTAX_FG = "#E6EDF3";

const CLASS_COLOR: Record<string, string> = {
  keyword: "#FF7B72",
  built_in: "#FFA657",
  type: "#79C0FF",
  literal: "#79C0FF",
  number: "#F2CC60",
  string: "#A5D6FF",
  regexp: "#A5D6FF",
  "template-variable": "#FFA657",
  "template-tag": "#FF7B72",
  comment: "#8B949E",
  doctag: "#8B949E",
  meta: "#8B949E",
  "meta-keyword": "#FF7B72",
  "meta-string": "#A5D6FF",
  title: "#D2A8FF",
  "title.class": "#79C0FF",
  "title.class.inherited": "#79C0FF",
  "title.function": "#D2A8FF",
  attr: "#79C0FF",
  attribute: "#79C0FF",
  variable: "#FFA657",
  "variable.language": "#FF7B72",
  "variable.constant": "#FFA657",
  symbol: "#79C0FF",
  bullet: "#FFA657",
  code: "#E6EDF3",
  emphasis: "#E6EDF3",
  strong: "#E6EDF3",
  formula: "#E6EDF3",
  link: "#A5D6FF",
  quote: "#8B949E",
  "selector-tag": "#FF7B72",
  "selector-id": "#79C0FF",
  "selector-class": "#FFA657",
  "selector-attr": "#A5D6FF",
  "selector-pseudo": "#FF7B72",
  tag: "#7EE787",
  name: "#7EE787",
  section: "#79C0FF",
  addition: "#7EE787",
  deletion: "#FF7B72",
  params: "#E6EDF3",
  property: "#79C0FF",
  punctuation: "#E6EDF3",
  operator: "#FF7B72",
  subst: "#E6EDF3",
};

export function colorForClasses(classes: string[] | undefined): string {
  if (!classes?.length) return SYNTAX_FG;
  // Prefer more specific class names first (e.g. title.function).
  const sorted = [...classes].sort((a, b) => b.length - a.length);
  for (const cls of sorted) {
    const key = cls.replace(/^hljs-/, "");
    if (CLASS_COLOR[key]) return CLASS_COLOR[key]!;
    // Prefix match: "keyword" from "keyword.control"
    const base = key.split(".")[0]!;
    if (CLASS_COLOR[base]) return CLASS_COLOR[base]!;
  }
  return SYNTAX_FG;
}

/**
 * CSS-ish color detection + RN-safe paint value.
 * Classification should stay loose; painting may fall back when RN can't parse a modern function.
 */

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE =
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[^)]+\)$/i;

/** Common CSS named colors (single token). */
const NAMED = new Set(
  [
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "blanchedalmond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkslategrey",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "maroon",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "rebeccapurple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen",
  ].map((n) => n.toLowerCase()),
);

/** True when trimmed text is a single color token / function (not a sentence). */
export function looksLikeCssColor(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return false;
  if (HEX_RE.test(t)) return true;
  if (FUNC_RE.test(t)) return true;
  if (!/\s/.test(t) && NAMED.has(t.toLowerCase())) return true;
  return false;
}

/**
 * Value safe enough for React Native `backgroundColor`.
 * Modern functions (oklch, lab, …) may not paint on RN — return null so UI can fall back.
 */
export function paintColorForNative(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (HEX_RE.test(t)) return t;
  if (/^rgba?\(/i.test(t) || /^hsla?\(/i.test(t)) return t;
  if (!/\s/.test(t) && NAMED.has(t.toLowerCase())) return t.toLowerCase();
  return null;
}

/** Pick contrasting label (white/black) for a painted swatch. Best-effort. */
export function contrastingInk(cssColor: string): "#FFFFFF" | "#1C1C1E" {
  const t = cssColor.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);
  if (m) {
    let h = m[1]!;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) h = h.slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.62 ? "#1C1C1E" : "#FFFFFF";
  }
  // rgb/hsl/named — prefer white label on translucent chip
  return "#FFFFFF";
}

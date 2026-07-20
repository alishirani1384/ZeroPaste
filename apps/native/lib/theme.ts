/** Native design tokens — iOS Settings + shadcn zinc dark. */
export const colors = {
  /** Legacy accent (destructive / links) */
  crimson: "#FF3B30",
  crimsonSoft: "#FF6961",

  /** shadcn-like primary (dark zinc) */
  primary: "#18181B",
  primaryFg: "#FAFAFA",
  primaryMuted: "#27272A",

  bgLight: "#F2F2F7",
  bgDark: "#000000",
  groupedLight: "#F2F2F7",
  groupedDark: "#000000",

  surfaceLight: "rgba(255,255,255,0.78)",
  surfaceDark: "rgba(38,38,42,0.78)",

  cardLight: "#FFFFFF",
  cardDark: "#1C1C1E",

  inkLight: "#000000",
  inkDark: "#FFFFFF",
  mutedLight: "#8E8E93",
  mutedDark: "#8E8E93",

  lineLight: "rgba(60,60,67,0.12)",
  lineDark: "rgba(84,84,88,0.36)",

  glassLight: "rgba(255,255,255,0.72)",
  glassDark: "rgba(28,28,30,0.72)",

  link: "#007AFF",
  success: "#34C759",
  warning: "#FF9F0A",

  linkWash: "#F2F2F7",
  codeBg: "#0D1117",
  codeFg: "#E6EDF3",

  fab: "#18181B",
  fabFg: "#FFFFFF",
} as const;

export const radii = {
  card: 12,
  bar: 28,
  pill: 999,
  sheet: 14,
  control: 10,
} as const;

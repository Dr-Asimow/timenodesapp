export type ThemeId = "minima" | "minima-dark" | "midnight" | "ocean" | "amber" | "sand" | "lime";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  bg: string;
  panel: string;
  border: string;
  accent: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: "minima",
    label: "White",
    bg: "#f5f6f8",
    panel: "#ffffff",
    border: "#ebedf0",
    accent: "#2db866",
  },
  {
    id: "minima-dark",
    label: "Dark",
    bg: "#111215",
    panel: "#1a1b1f",
    border: "#2a2b30",
    accent: "#2db866",
  },
  {
    id: "midnight",
    label: "Midnight",
    bg: "#0e0f1f",
    panel: "#161730",
    border: "#2a2c5a",
    accent: "#7c6af8",
  },
  {
    id: "ocean",
    label: "Ocean",
    bg: "#0d1520",
    panel: "#142030",
    border: "#253548",
    accent: "#38bdf8",
  },
  {
    id: "amber",
    label: "Amber",
    bg: "#12100a",
    panel: "#1c1810",
    border: "#35301e",
    accent: "#f0a020",
  },
  {
    id: "sand",
    label: "Sand",
    bg: "#f3efe8",
    panel: "#faf8f4",
    border: "#e0d8cc",
    accent: "#d9580d",
  },
  {
    id: "lime",
    label: "Lime",
    bg: "#f2f2ec",
    panel: "#fafaf8",
    border: "#dcdcd4",
    accent: "#7cb800",
  },
];

const KEY = "tn-theme";

const VALID: Set<string> = new Set(THEMES.map((t) => t.id));

export function getSavedTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  if (v && VALID.has(v)) return v as ThemeId;
  return "minima";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(KEY, id);
}

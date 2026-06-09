export type ThemeId = "github" | "midnight" | "amber" | "slate" | "sand";

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
    id: "github",
    label: "GitHub Dark",
    bg: "#0d1117",
    panel: "#161b22",
    border: "#30363d",
    accent: "#39d353",
  },
  {
    id: "midnight",
    label: "Midnight",
    bg: "#0a0b1e",
    panel: "#0f1035",
    border: "#2d2f70",
    accent: "#7c6af8",
  },
  {
    id: "amber",
    label: "Amber",
    bg: "#121008",
    panel: "#1e1a0c",
    border: "#3e3318",
    accent: "#f0a020",
  },
  {
    id: "slate",
    label: "Slate Blue",
    bg: "#0f172a",
    panel: "#1e293b",
    border: "#334155",
    accent: "#38bdf8",
  },
  {
    id: "sand",
    label: "Sand",
    bg: "#f2ede6",
    panel: "#faf7f3",
    border: "#ddd5c8",
    accent: "#d9580d",
  },
];

const KEY = "tn-theme";

export function getSavedTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  if (v === "midnight" || v === "amber" || v === "slate" || v === "sand") return v;
  return "github";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(KEY, id);
}

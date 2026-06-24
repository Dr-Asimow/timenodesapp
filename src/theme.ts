export type ThemeId = "github" | "midnight" | "amber" | "slate" | "sand" | "lime" | "minima" | "minima-dark";

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
    bg: "#0a0a0c",
    panel: "#131316",
    border: "#2a2a2f",
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
  {
    id: "lime",
    label: "Lime",
    bg: "#f1f1ec",
    panel: "#fafaf8",
    border: "#dcdcd4",
    accent: "#cdfa00",
  },
  {
    id: "minima",
    label: "Minima White",
    bg: "#f5f6f8",
    panel: "#ffffff",
    border: "#ebedf0",
    accent: "#2db866",
  },
  {
    id: "minima-dark",
    label: "Minima Dark",
    bg: "#111215",
    panel: "#1a1b1f",
    border: "#2a2b30",
    accent: "#2db866",
  },
];

const KEY = "tn-theme";

export function getSavedTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  if (v === "midnight" || v === "amber" || v === "slate" || v === "sand" || v === "lime" || v === "minima" || v === "minima-dark") return v;
  return "github";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(KEY, id);
}

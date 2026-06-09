export type View = "week" | "weeks" | "profile" | "stats";

export function initials(name: string): string {
  const s = name.trim();
  if (!s) return "?";
  const parts = s.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

import type { TimeBall } from "./types";

// Günlük plan ödül katsayıları (ileride değiştirmek için tek yer)
export const PLAN_XP_PER_MIN = 1;
export const PLAN_COIN_PER_MIN = 1;

export const BALL_DURATIONS = [10, 30, 60] as const;

// Etkinliklere dağıtılmış (havuzda olmayan) topların toplam dakikası
export function plannedMinutes(balls: TimeBall[], habitId?: string): number {
  return balls
    .filter((b) => (habitId ? b.habitId === habitId : b.habitId !== null))
    .reduce((s, b) => s + b.duration, 0);
}

export function planRewards(totalMin: number): { xp: number; coin: number } {
  return {
    xp: Math.round(totalMin * PLAN_XP_PER_MIN),
    coin: Math.round(totalMin * PLAN_COIN_PER_MIN),
  };
}

// 100 → "1s 40dk", 60 → "1s", 30 → "30dk"
export function fmtPlanMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}s ${m}dk`;
  if (h) return `${h}s`;
  return `${m}dk`;
}

import type { ActiveTimer, Habit } from "./types";

// --- Hafta / tarih yardımcıları ---------------------------------------

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): Date {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d;
}

// Alışkanlık id'leri Postgres uuid sütunuyla uyumlu olmalı
export function newId(): string {
  return crypto.randomUUID();
}

// Bir yılın ISO haftaları (hafta = Perşembe'sinin yılı o yıl olan hafta)
export function weeksOfYear(year: number): { weekNumber: number; startISO: string }[] {
  const firstMonday = mondayOf(new Date(year, 0, 4)); // 4 Ocak hep 1. haftadadır
  const weeks: { weekNumber: number; startISO: string }[] = [];
  for (let i = 0; i < 53; i++) {
    const monday = addDays(toISODate(firstMonday), i * 7);
    const thursday = addDays(toISODate(monday), 3);
    if (thursday.getFullYear() !== year) continue;
    weeks.push({ weekNumber: isoWeekNumber(monday), startISO: toISODate(monday) });
  }
  return weeks;
}

type Minutesish = Record<string, number[]>;
export function emptyMinutes(habits: Habit[]): Minutesish {
  const m: Minutesish = {};
  for (const h of habits) m[h.id] = [0, 0, 0, 0, 0, 0, 0];
  return m;
}

export function emptyNotes(habits: Habit[]): Record<string, (string | null)[]> {
  const m: Record<string, (string | null)[]> = {};
  for (const h of habits) m[h.id] = [null, null, null, null, null, null, null];
  return m;
}

// --- Sayaç kalıcılığı (cihaz-yerel; canlı sayaç device'a bağlıdır) ----
// Kullanıcı başına ayrı anahtar, aynı tarayıcıda farklı kullanıcılar çakışmasın.

const timersKey = (userId: string) => `timenodes.timers.${userId}`;

export function loadTimers(userId: string): ActiveTimer[] {
  try {
    const raw = localStorage.getItem(timersKey(userId));
    if (!raw) return [];
    return (JSON.parse(raw) as ActiveTimer[]).map(normalizeTimer);
  } catch {
    return [];
  }
}

export function saveTimers(userId: string, timers: ActiveTimer[]): void {
  localStorage.setItem(timersKey(userId), JSON.stringify(timers));
}

function normalizeTimer(
  t: ActiveTimer & {
    accumulatedMs?: number;
    workAlarmFired?: boolean;
    breakAlarmFired?: boolean;
  }
): ActiveTimer {
  return {
    habitId: t.habitId,
    day: t.day,
    phase: t.phase ?? "work",
    startedAt: t.startedAt ?? null,
    workMs: t.workMs ?? t.accumulatedMs ?? 0,
    breakMs: t.breakMs ?? 0,
    workTargetMs: t.workTargetMs ?? null,
    breakTargetMs: t.breakTargetMs ?? null,
    plannedBreakMs: t.plannedBreakMs ?? null,
    workAlarmAck: t.workAlarmAck ?? t.workAlarmFired ?? false,
    breakAlarmAck: t.breakAlarmAck ?? t.breakAlarmFired ?? false,
    cyclesTotal: t.cyclesTotal ?? 1,
    cyclesDone: t.cyclesDone ?? 0,
  };
}

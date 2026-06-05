import type { ActiveTimer, AppState, Habit, WeekData } from "./types";

const KEY = "timenodes.state.v1";

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

// --- Varsayılan durum -------------------------------------------------

let idCounter = 0;
export function newId(): string {
  return `h${Date.now().toString(36)}${(idCounter++).toString(36)}`;
}

const DEFAULT_HABITS: string[] = [
  "Çizim",
  "Japonca",
  "İngilizce",
  "Kitap",
  "Maneviyat",
  "Freelance",
  "Proje",
  "Egzersiz",
];

export function emptyMinutes(habits: Habit[]): Minutesish {
  const m: Minutesish = {};
  for (const h of habits) m[h.id] = [0, 0, 0, 0, 0, 0, 0];
  return m;
}
type Minutesish = Record<string, number[]>;

export function defaultWeek(): WeekData {
  const today = new Date();
  const monday = mondayOf(today);
  const habits: Habit[] = DEFAULT_HABITS.map((name) => ({ id: newId(), name }));
  return {
    weekNumber: isoWeekNumber(today),
    year: monday.getFullYear(),
    startDate: toISODate(monday),
    habits,
    minutes: emptyMinutes(habits),
    breaks: emptyMinutes(habits),
  };
}

export function defaultState(username: string): AppState {
  return { username, week: defaultWeek() };
}

// --- Kalıcılık --------------------------------------------------------

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as AppState & { timer?: ActiveTimer | null };
    // Eski tek-sayaç biçimini çoklu-sayaç dizisine taşı
    if (!state.timers) {
      state.timers = state.timer ? [state.timer] : [];
    }
    delete state.timer;
    // Eski sayaç alanlarını yeni (evre/hedef) biçime normalize et
    state.timers = state.timers.map(normalizeTimer);
    // Mola dakikaları haritası eski kayıtlarda olmayabilir
    if (!state.week.breaks) {
      state.week.breaks = emptyMinutes(state.week.habits);
    } else {
      for (const h of state.week.habits) {
        if (!state.week.breaks[h.id]) state.week.breaks[h.id] = [0, 0, 0, 0, 0, 0, 0];
      }
    }
    return state;
  } catch {
    return null;
  }
}

// Eski {startedAt, accumulatedMs} biçimini yeni evre/hedef alanlarına taşır
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
  };
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

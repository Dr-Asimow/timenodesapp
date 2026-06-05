import { supabase } from "./supabase";
import type { Habit, WeekData } from "./types";
import { isoWeekNumber, toISODate, addDays, emptyMinutes } from "./storage";

const DEFAULT_HABITS = [
  "Çizim",
  "Japonca",
  "İngilizce",
  "Kitap",
  "Maneviyat",
  "Freelance",
  "Proje",
  "Egzersiz",
];

// Kullanıcı adını Supabase Auth e-postasına eşle (kullanıcı maili hiç görmez)
function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@timenodes.app`;
}

// --- Auth -------------------------------------------------------------

export async function signUp(username: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) throw error;
}

export async function signIn(username: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function currentUsername(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return (u.user_metadata?.username as string) ?? u.email?.split("@")[0] ?? "kullanıcı";
}

// --- Veri ------------------------------------------------------------

type HabitRow = { id: string; name: string; position: number };
type EntryRow = {
  habit_id: string;
  day: string;
  work_min: number;
  break_min: number;
};

// Belirtilen haftanın (Pazartesi ISO) verisini WeekData olarak yükler.
// Yeni kullanıcıda alışkanlık yoksa varsayılanları tohumlar.
export async function loadWeek(startDateISO: string): Promise<WeekData> {
  let { data: habitRows, error: hErr } = await supabase
    .from("habits")
    .select("id,name,position")
    .eq("archived", false)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (hErr) throw hErr;

  if (!habitRows || habitRows.length === 0) {
    await seedDefaultHabits();
    const r = await supabase
      .from("habits")
      .select("id,name,position")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    habitRows = r.data ?? [];
  }

  const habits: Habit[] = (habitRows as HabitRow[]).map((h) => ({
    id: h.id,
    name: h.name,
  }));

  const endISO = toISODate(addDays(startDateISO, 6));
  const { data: entryRows, error: eErr } = await supabase
    .from("entries")
    .select("habit_id,day,work_min,break_min")
    .gte("day", startDateISO)
    .lte("day", endISO);
  if (eErr) throw eErr;

  const minutes = emptyMinutes(habits);
  const breaks = emptyMinutes(habits);
  for (const e of (entryRows as EntryRow[]) ?? []) {
    const idx = dayIndex(startDateISO, e.day);
    if (idx < 0 || idx > 6) continue;
    if (minutes[e.habit_id]) minutes[e.habit_id][idx] = e.work_min;
    if (breaks[e.habit_id]) breaks[e.habit_id][idx] = e.break_min;
  }

  const monday = new Date(startDateISO + "T00:00:00");
  return {
    weekNumber: isoWeekNumber(monday),
    year: monday.getFullYear(),
    startDate: startDateISO,
    habits,
    minutes,
    breaks,
  };
}

function dayIndex(startISO: string, dayISO: string): number {
  const a = new Date(startISO + "T00:00:00").getTime();
  const b = new Date(dayISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export async function seedDefaultHabits() {
  const rows = DEFAULT_HABITS.map((name, i) => ({ name, position: i }));
  const { error } = await supabase.from("habits").insert(rows);
  if (error) throw error;
}

export async function insertHabit(id: string, name: string, position: number) {
  const { error } = await supabase
    .from("habits")
    .insert({ id, name, position });
  if (error) throw error;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

// Bir hücreyi (habit + tarih) yazar. work/break 0 ise satır yine de upsert edilir.
export async function upsertEntry(
  habitId: string,
  dayISO: string,
  workMin: number,
  breakMin: number
) {
  const { error } = await supabase
    .from("entries")
    .upsert(
      { habit_id: habitId, day: dayISO, work_min: workMin, break_min: breakMin },
      { onConflict: "habit_id,day" }
    );
  if (error) throw error;
}

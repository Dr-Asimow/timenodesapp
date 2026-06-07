import { supabase } from "./supabase";
import type { Habit, WeekData } from "./types";
import {
  isoWeekNumber,
  toISODate,
  addDays,
  emptyMinutes,
  emptyNotes,
} from "./storage";

// Bir yılın hafta numarasına göre gün bazında çalışma dakikaları (Haftalar sayfası ısı haritası)
// Dönüş: { [haftaNo]: [Pzt, Sal, Çar, Per, Cum, Cmt, Paz] } (dakika)
export async function loadYearTotals(
  year: number
): Promise<Record<number, number[]>> {
  const { data, error } = await supabase
    .from("entries")
    .select("day,work_min")
    .gte("day", `${year}-01-01`)
    .lte("day", `${year}-12-31`);
  if (error) throw error;
  const map: Record<number, number[]> = {};
  for (const r of (data as { day: string; work_min: number }[]) ?? []) {
    const d = new Date(r.day + "T00:00:00");
    const wk = isoWeekNumber(d);
    if (!map[wk]) map[wk] = [0, 0, 0, 0, 0, 0, 0];
    const dow = (d.getDay() + 6) % 7; // JS: 0=Paz → Pzt=0..Paz=6
    map[wk][dow] += r.work_min;
  }
  return map;
}

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

// Auth kimliği için isimden BAĞIMSIZ, rastgele sabit sentetik mail.
// Böylece kullanıcı adı değiştirilebilir/benzersiz olur, giriş bozulmaz.
function syntheticEmail(): string {
  return `tn_${crypto.randomUUID().replace(/-/g, "")}@timenodes.app`;
}

// --- Auth -------------------------------------------------------------

export async function signUp(
  username: string,
  password: string,
  email: string
) {
  const uname = username.trim();
  if (!uname) throw new Error("Kullanıcı adı boş olamaz.");

  // Kullanıcı adı benzersiz olmalı (büyük/küçük harf duyarsız)
  const { data: available, error: aErr } = await supabase.rpc(
    "username_available",
    { uname }
  );
  if (aErr) throw aErr;
  if (!available) throw new Error("Bu kullanıcı adı zaten alınmış.");

  // Gerçek e-posta yalnızca profilde saklanır (auth kimliği rastgele sentetik mail)
  const { error } = await supabase.auth.signUp({
    email: syntheticEmail(),
    password,
    options: { data: { username: uname, contact_email: email.trim() } },
  });
  if (error) throw error;
}

export async function signIn(username: string, password: string) {
  const uname = username.trim();
  if (!uname) throw new Error("Kullanıcı adı boş olamaz.");

  // Kullanıcı adından auth e-postasını çöz (RPC)
  const { data: authEmail, error: rErr } = await supabase.rpc(
    "auth_email_for_username",
    { uname }
  );
  if (rErr) throw rErr;
  if (!authEmail) throw new Error("Kullanıcı adı veya şifre hatalı.");

  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail as string,
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
  note: string | null;
};
type DayNoteRow = { day: string; note: string | null };

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
    .select("habit_id,day,work_min,break_min,note")
    .gte("day", startDateISO)
    .lte("day", endISO);
  if (eErr) throw eErr;

  const minutes = emptyMinutes(habits);
  const breaks = emptyMinutes(habits);
  const notes = emptyNotes(habits);
  for (const e of (entryRows as EntryRow[]) ?? []) {
    const idx = dayIndex(startDateISO, e.day);
    if (idx < 0 || idx > 6) continue;
    if (minutes[e.habit_id]) minutes[e.habit_id][idx] = e.work_min;
    if (breaks[e.habit_id]) breaks[e.habit_id][idx] = e.break_min;
    if (notes[e.habit_id]) notes[e.habit_id][idx] = e.note ?? null;
  }

  // Gün notları
  const { data: dayNoteRows, error: dErr } = await supabase
    .from("day_notes")
    .select("day,note")
    .gte("day", startDateISO)
    .lte("day", endISO);
  if (dErr) throw dErr;
  const dayNotes: (string | null)[] = [null, null, null, null, null, null, null];
  for (const d of (dayNoteRows as DayNoteRow[]) ?? []) {
    const idx = dayIndex(startDateISO, d.day);
    if (idx >= 0 && idx <= 6) dayNotes[idx] = d.note ?? null;
  }

  const monday = new Date(startDateISO + "T00:00:00");
  return {
    weekNumber: isoWeekNumber(monday),
    year: monday.getFullYear(),
    startDate: startDateISO,
    habits,
    minutes,
    breaks,
    notes,
    dayNotes,
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

// Bir hücreyi (habit + tarih) yazar: çalışma, mola ve aktivite notu.
export async function upsertEntry(
  habitId: string,
  dayISO: string,
  workMin: number,
  breakMin: number,
  note: string | null
) {
  const { error } = await supabase.from("entries").upsert(
    {
      habit_id: habitId,
      day: dayISO,
      work_min: workMin,
      break_min: breakMin,
      note,
    },
    { onConflict: "habit_id,day" }
  );
  if (error) throw error;
}

// Gün notu (tarih bazında) yaz
export async function setDayNote(
  userId: string,
  dayISO: string,
  note: string
) {
  const { error } = await supabase
    .from("day_notes")
    .upsert(
      { user_id: userId, day: dayISO, note },
      { onConflict: "user_id,day" }
    );
  if (error) throw error;
}

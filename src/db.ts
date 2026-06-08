import { supabase } from "./supabase";
import type { Habit, TodoItem, WeekData } from "./types";
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

// İstatistik sayfası için yıl bazında özet
export type YearStats = {
  perWeek: Record<number, number>; // hafta no → toplam çalışma dk
  perHabit: { name: string; min: number }[]; // alışkanlık bazında çalışma dk (azalan)
  totalWork: number;
  totalBreak: number;
  activeDays: number; // çalışma>0 olan farklı gün sayısı
  bestDay: { day: string; min: number } | null;
};

export async function loadYearStats(year: number): Promise<YearStats> {
  const { data: entries, error } = await supabase
    .from("entries")
    .select("habit_id,day,work_min,break_min")
    .gte("day", `${year}-01-01`)
    .lte("day", `${year}-12-31`);
  if (error) throw error;

  const { data: habitRows } = await supabase.from("habits").select("id,name");
  const names = new Map<string, string>();
  for (const h of (habitRows as { id: string; name: string }[]) ?? [])
    names.set(h.id, h.name);

  const perWeek: Record<number, number> = {};
  const perHabitMin = new Map<string, number>();
  const dayWork = new Map<string, number>();
  let totalWork = 0;
  let totalBreak = 0;

  for (const e of (entries as {
    habit_id: string;
    day: string;
    work_min: number;
    break_min: number;
  }[]) ?? []) {
    totalWork += e.work_min;
    totalBreak += e.break_min;
    const wk = isoWeekNumber(new Date(e.day + "T00:00:00"));
    perWeek[wk] = (perWeek[wk] ?? 0) + e.work_min;
    perHabitMin.set(
      e.habit_id,
      (perHabitMin.get(e.habit_id) ?? 0) + e.work_min
    );
    dayWork.set(e.day, (dayWork.get(e.day) ?? 0) + e.work_min);
  }

  const perHabit = [...perHabitMin.entries()]
    .map(([id, min]) => ({ name: names.get(id) ?? "—", min }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);

  let activeDays = 0;
  let bestDay: { day: string; min: number } | null = null;
  for (const [day, min] of dayWork) {
    if (min > 0) activeDays++;
    if (!bestDay || min > bestDay.min) bestDay = { day, min };
  }

  return { perWeek, perHabit, totalWork, totalBreak, activeDays, bestDay };
}

// Bir haftanın (Pazartesi ISO) alışkanlık bazında toplam çalışma dk'sı
export async function loadHabitTotalsForWeek(
  startDateISO: string
): Promise<Record<string, number>> {
  const endISO = toISODate(addDays(startDateISO, 6));
  const { data, error } = await supabase
    .from("entries")
    .select("habit_id,work_min")
    .gte("day", startDateISO)
    .lte("day", endISO);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const r of (data as { habit_id: string; work_min: number }[]) ?? [])
    map[r.habit_id] = (map[r.habit_id] ?? 0) + r.work_min;
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

// Görünen adı güncelle (auth metadata → session anında yansır)
export async function updateDisplayName(name: string) {
  const { error } = await supabase.auth.updateUser({
    data: { display_name: name.trim() },
  });
  if (error) throw error;
}

// Şifre değiştir (oturum açık kullanıcı)
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Avatar/kart görselini Storage'a yükle → public URL'i metadata'ya yaz, URL döndür
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `${userId}/avatar`; // sabit yol (upsert ile eski görsel ezilir)
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`; // önbellek kırıcı
  const { error: e2 } = await supabase.auth.updateUser({
    data: { avatar_url: url },
  });
  if (e2) throw e2;
  return url;
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

// Bir alışkanlığın sıralama pozisyonunu güncelle (sürükle-bırak yeniden sıralama)
export async function updateHabitPosition(id: string, position: number) {
  const { error } = await supabase
    .from("habits")
    .update({ position })
    .eq("id", id);
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

// --- Günlük gündem / yapılacaklar (to-do) ----------------------------

type TodoRow = {
  id: string;
  day: string;
  habit_id: string | null;
  title: string;
  done: boolean;
  position: number;
};

const toTodo = (r: TodoRow): TodoItem => ({
  id: r.id,
  day: r.day,
  habitId: r.habit_id,
  title: r.title,
  done: r.done,
  position: r.position,
});

// Bir günün gündem öğelerini yükle (sıralı)
export async function loadDayTodos(dayISO: string): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("id,day,habit_id,title,done,position")
    .eq("day", dayISO)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as TodoRow[]) ?? []).map(toTodo);
}

// Gündem öğesi ekle (alışkanlık bağlı: habitId dolu / serbest todo: title)
export async function addTodo(
  userId: string,
  dayISO: string,
  habitId: string | null,
  title: string,
  position: number
): Promise<TodoItem> {
  const { data, error } = await supabase
    .from("todos")
    .insert({
      user_id: userId,
      day: dayISO,
      habit_id: habitId,
      title,
      position,
    })
    .select("id,day,habit_id,title,done,position")
    .single();
  if (error) throw error;
  return toTodo(data as TodoRow);
}

export async function setTodoDone(id: string, done: boolean) {
  const { error } = await supabase.from("todos").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteTodo(id: string) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw error;
}

// --- Not sayfaları (Notion benzeri, blok-tabanlı / Tiptap JSON) -------

export type PageDoc = Record<string, unknown>;
export type Page = {
  id: string;
  title: string;
  content: PageDoc | null;
  day: string | null;
};

type PageRow = {
  id: string;
  title: string;
  content: PageDoc | null;
  day: string | null;
};

// Bir güne ait not sayfasını yükle (yoksa null)
export async function loadDayPage(dayISO: string): Promise<Page | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("id,title,content,day")
    .eq("day", dayISO)
    .maybeSingle();
  if (error) throw error;
  return (data as PageRow) ?? null;
}

// Bir güne ait not sayfasını kaydet (upsert: user_id+day tekil)
export async function saveDayPage(
  userId: string,
  dayISO: string,
  title: string,
  content: PageDoc
): Promise<void> {
  const { error } = await supabase.from("pages").upsert(
    { user_id: userId, day: dayISO, title, content },
    { onConflict: "user_id,day" }
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

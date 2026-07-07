import { supabase } from "./supabase";
import type { Goal, Habit, MusicFavorite, Reminder, TodoItem, Topic, TopicMinute, WeekData } from "./types";
import {
  isoWeekNumber,
  toISODate,
  addDays,
  mondayOf,
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
// Bir etkinliğin günlük zaman serisi (çizgi grafiği için). Günlük kırılım
// tutulur; haftalık/aylık görünümler client'ta bundan türetilir.
export type HabitSeries = {
  id: string;
  name: string;
  color: string | null;
  daily: Record<string, number>; // gün ISO (YYYY-MM-DD) → çalışma dk
};

export type YearStats = {
  perWeek: Record<number, number>; // hafta no → toplam çalışma dk
  perHabit: { id: string; name: string; min: number; color: string | null }[]; // bu yıl, alışkanlık bazında çalışma dk (azalan)
  allTimePerHabit: { id: string; name: string; min: number; color: string | null }[]; // tüm zamanlar, alışkanlık bazında
  habitSeries: HabitSeries[]; // etkinlik bazında haftalık/aylık seri (çizgi grafiği)
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

  const { data: habitRows } = await supabase
    .from("habits")
    .select("id,name,color");
  const names = new Map<string, string>();
  const colors = new Map<string, string | null>();
  for (const h of (habitRows as { id: string; name: string; color: string | null }[]) ?? []) {
    names.set(h.id, h.name);
    colors.set(h.id, h.color);
  }

  const perWeek: Record<number, number> = {};
  const perHabitMin = new Map<string, number>();
  const dayWork = new Map<string, number>();
  // Etkinlik bazında günlük seri (gün ISO → dk)
  const seriesMap = new Map<string, Record<string, number>>();
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
    const d = new Date(e.day + "T00:00:00");
    const wk = isoWeekNumber(d);
    perWeek[wk] = (perWeek[wk] ?? 0) + e.work_min;
    perHabitMin.set(
      e.habit_id,
      (perHabitMin.get(e.habit_id) ?? 0) + e.work_min
    );
    dayWork.set(e.day, (dayWork.get(e.day) ?? 0) + e.work_min);

    let s = seriesMap.get(e.habit_id);
    if (!s) {
      s = {};
      seriesMap.set(e.habit_id, s);
    }
    s[e.day] = (s[e.day] ?? 0) + e.work_min;
  }

  const perHabit = [...perHabitMin.entries()]
    .map(([id, min]) => ({ id, name: names.get(id) ?? "—", min, color: colors.get(id) ?? null }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);

  const habitSeries: HabitSeries[] = [...seriesMap.entries()]
    .map(([id, daily]) => ({
      id,
      name: names.get(id) ?? "—",
      color: colors.get(id) ?? null,
      daily,
    }))
    .filter((h) => Object.values(h.daily).some((v) => v > 0))
    .sort(
      (a, b) =>
        Object.values(b.daily).reduce((x, y) => x + y, 0) -
        Object.values(a.daily).reduce((x, y) => x + y, 0)
    );

  let activeDays = 0;
  let bestDay: { day: string; min: number } | null = null;
  for (const [day, min] of dayWork) {
    if (min > 0) activeDays++;
    if (!bestDay || min > bestDay.min) bestDay = { day, min };
  }

  // Tüm zamanlar dağılımı (yıl filtresi olmadan, alışkanlık bazında toplam)
  const { data: allEntries } = await supabase
    .from("entries")
    .select("habit_id,work_min");
  const allMap = new Map<string, number>();
  for (const e of (allEntries as { habit_id: string; work_min: number }[]) ?? [])
    allMap.set(e.habit_id, (allMap.get(e.habit_id) ?? 0) + e.work_min);
  const allTimePerHabit = [...allMap.entries()]
    .map(([id, min]) => ({ id, name: names.get(id) ?? "—", min, color: colors.get(id) ?? null }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);

  return { perWeek, perHabit, allTimePerHabit, habitSeries, totalWork, totalBreak, activeDays, bestDay };
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

// Yeni kullanıcıya kopyalanan genel varsayılan etkinlikler
const DEFAULT_HABITS = ["Mesai", "Ders", "Egzersiz", "Meditasyon"];

// --- Auth (e-posta ile giriş) ----------------------------------------

// Kayıt: gerçek e-posta + şifre + görünen ad.
// Profil (display_name + benzersiz friend_code) DB trigger'ı ile oluşur.
export async function signUp(
  email: string,
  password: string,
  displayName: string
) {
  const mail = email.trim();
  const name = displayName.trim();
  if (!mail) throw new Error("E-posta boş olamaz.");
  if (!name) throw new Error("Görünen ad boş olamaz.");
  const { data, error } = await supabase.auth.signUp({
    email: mail,
    password,
    options: {
      data: { display_name: name },
      // Onay linkine tıklayınca kullanıcı uygulamaya geri dönsün
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  // Onay e-postası akışında session null döner → onay bekleniyor demektir.
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string) {
  const mail = email.trim();
  if (!mail) throw new Error("E-posta boş olamaz.");
  const { error } = await supabase.auth.signInWithPassword({
    email: mail,
    password,
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// Oturum sahibinin benzersiz arkadaş kodu (UID) — profiles'tan
export async function loadMyFriendCode(): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("friend_code")
    .maybeSingle();
  if (error) return null;
  return (data?.friend_code as string) ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function deleteOwnAccount(email: string, password: string) {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) throw new Error("Şifre doğrulanamadı.");

  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error("Hesap silinemedi: " + error.message);
}

// Kullanıcı kendi eklediği ilk alışkanlığı oluşturduğunda tebrik e-postasını tetikler.
// Tek-seferlik garanti Edge Function tarafında (profiles.congrats_email_sent) sağlanır;
// burada hatayı sessizce yutarız ki kayıt akışını ve UI'ı etkilemesin.
export async function sendCongratsEmail() {
  try {
    await supabase.functions.invoke("congrats-email");
  } catch {
    /* sessizce geç */
  }
}

// Görünen adı güncelle: auth metadata (session anında) + profiles (arkadaş listesi)
export async function updateDisplayName(name: string) {
  const v = name.trim();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: v },
  });
  if (error) throw error;
  // profiles.display_name'i de güncelle (ileride arkadaşların görmesi için)
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase
      .from("profiles")
      .update({ display_name: v })
      .eq("id", data.user.id);
  }
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

// Not görselini Storage'a yükle → public URL döndür (benzersiz dosya adı).
// Not: not silindiğinde Storage'daki görsel yetim kalır; temizlik v1 kapsamı dışı.
export async function uploadNoteImage(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("note-images")
    .upload(path, file, {
      upsert: false,
      cacheControl: "31536000",
      contentType: file.type || undefined,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("note-images").getPublicUrl(path);
  return data.publicUrl; // benzersiz ad → önbellek kırıcıya gerek yok
}

export async function currentUsername(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return (u.user_metadata?.username as string) ?? u.email?.split("@")[0] ?? "kullanıcı";
}

// --- Veri ------------------------------------------------------------

type HabitRow = { id: string; name: string; position: number; color: string | null };
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
    .select("id,name,position,color")
    .eq("archived", false)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (hErr) throw hErr;

  if (!habitRows || habitRows.length === 0) {
    await seedDefaultHabits();
    const r = await supabase
      .from("habits")
      .select("id,name,position,color")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    habitRows = r.data ?? [];
  }

  const habits: Habit[] = (habitRows as HabitRow[]).map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color ?? null,
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

// Bir alışkanlığın rengini güncelle (null = varsayılan accent rengi)
export async function updateHabitColor(id: string, color: string | null) {
  const { error } = await supabase
    .from("habits")
    .update({ color })
    .eq("id", id);
  if (error) throw error;
}

// Bir alışkanlığın adını güncelle
export async function updateHabitName(id: string, name: string) {
  const { error } = await supabase
    .from("habits")
    .update({ name })
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

// Tarih aralığındaki serbest to-do'lar (takvim görünümü için; habit bağlı olanlar hariç)
export async function loadTodosInRange(fromISO: string, toISO: string): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("id,day,habit_id,title,done,position")
    .gte("day", fromISO)
    .lte("day", toISO)
    .is("habit_id", null)
    .order("day", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data as TodoRow[]) ?? []).map(toTodo);
}

// Günü geçmiş, yapılmamış serbest to-do'lar ("Geciken" bölümü için)
export async function loadOverdueTodos(beforeISO: string): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("id,day,habit_id,title,done,position")
    .lt("day", beforeISO)
    .eq("done", false)
    .is("habit_id", null)
    .order("day", { ascending: true });
  if (error) throw error;
  return ((data as TodoRow[]) ?? []).map(toTodo);
}

// To-do'yu başka bir güne taşı (geciken → bugüne)
export async function updateTodoDay(id: string, dayISO: string) {
  const { error } = await supabase.from("todos").update({ day: dayISO }).eq("id", id);
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

// Bir güne ait not sayfasını kaydet.
// Not: pages tablosundaki tekil indeks "kısmi" (where day is not null) olduğu için
// kolon-bazlı ON CONFLICT (upsert) eşleşmiyor (42P10). Bu yüzden önce var olan satırı
// bulup güncelliyor, yoksa ekliyoruz.
export async function saveDayPage(
  userId: string,
  dayISO: string,
  title: string,
  content: PageDoc
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("pages")
    .select("id")
    .eq("day", dayISO)
    .is("habit_id", null)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    const { error } = await supabase
      .from("pages")
      .update({ title, content })
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("pages")
      .insert({ user_id: userId, day: dayISO, title, content });
    if (error) throw error;
  }
}

// Bir etkinliğe ait sayfayı yükle (yoksa null) — günden bağımsız, kalıcı
export async function loadHabitPage(habitId: string): Promise<Page | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("id,title,content,day")
    .eq("habit_id", habitId)
    .maybeSingle();
  if (error) throw error;
  return (data as PageRow) ?? null;
}

// Bir etkinliğe ait sayfayı kaydet.
// (Aynı kısmi indeks nedeniyle upsert yerine önce-seç-sonra-güncelle/ekle deseni.)
export async function saveHabitPage(
  userId: string,
  habitId: string,
  title: string,
  content: PageDoc
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("pages")
    .select("id")
    .eq("habit_id", habitId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    const { error } = await supabase
      .from("pages")
      .update({ title, content })
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("pages")
      .insert({ user_id: userId, habit_id: habitId, title, content });
    if (error) throw error;
  }
}

// Tek bir günün notunu oku (takvim popup'ı için)
export async function loadDayNote(dayISO: string): Promise<string> {
  const { data, error } = await supabase
    .from("day_notes")
    .select("note")
    .eq("day", dayISO)
    .maybeSingle();
  if (error) throw error;
  return (data as { note: string | null } | null)?.note ?? "";
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

// --- Günlük hedefler (goals) -------------------------------------------

export async function loadGoals(dayISO: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("id,day,text")
    .eq("day", dayISO)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function addGoal(
  userId: string,
  dayISO: string,
  text: string
): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, day: dayISO, text })
    .select("id,day,text")
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// --- Hatırlatıcılar (reminders) ----------------------------------------

export async function loadReminders(userId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("target_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    target_at: r.target_at as string,
  }));
}

export async function addReminder(
  userId: string,
  title: string,
  targetAt: string,
  description?: string
): Promise<Reminder> {
  const row: Record<string, unknown> = { user_id: userId, title, target_at: targetAt };
  if (description) row.description = description;
  const { data, error } = await supabase
    .from("reminders")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    target_at: r.target_at as string,
  };
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

// ── Favori müzikler (music_favorites) ──────────────────────────────

export async function loadMusicFavorites(userId: string): Promise<MusicFavorite[]> {
  const { data, error } = await supabase
    .from("music_favorites")
    .select("id,video_id,title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; video_id: string; title: string }[]).map(
    (r) => ({ id: r.id, videoId: r.video_id, title: r.title })
  );
}

export async function addMusicFavorite(
  userId: string,
  videoId: string,
  title: string
): Promise<MusicFavorite> {
  // Aynı video ikinci kez eklenirse üzerine yazılır (unique user_id+video_id)
  const { data, error } = await supabase
    .from("music_favorites")
    .upsert(
      { user_id: userId, video_id: videoId, title },
      { onConflict: "user_id,video_id" }
    )
    .select("id,video_id,title")
    .single();
  if (error) throw error;
  const r = data as { id: string; video_id: string; title: string };
  return { id: r.id, videoId: r.video_id, title: r.title };
}

export async function deleteMusicFavorite(id: string): Promise<void> {
  const { error } = await supabase.from("music_favorites").delete().eq("id", id);
  if (error) throw error;
}

// ── Konular (etkinliğe bağlı kalıcı) ───────────────────────────────

export async function loadTopics(habitId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("id,habit_id,name")
    .eq("habit_id", habitId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as { id: string; habit_id: string; name: string }[]) ?? []).map(
    (r) => ({ id: r.id, habitId: r.habit_id, name: r.name })
  );
}

export async function addTopic(
  userId: string,
  habitId: string,
  name: string
): Promise<Topic> {
  const { data, error } = await supabase
    .from("topics")
    .insert({ user_id: userId, habit_id: habitId, name })
    .select("id,habit_id,name")
    .single();
  if (error) throw error;
  const r = data as { id: string; habit_id: string; name: string };
  return { id: r.id, habitId: r.habit_id, name: r.name };
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw error;
}

// Bir konunun belirli gündeki süresine dakika ekler/çıkarır (yoksa oluşturur, 0'ın altına düşmez)
export async function addTopicMinutes(
  userId: string,
  habitId: string,
  dayISO: string,
  topicId: string,
  deltaMin: number
): Promise<void> {
  if (deltaMin === 0) return;
  const { data } = await supabase
    .from("topic_minutes")
    .select("id,work_min")
    .eq("topic_id", topicId)
    .eq("day", dayISO)
    .maybeSingle();
  if (data) {
    const row = data as { id: string; work_min: number };
    await supabase
      .from("topic_minutes")
      .update({ work_min: Math.max(0, row.work_min + deltaMin) })
      .eq("id", row.id);
  } else if (deltaMin > 0) {
    await supabase.from("topic_minutes").insert({
      user_id: userId,
      habit_id: habitId,
      day: dayISO,
      topic_id: topicId,
      work_min: deltaMin,
    });
  }
}

// Bir hücrenin (habit + gün) konu bazında süre kırılımı (azalan)
export async function loadTopicMinutes(
  habitId: string,
  dayISO: string
): Promise<TopicMinute[]> {
  const { data, error } = await supabase
    .from("topic_minutes")
    .select("topic_id,work_min,topics(name)")
    .eq("habit_id", habitId)
    .eq("day", dayISO);
  if (error) throw error;
  // PostgREST embed'i obje veya tek-elemanlı dizi döndürebilir; ikisini de karşıla
  return (((data ?? []) as any[]))
    .map((r) => ({
      topicId: r.topic_id,
      name: (Array.isArray(r.topics) ? r.topics[0]?.name : r.topics?.name) ?? "—",
      min: r.work_min as number,
    }))
    .filter((t) => t.min > 0)
    .sort((a, b) => b.min - a.min);
}

// Bir yıl içinde habit bazında konu dağılımı (istatistik için)
export async function loadYearTopicStats(
  year: number
): Promise<Record<string, TopicMinute[]>> {
  const { data, error } = await supabase
    .from("topic_minutes")
    .select("habit_id,topic_id,work_min,topics(name)")
    .gte("day", `${year}-01-01`)
    .lte("day", `${year}-12-31`);
  if (error) throw error;
  const byHabit = new Map<string, Map<string, { name: string; min: number }>>();
  for (const r of ((data ?? []) as any[])) {
    let m = byHabit.get(r.habit_id);
    if (!m) {
      m = new Map();
      byHabit.set(r.habit_id, m);
    }
    const tname =
      (Array.isArray(r.topics) ? r.topics[0]?.name : r.topics?.name) ?? "—";
    const cur = m.get(r.topic_id);
    if (cur) cur.min += r.work_min;
    else m.set(r.topic_id, { name: tname, min: r.work_min });
  }
  const out: Record<string, TopicMinute[]> = {};
  for (const [habitId, m] of byHabit) {
    out[habitId] = [...m.entries()]
      .map(([topicId, v]) => ({ topicId, name: v.name, min: v.min }))
      .filter((t) => t.min > 0)
      .sort((a, b) => b.min - a.min);
  }
  return out;
}

// ── Etkinlik detay sayfası (ad, kategoriler, zaman istatistikleri, sağlık) ──

export type HabitTimeStats = {
  allTime: number;
  year: number;
  month: number;
  week: number;
};

export type HabitTopicDetail = Topic & HabitTimeStats & { createdAt: string };

// Etkinlik sağlığı: son (en fazla 7, etkinlik daha yeniyse ömrü kadar) gün
// içinde kaç farklı günde çalışma yapıldığına dayanır. Az da olsa her gün
// çalışılan etkinlikler yüksek, günlerdir dokunulmayanlar düşük skor alır.
export type HabitHealth = {
  score: number; // 0..100
  activeDays: number;
  windowDays: number;
  lastActiveDay: string | null;
};

export type HabitDetail = {
  createdAt: string; // YYYY-MM-DD
  stats: HabitTimeStats;
  health: HabitHealth;
  topics: HabitTopicDetail[];
};

function sumTimeStats(
  rows: { day: string; work_min: number }[],
  yearStart: string,
  monthStart: string,
  weekStart: string
): HabitTimeStats {
  let allTime = 0,
    year = 0,
    month = 0,
    week = 0;
  for (const r of rows) {
    allTime += r.work_min;
    if (r.day >= yearStart) year += r.work_min;
    if (r.day >= monthStart) month += r.work_min;
    if (r.day >= weekStart) week += r.work_min;
  }
  return { allTime, year, month, week };
}

export async function loadHabitDetail(habitId: string): Promise<HabitDetail> {
  const today = new Date();
  const todayISO = toISODate(today);
  const yearStart = `${today.getFullYear()}-01-01`;
  const monthStart = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const weekStart = toISODate(mondayOf(today));

  const [habitRes, entriesRes, topicsRes, topicMinRes] = await Promise.all([
    supabase.from("habits").select("created_at").eq("id", habitId).single(),
    supabase.from("entries").select("day,work_min").eq("habit_id", habitId),
    supabase
      .from("topics")
      .select("id,habit_id,name,created_at")
      .eq("habit_id", habitId)
      .order("created_at", { ascending: true }),
    supabase.from("topic_minutes").select("topic_id,day,work_min").eq("habit_id", habitId),
  ]);
  if (habitRes.error) throw habitRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (topicsRes.error) throw topicsRes.error;
  if (topicMinRes.error) throw topicMinRes.error;

  const entryRows = (entriesRes.data as { day: string; work_min: number }[]) ?? [];
  const stats = sumTimeStats(entryRows, yearStart, monthStart, weekStart);

  const createdAt = (
    (habitRes.data as { created_at: string } | null)?.created_at ?? today.toISOString()
  ).slice(0, 10);
  const daysSinceCreated = Math.max(
    0,
    Math.round(
      (new Date(todayISO + "T00:00:00").getTime() -
        new Date(createdAt + "T00:00:00").getTime()) /
        86400000
    )
  );
  const windowDays = Math.min(7, daysSinceCreated + 1);
  const windowStart = toISODate(addDays(todayISO, -(windowDays - 1)));
  const activeDaySet = new Set(
    entryRows
      .filter((r) => r.day >= windowStart && r.day <= todayISO && r.work_min > 0)
      .map((r) => r.day)
  );
  const lastActiveDay =
    entryRows
      .filter((r) => r.work_min > 0)
      .map((r) => r.day)
      .sort()
      .pop() ?? null;
  const score = windowDays > 0 ? Math.round((activeDaySet.size / windowDays) * 100) : 0;

  const topicMinRows =
    (topicMinRes.data as { topic_id: string; day: string; work_min: number }[]) ?? [];
  const byTopic = new Map<string, { day: string; work_min: number }[]>();
  for (const r of topicMinRows) {
    let arr = byTopic.get(r.topic_id);
    if (!arr) {
      arr = [];
      byTopic.set(r.topic_id, arr);
    }
    arr.push(r);
  }

  const topics: HabitTopicDetail[] = (
    (topicsRes.data as { id: string; habit_id: string; name: string; created_at: string }[]) ?? []
  ).map((t) => ({
    id: t.id,
    habitId: t.habit_id,
    name: t.name,
    createdAt: t.created_at.slice(0, 10),
    ...sumTimeStats(byTopic.get(t.id) ?? [], yearStart, monthStart, weekStart),
  }));

  return {
    createdAt,
    stats,
    health: { score, activeDays: activeDaySet.size, windowDays, lastActiveDay },
    topics,
  };
}

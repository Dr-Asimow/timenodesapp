import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ActiveTimer, Goal, Reminder, TimerConfig, TimerSettings, TopicMinute, WeekData } from "./types";
import { supabase } from "./supabase";
import {
  loadWeek,
  insertHabit,
  sendCongratsEmail,
  deleteHabit,
  updateHabitPosition,
  updateHabitColor,
  updateHabitName,
  upsertEntry,
  setDayNote,
  loadDayTodos,
  loadOverdueTodos,
  addTodo,
  updateTodoDay,
  setTodoDone,
  deleteTodo,
  loadDayPage,
  saveDayPage,
  loadGoals,
  addGoal,
  deleteGoal,
  loadReminders,
  addReminder,
  deleteReminder,
  loadTopics,
  addTopic,
  deleteTopic,
  addTopicMinutes,
} from "./db";
import {
  mondayOf,
  toISODate,
  addDays,
  loadTimers,
  saveTimers,
  weeksOfYear,
} from "./storage";
import {
  loadYearTotals,
  loadYearStats,
  loadYearTopicStats,
  loadHabitTotalsForWeek,
  loadMyFriendCode,
  type YearStats,
} from "./db";
import {
  isRunning,
  settle,
  workMinutes,
  workTotalMs,
  breakTotalMs,
  targetReached,
  phaseAcked,
} from "./timer";
import { playAlarm } from "./alarm";
import { Login } from "./components/Login";
import { WeekGrid } from "./components/WeekGrid";
import { Brand, LoadingScreen } from "./components/Brand";
import { type View, initials } from "./components/Home";
import { Profile } from "./components/Profile";
import { FriendsPage } from "./components/FriendsPage";
import { WeeksPage } from "./components/WeeksPage";
import { Stats } from "./components/Stats";
import { TimerPanel } from "./components/TimerPanel";
import { RightPanel } from "./components/RightPanel";
import { ShopPage } from "./components/ShopPage";
import { NotePage } from "./components/note/NotePage";
import { HabitDetailPage } from "./components/HabitDetailPage";
import { MusicFloating } from "./components/AmbientPlayer";
import { useMusicFavorites } from "./useMusicFavorites";
import Dock from "./components/Dock";
import { IconCoin, IconWarning, IconBell } from "./components/Icons";
import type { DockItemData } from "./components/Dock";
import {
  playAmbient,
  stopAmbient,
  setAmbientVolume,
  getAmbientVolume,
  type AmbientId,
} from "./ambient";
import { useYouTube } from "./useYouTube";
import { FlyParticles, type Burst } from "./components/Particles";

/* ── Sidebar ikon bileşenleri ────────────────────────────── */
function WeekIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="6" height="6" rx="1"/>
      <rect x="10.5" y="1.5" width="6" height="6" rx="1"/>
      <rect x="1.5" y="10.5" width="6" height="6" rx="1"/>
      <rect x="10.5" y="10.5" width="6" height="6" rx="1"/>
    </svg>
  );
}
function WeeksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="13" rx="1.5"/>
      <path d="M2 7h14"/>
      <path d="M6 1v4M12 1v4"/>
    </svg>
  );
}
function StatsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect x="2"  y="10" width="4" height="7" rx="1" opacity="0.75"/>
      <rect x="7"  y="6"  width="4" height="11" rx="1"/>
      <rect x="12" y="2"  width="4" height="15" rx="1" opacity="0.85"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5"/>
      <path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4M14.2 14.2l-1.4-1.4M5.2 5.2 3.8 3.8"/>
    </svg>
  );
}
function FriendsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="6" r="2.5"/>
      <path d="M2 15.5c0-2.6 2-4.2 4.5-4.2s4.5 1.6 4.5 4.2"/>
      <path d="M12.3 4a2.3 2.3 0 0 1 0 4.4"/>
      <path d="M13.4 11.5c1.6.4 2.6 1.7 2.6 4"/>
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2h2l2.5 8h7l1.5-5H5.5"/>
      <circle cx="7.5" cy="14.5" r="1"/>
      <circle cx="13.5" cy="14.5" r="1"/>
    </svg>
  );
}
import type { TodoItem } from "./types";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DAYS = [
  "PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ",
];

const sameCell = (t: ActiveTimer, habitId: string, day: number) =>
  t.habitId === habitId && t.day === day;

function newTimer(habitId: string, day: number, config: TimerConfig): ActiveTimer {
  return {
    habitId,
    day,
    phase: "work",
    startedAt: Date.now(),
    workMs: 0,
    breakMs: 0,
    workTargetMs: config.workTargetMs,
    breakTargetMs: null,
    plannedBreakMs: config.plannedBreakMs,
    workAlarmAck: false,
    breakAlarmAck: false,
    cyclesTotal: Math.max(1, config.cycles),
    cyclesDone: 0,
    topicId: config.topicId,
    topicName: config.topicName,
  };
}


export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [week, setWeek] = useState<WeekData | null>(null);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View>("week");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [firedReminder, setFiredReminder] = useState<Reminder | null>(null);
  const firedIdsRef = useRef<Set<string>>(new Set());
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    try {
      const s = localStorage.getItem("tn.timer-settings");
      return s ? JSON.parse(s) : { alarmEnabled: true, autoBreak: true };
    } catch { return { alarmEnabled: true, autoBreak: true }; }
  });
  // Ambient ses oynatıcısı durumu (motor src/ambient.ts'te, ses kesilmez)
  const [ambient, setAmbient] = useState<{ id: AmbientId | null; playing: boolean }>(
    { id: null, playing: false }
  );
  const [ambientVol, setAmbientVol] = useState(() => getAmbientVolume());
  const [ambientCollapsed, setAmbientCollapsed] = useState(true);
  // YouTube müzik motoru (iframe App kökünde sabit → sayfa değişince kesilmez)
  const yt = useYouTube();
  // Güncel hafta dışında bir hafta görüntülenirken o haftanın verisi (null=güncel)
  const [viewedWeek, setViewedWeek] = useState<WeekData | null>(null);
  const [yearTotals, setYearTotals] = useState<Record<number, number[]> | null>(
    null
  );
  const [yearStats, setYearStats] = useState<YearStats | null>(null);
  const [yearTopics, setYearTopics] = useState<Record<string, TopicMinute[]>>({});
  // Gösterilen haftanın bir öncesinin alışkanlık-bazlı toplamları
  const [prevTotals, setPrevTotals] = useState<Record<string, number> | null>(
    null
  );
  // Bugünün gündemi (to-do + seçilen alışkanlıklar)
  const [todos, setTodos] = useState<TodoItem[]>([]);
  // Günü geçmiş, yapılmamış to-do'lar (sağ panel "Geciken" bölümü)
  const [overdueTodos, setOverdueTodos] = useState<TodoItem[]>([]);
  // Kullanıcının benzersiz UID'i (arkadaş kodu) — profiles'tan
  const [friendCode, setFriendCode] = useState<string | null>(null);
  // Günlük (Not Defteri, tam ekran) — açık gün + etiket
  const [noteTarget, setNoteTarget] = useState<{
    day: string;
    label: string;
  } | null>(null);
  // Etkinlik sayfası (tam ekran) — açık etkinlik id + adı
  const [habitPageTarget, setHabitPageTarget] = useState<{
    habitId: string;
    name: string;
  } | null>(null);
  // Seçili hücre (popover) — hem ızgaradan hem gündemden açılabilsin diye App'te
  const [cellSel, setCellSel] = useState<{ habitId: string; day: number } | null>(
    null
  );
  // "Bitir & kaydet" partikül efekti
  const [bursts, setBursts] = useState<Burst[]>([]);
  // Popup'tan bitirildiğinde: popup kapanınca patlat (kaynak = modal konumu)
  const pendingBurstRef = useRef<{ fromRect: DOMRect; habitId: string; day: number } | null>(null);

  // DB yazımlarını sıraya dizen zincir (yarış/FK sorunlarını önler)
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // Gündeme otomatik eklenmekte olan alışkanlıklar (çift ekleme önler)
  const autoAddingRef = useRef<Set<string>>(new Set());
  // Veri yüklendiği takvim günü (gün dönünce otomatik yenileme için)
  const dayRef = useRef<string>(toISODate(new Date()));
  // Interval içinden güncel değerlere erişim için ref'ler
  const timersRef = useRef<ActiveTimer[]>([]);
  const finishTimerRef = useRef<(t: ActiveTimer) => void>(() => {});
  const autoAdvanceRef = useRef<(t: ActiveTimer) => void>(() => {});
  const timerSettingsRef = useRef<TimerSettings>(timerSettings);
  const lastAlarmRef = useRef<number>(0);
  // Günlük/modal açıkken otomatik yenilemeyi ertele (kullanıcıyı kesmesin)
  const reloadBlockedRef = useRef(false);
  // Oturum içinde tebrik mailini en çok bir kez tetiklemek için (asıl tek-seferlik
  // garanti Edge Function'daki profiles.congrats_email_sent bayrağında)
  const congratsSentRef = useRef(false);

  const userId = session?.user?.id ?? null;
  // Favori müzik kütüphanesi (Supabase'e kaydedilir)
  const musicFavs = useMusicFavorites(userId);
  const username =
    (session?.user?.user_metadata?.username as string) ??
    session?.user?.email?.split("@")[0] ??
    "";

  // Oturum takibi
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Oturum varken bu haftanın verisini DB'den + sayaçları yerelden yükle
  useEffect(() => {
    if (!userId) {
      setWeek(null);
      setTimers([]);
      return;
    }
    setTimers(loadTimers(userId));
    let cancel = false;
    setErr(null);
    (async () => {
      try {
        const w = await loadWeek(toISODate(mondayOf(new Date())));
        if (!cancel) setWeek(w);
      } catch (e) {
        if (!cancel) {
          const msg =
            e instanceof Error
              ? e.message
              : e && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message)
              : "Yükleme hatası";
          setErr(msg);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId]);

  // Haftalar sayfasına girince yıl toplamlarını çek
  useEffect(() => {
    if (view === "weeks" && week) {
      loadYearTotals(week.year)
        .then(setYearTotals)
        .catch(() => {});
    }
  }, [view, week?.year]);

  // İstatistik/Haftalar sayfasına girince yıl istatistiklerini çek (Haftalar'daki
  // ısı haritası gün popup'ı da habitSeries'ten beslenir). Konu dağılımı yalnız stats.
  useEffect(() => {
    if ((view === "stats" || view === "weeks") && week) {
      setYearStats(null);
      loadYearStats(week.year)
        .then(setYearStats)
        .catch(() => {});
    }
    if (view === "stats" && week) {
      loadYearTopicStats(week.year)
        .then(setYearTopics)
        .catch(() => {});
    }
  }, [view, week?.year]);

  // Gösterilen haftanın bir öncesinin (geçen hafta) alışkanlık toplamları
  useEffect(() => {
    const start = (viewedWeek ?? week)?.startDate;
    if (!userId || !start) {
      setPrevTotals(null);
      return;
    }
    let cancel = false;
    setPrevTotals(null);
    loadHabitTotalsForWeek(toISODate(addDays(start, -7)))
      .then((t) => {
        if (!cancel) setPrevTotals(t);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [userId, viewedWeek?.startDate, week?.startDate]);

  // Bugünün gündemini (to-do'lar) + geciken to-do'ları yükle
  useEffect(() => {
    if (!userId) {
      setTodos([]);
      setOverdueTodos([]);
      return;
    }
    let cancel = false;
    loadDayTodos(toISODate(new Date()))
      .then((t) => {
        if (!cancel) setTodos(t);
      })
      .catch(() => {});
    loadOverdueTodos(toISODate(new Date()))
      .then((t) => {
        if (!cancel) setOverdueTodos(t);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [userId]);

  // Kullanıcının benzersiz UID'ini (arkadaş kodu) yükle
  useEffect(() => {
    if (!userId) {
      setFriendCode(null);
      return;
    }
    let cancel = false;
    loadMyFriendCode()
      .then((c) => {
        if (!cancel) setFriendCode(c);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [userId]);

  // Sayaçları (cihaz-yerel) değiştikçe localStorage'a yaz
  useEffect(() => {
    if (userId) saveTimers(userId, timers);
  }, [timers, userId]);

  // Gün dönümü + 8 saat sınırı (tek interval, ref'lerle güncel değerler):
  // - Çalışan sayaç 8 saati aşarsa otomatik bitir.
  // - Yeni güne geçildiyse: çalışan sayaç VARSA ertele (başladığı güne yazsın),
  //   çalışan sayaç YOKSA sayfayı yenile → sonraki sayaçlar yeni günde başlar.
  useEffect(() => {
    if (!userId) return;
    const EIGHT_H = 8 * 3600 * 1000;
    const id = setInterval(() => {
      const ts = timersRef.current;
      const capped = ts.find(
        (t) => isRunning(t) && workTotalMs(t) + breakTotalMs(t) >= EIGHT_H
      );
      if (capped) {
        finishTimerRef.current(capped);
        return;
      }
      if (
        toISODate(new Date()) !== dayRef.current &&
        !ts.some((t) => isRunning(t)) &&
        !reloadBlockedRef.current
      ) {
        location.reload();
      }
    }, 20000);
    return () => clearInterval(id);
  }, [userId]);

  // Pomodoro: hedef dolunca alarm çal + (autoBreak açıksa) otomatik faz geçişi.
  // Saniyede bir kontrol; ref'lerle güncel timers/ayarlara erişir.
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      const ts = timersRef.current;
      const st = timerSettingsRef.current;
      const ringing = ts.find(
        (t) => isRunning(t) && targetReached(t) && !phaseAcked(t)
      );
      if (!ringing) return;
      if (st.alarmEnabled && Date.now() - lastAlarmRef.current >= 2400) {
        playAlarm();
        lastAlarmRef.current = Date.now();
      }
      if (st.autoBreak) {
        autoAdvanceRef.current(ringing);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [userId]);

  // Popup kapandığında (cellSel→null) bekleyen "bitir" partikülünü patlat
  useEffect(() => {
    if (cellSel === null && pendingBurstRef.current) {
      const pb = pendingBurstRef.current;
      pendingBurstRef.current = null;
      // Popup kapanma animasyonu bitsin, hücre görünür olsun diye küçük gecikme
      const t = setTimeout(
        () => fireBurst(pb.fromRect, pb.habitId, pb.day),
        60
      );
      return () => clearTimeout(t);
    }
  }, [cellSel]);

  // Bugüne ait bir sayaç (haftalıktan vb.) başlatıldıysa ve o alışkanlık
  // gündemde yoksa otomatik gündeme ekle.
  useEffect(() => {
    if (!userId || !week) return;
    const tISO = toISODate(new Date());
    const tIdx = Math.round(
      (Date.parse(tISO) - Date.parse(week.startDate)) / 86400000
    );
    if (tIdx < 0 || tIdx > 6) return;
    const inAgenda = new Set(
      todos.filter((t) => t.habitId).map((t) => t.habitId)
    );
    const seen = new Set<string>();
    for (const tm of timers) {
      if (tm.day !== tIdx || inAgenda.has(tm.habitId)) continue;
      if (autoAddingRef.current.has(tm.habitId) || seen.has(tm.habitId)) continue;
      const habit = week.habits.find((h) => h.id === tm.habitId);
      if (!habit) continue;
      seen.add(tm.habitId);
      autoAddingRef.current.add(tm.habitId);
      addTodo(userId, tISO, tm.habitId, habit.name, todos.length)
        .then((item) =>
          setTodos((cur) =>
            cur.some((x) => x.habitId === item.habitId) ? cur : [...cur, item]
          )
        )
        .catch(() => {})
        .finally(() => autoAddingRef.current.delete(tm.habitId));
    }
  }, [timers, todos, userId, week]);

  // Bugünkü hedefleri ve hatırlatıcıları yükle
  useEffect(() => {
    if (!userId) { setGoals([]); setReminders([]); return; }
    const todayISO = toISODate(new Date());
    loadGoals(todayISO).then(setGoals).catch(() => {});
    loadReminders(userId).then(setReminders).catch(() => {});
  }, [userId]);

  // Hatırlatıcı alarm kontrolü — her 15 saniyede zamanı gelen hatırlatıcıyı tetikle
  useEffect(() => {
    if (!userId) return;
    const check = () => {
      const now = Date.now();
      for (const r of reminders) {
        if (firedIdsRef.current.has(r.id)) continue;
        if (new Date(r.target_at).getTime() <= now) {
          firedIdsRef.current.add(r.id);
          setFiredReminder(r);
          playAlarm();
          break;
        }
      }
    };
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [userId, reminders]);

  // --- DB kalıcılığı: eski vs yeni haftayı diff'leyip yaz ---
  function persist(oldW: WeekData, newW: WeekData) {
    const job = async () => {
      const oldIds = new Set(oldW.habits.map((h) => h.id));
      const newIds = new Set(newW.habits.map((h) => h.id));
      // eklenen alışkanlıklar
      for (let i = 0; i < newW.habits.length; i++) {
        const h = newW.habits[i];
        if (!oldIds.has(h.id)) {
          await insertHabit(h.id, h.name, i);
          // Kullanıcının manuel eklediği ilk alışkanlık → tebrik maili (fire-and-forget)
          if (!congratsSentRef.current) {
            congratsSentRef.current = true;
            void sendCongratsEmail();
          }
        }
      }
      // silinen alışkanlıklar
      for (const h of oldW.habits) {
        if (!newIds.has(h.id)) await deleteHabit(h.id);
      }
      // yeniden sıralama: sıra değiştiyse mevcut alışkanlıkların pozisyonunu güncelle
      const oldOrder = oldW.habits.map((h) => h.id).join(",");
      const newOrder = newW.habits.map((h) => h.id).join(",");
      if (oldOrder !== newOrder) {
        for (let i = 0; i < newW.habits.length; i++) {
          const h = newW.habits[i];
          if (oldIds.has(h.id)) await updateHabitPosition(h.id, i);
        }
      }
      // değişen hücreler (çalışma / mola / aktivite notu)
      for (const h of newW.habits) {
        for (let d = 0; d < 7; d++) {
          const nw = newW.minutes[h.id]?.[d] ?? 0;
          const nb = newW.breaks[h.id]?.[d] ?? 0;
          const nn = newW.notes[h.id]?.[d] ?? null;
          const ow = oldW.minutes[h.id]?.[d] ?? 0;
          const ob = oldW.breaks[h.id]?.[d] ?? 0;
          const on = oldW.notes[h.id]?.[d] ?? null;
          if (nw !== ow || nb !== ob || (nn ?? "") !== (on ?? "")) {
            await upsertEntry(
              h.id,
              toISODate(addDays(newW.startDate, d)),
              nw,
              nb,
              nn
            );
          }
        }
      }
      // değişen gün notları
      for (let d = 0; d < 7; d++) {
        const nn = newW.dayNotes[d] ?? "";
        const on = oldW.dayNotes[d] ?? "";
        if (nn !== on && userId) {
          await setDayNote(userId, toISODate(addDays(newW.startDate, d)), nn);
        }
      }
    };
    chain.current = chain.current
      .then(job)
      .catch((e) => setErr(e instanceof Error ? e.message : "Kayıt hatası"));
  }

  // Bir etkinliğin rengini güncelle: yerel state (güncel + görüntülenen hafta) + DB
  function setHabitColor(habitId: string, color: string | null) {
    const update = (w: WeekData): WeekData => ({
      ...w,
      habits: w.habits.map((h) => (h.id === habitId ? { ...h, color } : h)),
    });
    setWeek((w) => (w ? update(w) : w));
    setViewedWeek((w) => (w ? update(w) : w));
    chain.current = chain.current
      .then(() => updateHabitColor(habitId, color))
      .catch((e) => setErr(e instanceof Error ? e.message : "Renk kaydedilemedi"));
  }

  // Bir etkinliğin adını güncelle: yerel state (güncel + görüntülenen hafta) + DB
  function setHabitName(habitId: string, name: string) {
    const n = name.trim();
    if (!n) return;
    const update = (w: WeekData): WeekData => ({
      ...w,
      habits: w.habits.map((h) => (h.id === habitId ? { ...h, name: n } : h)),
    });
    setWeek((w) => (w ? update(w) : w));
    setViewedWeek((w) => (w ? update(w) : w));
    chain.current = chain.current
      .then(() => updateHabitName(habitId, n))
      .catch((e) => setErr(e instanceof Error ? e.message : "Ad kaydedilemedi"));
  }

  // Hafta değişimini uygula: doğru haftayı (güncel ya da görüntülenen) güncelle + DB'ye yaz
  function applyWeek(newWeek: WeekData) {
    if (week && newWeek.startDate === week.startDate) {
      const old = week;
      setWeek(newWeek);
      persist(old, newWeek);
    } else {
      const old = viewedWeek;
      setViewedWeek(newWeek);
      if (old) persist(old, newWeek);
    }
  }

  // Haftalar sayfasından bir haftayı aç
  async function openWeek(startISO: string) {
    setCellSel(null);
    if (week && startISO === week.startDate) {
      setViewedWeek(null); // güncel hafta
      setView("week");
      return;
    }
    try {
      const w = await loadWeek(startISO);
      setViewedWeek(w);
      setView("week");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hafta yüklenemedi");
    }
  }

  // Menü gezinmesi: "week"e gidince hep güncel haftayı göster
  function navigate(v: View) {
    if (v === "week") setViewedWeek(null);
    setCellSel(null);
    setView(v);
  }

  // --- Sayaç işlemleri (cihaz-yerel) ---
  const updateTimer = (next: ActiveTimer) =>
    setTimers(timers.map((t) => (sameCell(t, next.habitId, next.day) ? next : t)));

  const doStart = (
    habitId: string,
    day: number,
    config: TimerConfig,
    pauseOthers: boolean
  ) => {
    let next = timers.map((t) =>
      pauseOthers && isRunning(t) && !sameCell(t, habitId, day) ? settle(t) : t
    );
    const idx = next.findIndex((t) => sameCell(t, habitId, day));
    if (idx >= 0) {
      if (!isRunning(next[idx])) {
        next = next.slice();
        next[idx] = { ...next[idx], startedAt: Date.now() };
      }
    } else {
      next = [...next, newTimer(habitId, day, config)];
    }
    setTimers(next);
  };

  // Tek sayaç modu: yeni sayaç başlatılınca çalışan diğer sayaçlar otomatik duraklatılır
  const requestStart = (habitId: string, day: number, config: TimerConfig) => {
    doStart(habitId, day, config, true);
  };

  // Ambient ses: aynı sese basınca durdur, farklıya basınca onu çal
  const toggleAmbient = (id: AmbientId) => {
    if (ambient.id === id && ambient.playing) {
      stopAmbient();
      setAmbient({ id, playing: false });
    } else {
      playAmbient(id);
      setAmbient({ id, playing: true });
    }
  };
  const changeAmbientVol = (v: number) => {
    setAmbientVolume(v);
    setAmbientVol(v);
  };

  const pauseTimer = (target: ActiveTimer) => updateTimer(settle(target));

  const ackAlarm = (target: ActiveTimer) =>
    updateTimer(
      target.phase === "work"
        ? { ...target, workAlarmAck: true }
        : { ...target, breakAlarmAck: true }
    );

  const startBreak = (target: ActiveTimer, breakTargetMs: number | null) => {
    const s = settle(target);
    updateTimer({
      ...s,
      phase: "break",
      startedAt: Date.now(),
      breakTargetMs,
      workAlarmAck: true,
      breakAlarmAck: false,
    });
  };

  const resumeWork = (target: ActiveTimer) => {
    const s = settle(target);
    updateTimer({ ...s, phase: "work", startedAt: Date.now(), breakAlarmAck: true });
  };

  // Kaynak dikdörtgenden hedef hücreye partikül patlat
  const fireBurst = (fromRect: DOMRect, habitId: string, day: number) => {
    const cell = document.querySelector(
      `[data-cell-id="${habitId}:${day}"]`
    ) as HTMLElement | null;
    if (!cell) return;
    const to = cell.getBoundingClientRect();
    setBursts((b) => [
      ...b,
      {
        id: Date.now() + Math.random(),
        from: {
          x: fromRect.left + fromRect.width / 2,
          y: fromRect.top + fromRect.height / 2,
        },
        to: { x: to.left + to.width / 2, y: to.top + to.height / 2 },
      },
    ]);
  };

  const finishTimer = (target: ActiveTimer) => {
    // Partikül kaynağını yakala: popup açıksa modal, değilse üst çubuk
    const popupOpen =
      cellSel &&
      cellSel.habitId === target.habitId &&
      cellSel.day === target.day;
    if (popupOpen) {
      const modal = document.querySelector(".cell-modal") as HTMLElement | null;
      if (modal)
        pendingBurstRef.current = {
          fromRect: modal.getBoundingClientRect(),
          habitId: target.habitId,
          day: target.day,
        };
    } else {
      const bar = document.querySelector(
        `[data-timer="${target.habitId}:${target.day}"]`
      ) as HTMLElement | null;
      if (bar) fireBurst(bar.getBoundingClientRect(), target.habitId, target.day);
    }

    const mins = workMinutes(target);
    const brkMins = Math.round(breakTotalMs(target) / 60000);
    commitToWeek(target.habitId, target.day, mins, brkMins);
    commitTopic(target.habitId, target.day, target.topicId, mins);
    setTimers(timers.filter((t) => !sameCell(t, target.habitId, target.day)));
  };

  // Verilen çalışma/mola dakikalarını ilgili hücreye EKLER (döngü geçişi ve
  // finishTimer ortak kullanır). 0 ise o tür yazılmaz.
  const commitToWeek = (
    habitId: string,
    day: number,
    mins: number,
    brkMins: number
  ) => {
    if (!week || (mins <= 0 && brkMins <= 0)) return;
    const w: WeekData = { ...week };
    if (mins > 0) {
      const row = (w.minutes[habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
      row[day] += mins;
      w.minutes = { ...w.minutes, [habitId]: row };
    }
    if (brkMins > 0) {
      const br = (w.breaks[habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
      br[day] += brkMins;
      w.breaks = { ...w.breaks, [habitId]: br };
    }
    applyWeek(w);
  };

  // Konu varsa o günün konu kırılımına çalışma dakikasını ekler (Supabase)
  const commitTopic = (
    habitId: string,
    day: number,
    topicId: string | null,
    mins: number
  ) => {
    if (!userId || !topicId || mins <= 0 || !week) return;
    const dayISO = toISODate(addDays(week.startDate, day));
    addTopicMinutes(userId, habitId, dayISO, topicId, mins).catch(() => {});
  };

  // Pomodoro otomatik faz geçişi (autoBreak açıkken hedef dolunca interval çağırır):
  // odak bitti → o döngünün süresini hücreye yaz, son döngüyse sayacı bitir,
  // değilse molaya geç. Mola bitti → molayı yaz, yeni odak fazına geç.
  const autoAdvance = (t: ActiveTimer) => {
    const s = settle(t); // canlı segment workMs/breakMs'e katıldı
    if (t.phase === "work") {
      const wMin = Math.round(s.workMs / 60000);
      commitToWeek(t.habitId, t.day, wMin, 0);
      commitTopic(t.habitId, t.day, t.topicId, wMin);
      const done = t.cyclesDone + 1;
      if (done >= t.cyclesTotal) {
        // Tüm döngüler tamamlandı → sayacı kaldır (son odaktan sonra mola yok)
        setTimers(timers.filter((x) => !sameCell(x, t.habitId, t.day)));
      } else {
        updateTimer({
          ...s,
          phase: "break",
          startedAt: Date.now(),
          workMs: 0,
          breakMs: 0,
          breakTargetMs: t.plannedBreakMs,
          workAlarmAck: false,
          breakAlarmAck: false,
          cyclesDone: done,
        });
      }
    } else {
      commitToWeek(t.habitId, t.day, 0, Math.round(s.breakMs / 60000));
      updateTimer({
        ...s,
        phase: "work",
        startedAt: Date.now(),
        workMs: 0,
        breakMs: 0,
        breakTargetMs: null,
        workAlarmAck: false,
        breakAlarmAck: false,
      });
    }
  };

  const cancelTimer = (target: ActiveTimer) =>
    setTimers(timers.filter((t) => !sameCell(t, target.habitId, target.day)));

  // Interval ref'lerini her render'da güncel tut
  timersRef.current = timers;
  finishTimerRef.current = finishTimer;
  autoAdvanceRef.current = autoAdvance;
  timerSettingsRef.current = timerSettings;
  reloadBlockedRef.current = noteTarget !== null || habitPageTarget !== null;

  // --- Render ---
  if (!authReady) return <LoadingScreen />;
  if (!session) return <Login />;
  if (!week) return <LoadingScreen error={err} />;

  const weekTotalMin = week.habits.reduce(
    (a, h) => a + (week.minutes[h.id] ?? []).reduce((s, m) => s + m, 0),
    0
  );
  const coins = weekTotalMin; // placeholder: 1 dk = 1 time coin (gamify sonra)
  // Gerçek e-posta artık auth kimliği (giriş e-postası)
  const contactEmail = session.user.email ?? "";
  const displayName =
    (session.user.user_metadata?.display_name as string) || username;
  const avatarUrl =
    (session.user.user_metadata?.avatar_url as string) || null;
  const memberSince = session.user.created_at;

  // Hafta görünümünde gösterilen hafta (güncel ya da Haftalar'dan seçilen)
  const shownWeek = viewedWeek ?? week;
  const viewingOther = viewedWeek !== null;

  // --- Bugün paneli (sol) için hesaplamalar ---
  const today = new Date();
  const todayISO = toISODate(today);
  const todayIndex = Math.round(
    (Date.parse(todayISO) - Date.parse(week.startDate)) / 86400000
  );
  const todayInWeek = todayIndex >= 0 && todayIndex <= 6;
  const dateLabel = `${String(today.getDate()).padStart(2, "0")} ${
    TR_MONTHS[today.getMonth()]
  }`;
  const dayName = TR_DAYS[today.getDay()];
  const todayMinutes: Record<string, number> = {};
  for (const h of week.habits)
    todayMinutes[h.id] = todayInWeek ? week.minutes[h.id]?.[todayIndex] ?? 0 : 0;
  const runningHabitIds = new Set(
    timers.filter((t) => isRunning(t) && t.day === todayIndex).map((t) => t.habitId)
  );
  // Gündem handler'ları
  const addHabitItem = async (habitId: string, habitName: string) => {
    if (!userId || todos.some((t) => t.habitId === habitId)) return;
    try {
      const item = await addTodo(userId, todayISO, habitId, habitName, todos.length);
      setTodos((cur) => [...cur, item]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gündem eklenemedi");
    }
  };
  const addTodoItem = async (title: string) => {
    if (!userId) return;
    try {
      const item = await addTodo(userId, todayISO, null, title, todos.length);
      setTodos((cur) => [...cur, item]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yapılacak eklenemedi");
    }
  };
  const toggleTodo = (id: string, done: boolean) => {
    setTodos((cur) => cur.map((t) => (t.id === id ? { ...t, done } : t)));
    setTodoDone(id, done).catch(() => {});
  };
  const deleteItem = (id: string) => {
    setTodos((cur) => cur.filter((t) => t.id !== id));
    deleteTodo(id).catch(() => {});
  };
  // Geciken to-do işlemleri
  const moveOverdueToToday = (id: string) => {
    const item = overdueTodos.find((t) => t.id === id);
    if (!item) return;
    setOverdueTodos((cur) => cur.filter((t) => t.id !== id));
    setTodos((cur) => [...cur, { ...item, day: todayISO }]);
    updateTodoDay(id, todayISO).catch(() => {});
  };
  const completeOverdue = (id: string) => {
    setOverdueTodos((cur) => cur.filter((t) => t.id !== id));
    setTodoDone(id, true).catch(() => {});
  };
  const deleteOverdue = (id: string) => {
    setOverdueTodos((cur) => cur.filter((t) => t.id !== id));
    deleteTodo(id).catch(() => {});
  };
  // Hatırlatıcı ekle (sağ panel + takvim ortak)
  const addReminderItem = async (title: string, targetAt: string, description?: string) => {
    if (!userId) return;
    try {
      const r = await addReminder(userId, title, targetAt, description);
      setReminders((cur) => [...cur, r]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as {message:string}).message) : String(e);
      console.error("Hatırlatıcı eklenemedi:", msg, e);
      setErr("Hatırlatıcı eklenemedi: " + msg);
    }
  };
  // Takvim popup'ından gün notu kaydet; gün açık haftadaysa state'i de tazele
  const saveCalDayNote = (dayISO: string, note: string) => {
    if (!userId) return;
    setDayNote(userId, dayISO, note).catch(() => {});
    const patch = (w: WeekData | null): WeekData | null => {
      if (!w) return w;
      const idx = Math.round((Date.parse(dayISO) - Date.parse(w.startDate)) / 86400000);
      if (idx < 0 || idx > 6) return w;
      const dayNotes = [...w.dayNotes];
      dayNotes[idx] = note || null;
      return { ...w, dayNotes };
    };
    setWeek((w) => patch(w));
    setViewedWeek((w) => patch(w));
  };
  // Takvimden to-do eklendi/değişti → bugünü ve gecikenleri tazele
  const calTodosChanged = (dayISO: string) => {
    if (dayISO === todayISO) {
      loadDayTodos(todayISO).then(setTodos).catch(() => {});
    } else if (dayISO < todayISO) {
      loadOverdueTodos(todayISO).then(setOverdueTodos).catch(() => {});
    }
  };
  // "başla": sayacı başlat VE kare popup'ını aç (haftalıktaki gibi açık kalsın)
  const startHabit = (habitId: string) => {
    if (!todayInWeek) return;
    requestStart(habitId, todayIndex, {
      workTargetMs: null,
      plannedBreakMs: null,
      cycles: 1,
      topicId: null,
      topicName: null,
    });
    setCellSel({ habitId, day: todayIndex });
  };
  // Gündemdeki etkinliğe tekrar tıkla → o karenin (sayaç) popup'ını aç
  const openHabit = (habitId: string) => {
    if (!todayInWeek) return;
    setCellSel({ habitId, day: todayIndex });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand-btn" onClick={() => navigate("week")}>
          <Brand size="sm" tagline={false} />
        </button>
        <div className="topbar-right" />
      </header>

      {err ? <div className="banner-err"><IconWarning size={14} /> {err}</div> : null}

      <main className="main">
        <div
          className={`page ${
            view === "week" && !viewingOther ? "wide" : ""
          }`}
        >
        {view === "week" ? (
          (() => {
            const grid = (
              <WeekGrid
                week={shownWeek}
                userId={userId ?? ""}
                activeTimers={viewingOther ? [] : timers}
                onChange={applyWeek}
                sel={cellSel}
                onSelChange={setCellSel}
                onOpenDayNote={(day, label) => setNoteTarget({ day, label })}
                onOpenHabitPage={(habitId, name) =>
                  setHabitPageTarget({ habitId, name })
                }
                prevTotals={prevTotals}
                viewingOther={viewingOther}
                onPrevWeek={() =>
                  openWeek(toISODate(addDays(shownWeek.startDate, -7)))
                }
                onNextWeek={() =>
                  openWeek(toISODate(addDays(shownWeek.startDate, 7)))
                }
                onToday={() => openWeek(week.startDate)}
              />
            );
            if (viewingOther) {
              return (
                <>
                  <div className="viewing-banner">
                    <span>
                      {shownWeek.weekNumber}. hafta görüntüleniyor (geçmiş kayıt)
                    </span>
                    <button
                      className="ghost-btn small"
                      onClick={() => {
                        setCellSel(null);
                        setViewedWeek(null);
                      }}
                    >
                      Güncel haftaya dön
                    </button>
                  </div>
                  <div className="week-main">{grid}</div>
                </>
              );
            }
            return (
              <div className="week-layout">
                <TimerPanel
                  timers={timers}
                  week={week}
                  todayIndex={todayIndex}
                  userId={userId ?? ""}
                  settings={timerSettings}
                  onUpdateSettings={(s) => {
                    setTimerSettings(s);
                    localStorage.setItem("tn.timer-settings", JSON.stringify(s));
                  }}
                  onPause={pauseTimer}
                  onResume={(t) =>
                    requestStart(t.habitId, t.day, {
                      workTargetMs: t.workTargetMs,
                      plannedBreakMs: t.plannedBreakMs,
                      cycles: t.cyclesTotal,
                      topicId: t.topicId,
                      topicName: t.topicName,
                    })
                  }
                  onStartBreak={startBreak}
                  onResumeWork={resumeWork}
                  onAck={ackAlarm}
                  onFinish={finishTimer}
                  onCancel={cancelTimer}
                  onStartNew={requestStart}
                />
                <div className="week-main">{grid}</div>
                <RightPanel
                  todos={todos}
                  overdueTodos={overdueTodos}
                  todayISO={todayISO}
                  goals={goals}
                  reminders={reminders}
                  onAddGoal={async (text) => {
                    if (!userId) return;
                    try {
                      const g = await addGoal(userId, todayISO, text);
                      setGoals((cur) => [...cur, g]);
                    } catch {}
                  }}
                  onDeleteGoal={async (id) => {
                    setGoals((cur) => cur.filter((g) => g.id !== id));
                    deleteGoal(id).catch(() => {});
                  }}
                  onAddReminder={addReminderItem}
                  onDeleteReminder={async (id) => {
                    setReminders((cur) => cur.filter((r) => r.id !== id));
                    deleteReminder(id).catch(() => {});
                  }}
                  onAddTodo={addTodoItem}
                  onToggleTodo={toggleTodo}
                  onDeleteItem={deleteItem}
                  onMoveOverdueToToday={moveOverdueToToday}
                  onCompleteOverdue={completeOverdue}
                  onDeleteOverdue={deleteOverdue}
                  yt={yt}
                  favs={musicFavs}
                  ambientId={ambient.id}
                  ambientPlaying={ambient.playing}
                  ambientVol={ambientVol}
                  onToggleAmbient={toggleAmbient}
                  onAmbientVol={changeAmbientVol}
                />
              </div>
            );
          })()
        ) : view === "weeks" ? (
          <WeeksPage
            year={week.year}
            weeks={weeksOfYear(week.year)}
            totals={yearTotals}
            habitSeries={yearStats?.habitSeries ?? null}
            reminders={reminders}
            currentStartISO={week.startDate}
            userId={userId ?? ""}
            onOpenWeek={openWeek}
            onOpenDayNote={(day, label) => setNoteTarget({ day, label })}
            onAddReminder={addReminderItem}
            onSaveDayNote={saveCalDayNote}
            onTodosChanged={calTodosChanged}
          />
        ) : view === "stats" ? (
          <Stats
            year={week.year}
            weekTotalMin={weekTotalMin}
            currentWeek={week.weekNumber}
            stats={yearStats}
            topicsByHabit={yearTopics}
          />
        ) : view === "friends" ? (
          <FriendsPage friendCode={friendCode} />
        ) : view === "shop" ? (
          <ShopPage />
        ) : (
          <Profile
            userId={userId ?? ""}
            username={username}
            displayName={displayName}
            contactEmail={contactEmail}
            avatarUrl={avatarUrl}
            memberSince={memberSince}
            friendCode={friendCode}
            weekTotalMin={weekTotalMin}
            coins={coins}
          />
        )}
        </div>
      </main>


      <FlyParticles
        bursts={bursts}
        onDone={(id) => setBursts((b) => b.filter((x) => x.id !== id))}
      />

      {/* YouTube iframe React dışında (body'de gizli host) tutulur; bkz.
          useYouTube. Burada ekstra bir mount gerekmez. */}

      {/* Hafta dışındaki sayfalarda yüzen müzik/ses oynatıcı (küçük kare).
          Hafta görünümünde sağ panelde zaten gömülü oynatıcı var. */}
      {view !== "week" ? (
        <MusicFloating
          yt={yt}
          favs={musicFavs}
          current={ambient.id}
          playing={ambient.playing}
          collapsed={ambientCollapsed}
          onToggle={toggleAmbient}
          onToggleCollapse={() => setAmbientCollapsed((c) => !c)}
        />
      ) : null}

      {/* ── Sol kenar navigasyon (Dock) ──────────────────────── */}
      <nav className="side-nav">
        <div className="snav-coin" title="Time coin">
          <span className="coin-ic"><IconCoin size={14} /></span>
          <span className="coin-val">{coins}</span>
        </div>

        <Dock
          items={[
            {
              icon: avatarUrl
                ? <img src={avatarUrl} className="snav-avatar" alt="" />
                : <div className="snav-avatar snav-initials">{initials(displayName || username)}</div>,
              label: "Profil",
              onClick: () => navigate("profile"),
              active: view === "profile",
              className: "dock-profile",
            },
            { icon: <WeekIcon />, label: "Dashboard", onClick: () => navigate("week"), active: view === "week" },
            { icon: <WeeksIcon />, label: "Takvim", onClick: () => navigate("weeks"), active: view === "weeks" },
            { icon: <StatsIcon />, label: "İstatistikler", onClick: () => navigate("stats"), active: view === "stats" },
            { icon: <FriendsIcon />, label: "Arkadaşlar", onClick: () => navigate("friends"), active: view === "friends" },
            { icon: <ShopIcon />, label: "Shop", onClick: () => navigate("shop"), active: view === "shop" },
            { icon: <SettingsIcon />, label: "Ayarlar", onClick: () => navigate("profile"), active: view === "profile" },
          ] satisfies DockItemData[]}
        />
      </nav>

      {noteTarget && userId ? (
        <NotePage
          pageKey={`day:${noteTarget.day}`}
          headerLabel={`${noteTarget.label} · Günlük`}
          userId={userId}
          load={() => loadDayPage(noteTarget.day)}
          save={(title, content) =>
            saveDayPage(userId, noteTarget.day, title, content)
          }
          onClose={() => setNoteTarget(null)}
        />
      ) : null}

      {habitPageTarget && userId ? (
        <HabitDetailPage
          habitId={habitPageTarget.habitId}
          name={
            shownWeek.habits.find((h) => h.id === habitPageTarget.habitId)
              ?.name ?? habitPageTarget.name
          }
          userId={userId}
          accentColor={
            shownWeek.habits.find((h) => h.id === habitPageTarget.habitId)
              ?.color ?? null
          }
          onAccentColorChange={(color) =>
            setHabitColor(habitPageTarget.habitId, color)
          }
          onRename={(name) => setHabitName(habitPageTarget.habitId, name)}
          onClose={() => setHabitPageTarget(null)}
        />
      ) : null}

      {/* Hatırlatıcı alarm popup'ı */}
      {firedReminder ? (
        <div className="modal-overlay" onClick={() => setFiredReminder(null)}>
          <div className="modal reminder-alert" onClick={(e) => e.stopPropagation()}>
            <div className="ra-icon"><IconBell size={28} /></div>
            <h3 className="ra-title">{firedReminder.title}</h3>
            {firedReminder.description ? (
              <p className="ra-desc">{firedReminder.description}</p>
            ) : null}
            <button
              className="primary-btn"
              onClick={() => setFiredReminder(null)}
            >
              Tamam
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

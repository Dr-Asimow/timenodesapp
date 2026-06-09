import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ActiveTimer, TimerConfig, WeekData } from "./types";
import { supabase } from "./supabase";
import {
  signOut,
  loadWeek,
  insertHabit,
  deleteHabit,
  updateHabitPosition,
  upsertEntry,
  setDayNote,
  loadDayTodos,
  addTodo,
  setTodoDone,
  deleteTodo,
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
} from "./timer";
import { Login } from "./components/Login";
import { WeekGrid } from "./components/WeekGrid";
import { TimersStack } from "./components/TimerBar";
import { MultiTaskModal } from "./components/MultiTaskModal";
import { Brand, LoadingScreen } from "./components/Brand";
import { type View, initials } from "./components/Home";
import { Profile } from "./components/Profile";
import { WeeksPage } from "./components/WeeksPage";
import { Stats } from "./components/Stats";
import { DayPanel } from "./components/DayPanel";
import { NotePage } from "./components/note/NotePage";
import { MusicPlayer } from "./components/MusicPlayer";
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
  };
}

type PendingStart = { habitId: string; day: number; config: TimerConfig };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [week, setWeek] = useState<WeekData | null>(null);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingStart | null>(null);
  const [view, setView] = useState<View>("week");
  // Güncel hafta dışında bir hafta görüntülenirken o haftanın verisi (null=güncel)
  const [viewedWeek, setViewedWeek] = useState<WeekData | null>(null);
  const [yearTotals, setYearTotals] = useState<Record<number, number[]> | null>(
    null
  );
  const [yearStats, setYearStats] = useState<YearStats | null>(null);
  // Gösterilen haftanın bir öncesinin alışkanlık-bazlı toplamları
  const [prevTotals, setPrevTotals] = useState<Record<string, number> | null>(
    null
  );
  // Bugünün gündemi (to-do + seçilen alışkanlıklar)
  const [todos, setTodos] = useState<TodoItem[]>([]);
  // Kullanıcının benzersiz UID'i (arkadaş kodu) — profiles'tan
  const [friendCode, setFriendCode] = useState<string | null>(null);
  // Günlük (Not Defteri, tam ekran) — açık gün + etiket
  const [noteTarget, setNoteTarget] = useState<{
    day: string;
    label: string;
  } | null>(null);
  // Seçili hücre (popover) — hem ızgaradan hem gündemden açılabilsin diye App'te
  const [cellSel, setCellSel] = useState<{ habitId: string; day: number } | null>(
    null
  );
  // "Bitir & kaydet" partikül efekti
  const [bursts, setBursts] = useState<Burst[]>([]);
  // Popup'tan bitirildiğinde: popup kapanınca patlat (kaynak = modal konumu)
  const pendingBurstRef = useRef<{
    fromRect: DOMRect;
    habitId: string;
    day: number;
  } | null>(null);

  // DB yazımlarını sıraya dizen zincir (yarış/FK sorunlarını önler)
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // Gündeme otomatik eklenmekte olan alışkanlıklar (çift ekleme önler)
  const autoAddingRef = useRef<Set<string>>(new Set());
  // Veri yüklendiği takvim günü (gün dönünce otomatik yenileme için)
  const dayRef = useRef<string>(toISODate(new Date()));
  // Interval içinden güncel değerlere erişim için ref'ler
  const timersRef = useRef<ActiveTimer[]>([]);
  const finishTimerRef = useRef<(t: ActiveTimer) => void>(() => {});
  // Günlük/modal açıkken otomatik yenilemeyi ertele (kullanıcıyı kesmesin)
  const reloadBlockedRef = useRef(false);

  const userId = session?.user?.id ?? null;
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
        if (!cancel) setErr(e instanceof Error ? e.message : "Yükleme hatası");
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

  // İstatistikler sayfasına girince yıl istatistiklerini çek
  useEffect(() => {
    if (view === "stats" && week) {
      setYearStats(null);
      loadYearStats(week.year)
        .then(setYearStats)
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

  // Bugünün gündemini (to-do'lar) yükle
  useEffect(() => {
    if (!userId) {
      setTodos([]);
      return;
    }
    let cancel = false;
    loadDayTodos(toISODate(new Date()))
      .then((t) => {
        if (!cancel) setTodos(t);
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

  // --- DB kalıcılığı: eski vs yeni haftayı diff'leyip yaz ---
  function persist(oldW: WeekData, newW: WeekData) {
    const job = async () => {
      const oldIds = new Set(oldW.habits.map((h) => h.id));
      const newIds = new Set(newW.habits.map((h) => h.id));
      // eklenen alışkanlıklar
      for (let i = 0; i < newW.habits.length; i++) {
        const h = newW.habits[i];
        if (!oldIds.has(h.id)) await insertHabit(h.id, h.name, i);
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

  const requestStart = (habitId: string, day: number, config: TimerConfig) => {
    const othersRunning = timers.some(
      (t) => isRunning(t) && !sameCell(t, habitId, day)
    );
    if (othersRunning) setPending({ habitId, day, config });
    else doStart(habitId, day, config, false);
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
    if (week && (mins > 0 || brkMins > 0)) {
      const w: WeekData = { ...week };
      if (mins > 0) {
        const row = (w.minutes[target.habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
        row[target.day] += mins;
        w.minutes = { ...w.minutes, [target.habitId]: row };
      }
      if (brkMins > 0) {
        const br = (w.breaks[target.habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
        br[target.day] += brkMins;
        w.breaks = { ...w.breaks, [target.habitId]: br };
      }
      applyWeek(w);
    }
    setTimers(timers.filter((t) => !sameCell(t, target.habitId, target.day)));
  };

  const cancelTimer = (target: ActiveTimer) =>
    setTimers(timers.filter((t) => !sameCell(t, target.habitId, target.day)));

  // Interval ref'lerini her render'da güncel tut
  timersRef.current = timers;
  finishTimerRef.current = finishTimer;
  reloadBlockedRef.current = noteTarget !== null || pending !== null;

  const pendingOthers = pending
    ? timers.filter(
        (t) => isRunning(t) && !sameCell(t, pending.habitId, pending.day)
      )
    : [];

  // --- Render ---
  if (!authReady) return <LoadingScreen />;
  if (!session) return <Login />;
  if (!week) return <LoadingScreen />;

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
  // "başla": sayacı başlat VE kare popup'ını aç (haftalıktaki gibi açık kalsın)
  const startHabit = (habitId: string) => {
    if (!todayInWeek) return;
    requestStart(habitId, todayIndex, { workTargetMs: null, plannedBreakMs: null });
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
        <div className="topbar-right">
          <div className="coin-hud" title="Time coin (yakında gamification)">
            <span className="coin-ic">🪙</span>
            <span className="coin-val">{coins}</span>
          </div>
          <span className="user">@{username}</span>
          <button className="ghost-btn" onClick={() => signOut()}>
            Çıkış
          </button>
        </div>
      </header>

      {err ? <div className="banner-err">⚠️ {err}</div> : null}

      <TimersStack
        timers={timers}
        week={week}
        onPause={pauseTimer}
        onResume={(t) =>
          requestStart(t.habitId, t.day, {
            workTargetMs: t.workTargetMs,
            plannedBreakMs: t.plannedBreakMs,
          })
        }
        onStartBreak={startBreak}
        onResumeWork={resumeWork}
        onAck={ackAlarm}
        onUpdate={updateTimer}
        onFinish={finishTimer}
        onCancel={cancelTimer}
      />

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
                activeTimers={viewingOther ? [] : timers}
                onChange={applyWeek}
                onStartTimer={requestStart}
                timerActions={{
                  pause: pauseTimer,
                  resume: (t) =>
                    requestStart(t.habitId, t.day, {
                      workTargetMs: t.workTargetMs,
                      plannedBreakMs: t.plannedBreakMs,
                    }),
                  startBreak: startBreak,
                  resumeWork: resumeWork,
                  ack: ackAlarm,
                  finish: finishTimer,
                  cancel: cancelTimer,
                }}
                sel={cellSel}
                onSelChange={setCellSel}
                onOpenDayNote={(day, label) => setNoteTarget({ day, label })}
                prevTotals={prevTotals}
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
                  {grid}
                </>
              );
            }
            return (
              <div className="week-layout">
                <DayPanel
                  dateLabel={dateLabel}
                  dayName={dayName}
                  habits={week.habits}
                  items={todos}
                  todayMinutes={todayMinutes}
                  runningHabitIds={runningHabitIds}
                  onAddHabit={addHabitItem}
                  onAddTodo={addTodoItem}
                  onToggleTodo={toggleTodo}
                  onDeleteItem={deleteItem}
                  onStartHabit={startHabit}
                  onOpenHabit={openHabit}
                  onOpenNote={() =>
                    setNoteTarget({
                      day: todayISO,
                      label: `${dateLabel} ${dayName}`,
                    })
                  }
                />
                <div className="week-main">{grid}</div>
              </div>
            );
          })()
        ) : view === "weeks" ? (
          <WeeksPage
            year={week.year}
            weeks={weeksOfYear(week.year)}
            totals={yearTotals}
            currentStartISO={week.startDate}
            onOpenWeek={openWeek}
          />
        ) : view === "stats" ? (
          <Stats
            year={week.year}
            weekTotalMin={weekTotalMin}
            currentWeek={week.weekNumber}
            stats={yearStats}
          />
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

      {pending && pendingOthers.length > 0 && week ? (
        <MultiTaskModal
          runningTimers={pendingOthers}
          week={week}
          onPauseOthers={() => {
            doStart(pending.habitId, pending.day, pending.config, true);
            setPending(null);
          }}
          onKeepBoth={() => {
            doStart(pending.habitId, pending.day, pending.config, false);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}

      <FlyParticles
        bursts={bursts}
        onDone={(id) => setBursts((b) => b.filter((x) => x.id !== id))}
      />

      {/* Her zaman mount: sayfa değişse de müzik (iframe) durmaz */}
      <MusicPlayer />

      {/* ── Sağ kenar navigasyon ──────────────────────── */}
      <nav className="side-nav">
        <button
          className={`snav-btn snav-profile${view === "profile" ? " active" : ""}`}
          onClick={() => navigate("profile")}
          title="Profil"
        >
          {avatarUrl ? (
            <img src={avatarUrl} className="snav-avatar" alt="" />
          ) : (
            <div className="snav-avatar snav-initials">
              {initials(displayName || username)}
            </div>
          )}
        </button>

        <div className="snav-sep" />

        <button
          className={`snav-btn${view === "week" ? " active" : ""}`}
          onClick={() => navigate("week")}
          title="Bu Hafta"
        >
          <WeekIcon />
        </button>
        <button
          className={`snav-btn${view === "weeks" ? " active" : ""}`}
          onClick={() => navigate("weeks")}
          title="Haftalar"
        >
          <WeeksIcon />
        </button>
        <button
          className={`snav-btn${view === "stats" ? " active" : ""}`}
          onClick={() => navigate("stats")}
          title="İstatistikler"
        >
          <StatsIcon />
        </button>
      </nav>

      {noteTarget && userId ? (
        <NotePage
          userId={userId}
          day={noteTarget.day}
          dateLabel={noteTarget.label}
          onClose={() => setNoteTarget(null)}
        />
      ) : null}
    </div>
  );
}

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
import { loadYearTotals } from "./db";
import { isRunning, settle, workMinutes, breakTotalMs } from "./timer";
import { Login } from "./components/Login";
import { WeekGrid } from "./components/WeekGrid";
import { TimersStack } from "./components/TimerBar";
import { MultiTaskModal } from "./components/MultiTaskModal";
import { Brand, LoadingScreen } from "./components/Brand";
import { Home, type View } from "./components/Home";
import { Profile } from "./components/Profile";
import { WeeksPage } from "./components/WeeksPage";
import { DayPanel } from "./components/DayPanel";
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
  const [view, setView] = useState<View>("home");
  // Güncel hafta dışında bir hafta görüntülenirken o haftanın verisi (null=güncel)
  const [viewedWeek, setViewedWeek] = useState<WeekData | null>(null);
  const [yearTotals, setYearTotals] = useState<Record<number, number[]> | null>(
    null
  );
  // Bugünün gündemi (to-do + seçilen alışkanlıklar)
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // DB yazımlarını sıraya dizen zincir (yarış/FK sorunlarını önler)
  const chain = useRef<Promise<unknown>>(Promise.resolve());

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

  // Sayaçları (cihaz-yerel) değiştikçe localStorage'a yaz
  useEffect(() => {
    if (userId) saveTimers(userId, timers);
  }, [timers, userId]);

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

  const finishTimer = (target: ActiveTimer) => {
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
  const contactEmail =
    (session.user.user_metadata?.contact_email as string) ?? "";

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
  const todayNote = (todayInWeek ? week.dayNotes[todayIndex] : null) ?? "";

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
  const startHabit = (habitId: string) => {
    if (!todayInWeek) return;
    requestStart(habitId, todayIndex, { workTargetMs: null, plannedBreakMs: null });
  };
  const setTodayNote = (note: string) => {
    if (!todayInWeek) return;
    const row = week.dayNotes.slice();
    row[todayIndex] = note.trim() ? note : null;
    applyWeek({ ...week, dayNotes: row });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand-btn" onClick={() => setView("home")}>
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
        {view !== "home" ? (
          <button className="back-btn" onClick={() => setView("home")}>
            ← Ana sayfa
          </button>
        ) : null}

        {view === "home" ? (
          <Home
            username={username}
            weekTotalMin={weekTotalMin}
            coins={coins}
            onNavigate={navigate}
          />
        ) : view === "week" ? (
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
                      onClick={() => setViewedWeek(null)}
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
                  note={todayNote}
                  onAddHabit={addHabitItem}
                  onAddTodo={addTodoItem}
                  onToggleTodo={toggleTodo}
                  onDeleteItem={deleteItem}
                  onStartHabit={startHabit}
                  onSetNote={setTodayNote}
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
        ) : (
          <Profile
            username={username}
            displayName={username}
            contactEmail={contactEmail}
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
    </div>
  );
}

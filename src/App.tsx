import { useEffect, useState } from "react";
import type { ActiveTimer, AppState, TimerConfig } from "./types";
import { defaultState, loadState, saveState, clearState } from "./storage";
import { isRunning, settle, workMinutes, breakTotalMs } from "./timer";
import { Login } from "./components/Login";
import { WeekGrid } from "./components/WeekGrid";
import { TimersStack } from "./components/TimerBar";
import { MultiTaskModal } from "./components/MultiTaskModal";

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
  const [state, setState] = useState<AppState | null>(() => loadState());
  // Çakışma uyarısı için bekleyen başlatma isteği (kalıcı değil)
  const [pending, setPending] = useState<PendingStart | null>(null);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  if (!state) {
    return (
      <Login
        onLogin={(username) => {
          const existing = loadState();
          setState(existing ?? defaultState(username));
        }}
      />
    );
  }

  const timers = state.timers ?? [];
  const setTimers = (next: ActiveTimer[]) =>
    setState({ ...state, timers: next });

  // Tek bir sayacı (evre/mola/alarm güncellemeleri) yerinde değiştirir.
  const updateTimer = (next: ActiveTimer) =>
    setTimers(
      timers.map((t) => (sameCell(t, next.habitId, next.day) ? next : t))
    );

  // Sayacı başlatır/devam ettirir. pauseOthers=true ise çalışan diğerlerini duraklatır.
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
      // Var olan sayacı kaldığı evreden devam ettir
      if (!isRunning(next[idx])) {
        next = next.slice();
        next[idx] = { ...next[idx], startedAt: Date.now() };
      }
    } else {
      next = [...next, newTimer(habitId, day, config)];
    }
    setTimers(next);
  };

  // Başlat/Devam isteği: başka çalışan sayaç varsa önce uyarı çıkar.
  const requestStart = (habitId: string, day: number, config: TimerConfig) => {
    const othersRunning = timers.some(
      (t) => isRunning(t) && !sameCell(t, habitId, day)
    );
    if (othersRunning) {
      setPending({ habitId, day, config });
    } else {
      doStart(habitId, day, config, false);
    }
  };

  const pauseTimer = (target: ActiveTimer) => updateTimer(settle(target));

  // Alarmı onayla (sustur); evre değişmez, sayaç çalışmaya devam eder.
  const ackAlarm = (target: ActiveTimer) =>
    updateTimer(
      target.phase === "work"
        ? { ...target, workAlarmAck: true }
        : { ...target, breakAlarmAck: true }
    );

  // Molaya geç: çalışmayı settle et + çalışma alarmını onayla, mola evresini başlat.
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

  // Çalışmaya dön: molayı settle et + mola alarmını onayla, çalışma evresini sürdür.
  const resumeWork = (target: ActiveTimer) => {
    const s = settle(target);
    updateTimer({
      ...s,
      phase: "work",
      startedAt: Date.now(),
      breakAlarmAck: true,
    });
  };

  const finishTimer = (target: ActiveTimer) => {
    const mins = workMinutes(target);
    const brkMins = Math.round(breakTotalMs(target) / 60000);
    const week = { ...state.week };
    if (mins > 0) {
      const row = (
        week.minutes[target.habitId] ?? [0, 0, 0, 0, 0, 0, 0]
      ).slice();
      row[target.day] += mins;
      week.minutes = { ...week.minutes, [target.habitId]: row };
    }
    if (brkMins > 0) {
      const brow = (
        week.breaks[target.habitId] ?? [0, 0, 0, 0, 0, 0, 0]
      ).slice();
      brow[target.day] += brkMins;
      week.breaks = { ...week.breaks, [target.habitId]: brow };
    }
    setState({
      ...state,
      week,
      timers: timers.filter((t) => !sameCell(t, target.habitId, target.day)),
    });
  };

  const cancelTimer = (target: ActiveTimer) => {
    setTimers(timers.filter((t) => !sameCell(t, target.habitId, target.day)));
  };

  const pendingOthers = pending
    ? timers.filter(
        (t) => isRunning(t) && !sameCell(t, pending.habitId, pending.day)
      )
    : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◳</span> TimeNodes
        </div>
        <div className="topbar-right">
          <span className="user">@{state.username}</span>
          <button
            className="ghost-btn"
            onClick={() => {
              if (confirm("Çıkış yapılsın mı? (Veriler tarayıcında kalır)")) {
                setState(null);
              }
            }}
          >
            Çıkış
          </button>
          <button
            className="ghost-btn danger"
            onClick={() => {
              if (confirm("Tüm veriler silinsin mi? Bu geri alınamaz.")) {
                clearState();
                setState(null);
              }
            }}
          >
            Sıfırla
          </button>
        </div>
      </header>

      <TimersStack
        timers={timers}
        week={state.week}
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
        <WeekGrid
          week={state.week}
          activeTimers={timers}
          onChange={(week) => setState({ ...state, week })}
          onStartTimer={requestStart}
        />
      </main>

      {pending && pendingOthers.length > 0 ? (
        <MultiTaskModal
          runningTimers={pendingOthers}
          week={state.week}
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

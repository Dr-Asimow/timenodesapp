import { useEffect, useState } from "react";
import type { ActiveTimer, Goal, TimerConfig, TimerSettings, WeekData } from "../types";
import { isRunning, workTotalMs, phaseProgress } from "../timer";
import { LiveTimer, TimerSetup, type PopTimerActions } from "./TimerWidget";
import { GoalPopup } from "./GoalPopup";

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5"/>
      <path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4M14.2 14.2l-1.4-1.4M5.2 5.2 3.8 3.8"/>
    </svg>
  );
}

export function TimerPanel({
  timers,
  week,
  todayIndex,
  goals,
  settings,
  onUpdateSettings,
  onAddGoal,
  onDeleteGoal,
  onPause,
  onResume,
  onStartBreak,
  onResumeWork,
  onAck,
  onFinish,
  onCancel,
  onStartNew,
}: {
  timers: ActiveTimer[];
  week: WeekData;
  todayIndex: number;
  goals: Goal[];
  settings: TimerSettings;
  onUpdateSettings: (s: TimerSettings) => void;
  onAddGoal: (text: string) => void;
  onDeleteGoal: (id: string) => void;
  onPause: (t: ActiveTimer) => void;
  onResume: (t: ActiveTimer) => void;
  onStartBreak: (t: ActiveTimer, breakTargetMs: number | null) => void;
  onResumeWork: (t: ActiveTimer) => void;
  onAck: (t: ActiveTimer) => void;
  onFinish: (t: ActiveTimer) => void;
  onCancel: (t: ActiveTimer) => void;
  onStartNew: (habitId: string, day: number, config: TimerConfig) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [showGoalPopup, setShowGoalPopup] = useState(false);
  const todayTimers = timers.filter((t) => t.day === todayIndex);
  const runningTimer = todayTimers.find(isRunning) ?? null;
  const pausedTimers = todayTimers.filter((t) => !isRunning(t));
  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  // Seçili etkinlik geçersizleştiyse sıfırla
  useEffect(() => {
    if (selectedHabitId && !week.habits.find((h) => h.id === selectedHabitId)) {
      setSelectedHabitId("");
    }
  }, [week.habits, selectedHabitId]);

  // Seçili hedef silindiyse sıfırla
  useEffect(() => {
    if (selectedGoalId && !goals.find((g) => g.id === selectedGoalId)) {
      setSelectedGoalId("");
    }
  }, [goals, selectedGoalId]);

  const activeHabitName = runningTimer
    ? (week.habits.find((h) => h.id === runningTimer.habitId)?.name ?? "")
    : null;

  function buildActions(t: ActiveTimer): PopTimerActions {
    return {
      pause: () => onPause(t),
      resume: () => onResume(t),
      startBreak: (target) => onStartBreak(t, target),
      resumeWork: () => onResumeWork(t),
      ack: () => onAck(t),
      finish: () => onFinish(t),
      cancel: () => onCancel(t),
    };
  }

  const noHabitsToday = week.habits.length === 0;
  const timerState: "" | "running" | "pausedt" = runningTimer
    ? "running"
    : todayTimers.length > 0
    ? "pausedt"
    : "";

  return (
    <aside className="timer-panel">
      {/* Başlık + ayar butonu */}
      <div className="timer-panel-head">
        <span className="timer-panel-title muted small">SAYAÇ</span>
        <button
          className="tp-settings-btn"
          onClick={() => setShowSettings((v) => !v)}
          title="Sayaç ayarları"
        >
          <GearIcon />
        </button>
      </div>

      {/* Ayar popup */}
      {showSettings ? (
        <div className="tp-settings-popup">
          <div className="tp-settings-row">
            <span className="tp-settings-label">Alarm sesi</span>
            <label className="tp-toggle">
              <input
                type="checkbox"
                checked={settings.alarmEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, alarmEnabled: e.target.checked })
                }
              />
              <span className="tp-toggle-slider" />
            </label>
          </div>
          <div className="tp-settings-row">
            <span className="tp-settings-label">Mola geçişi</span>
            <div className="tp-radio-group">
              <label className="tp-radio">
                <input
                  type="radio"
                  name="autoBreak"
                  checked={settings.autoBreak}
                  onChange={() => onUpdateSettings({ ...settings, autoBreak: true })}
                />
                Otomatik
              </label>
              <label className="tp-radio">
                <input
                  type="radio"
                  name="autoBreak"
                  checked={!settings.autoBreak}
                  onChange={() => onUpdateSettings({ ...settings, autoBreak: false })}
                />
                Manuel
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {/* Aktif sayaç alanı */}
      <div className="tp-active">
        {runningTimer ? (
          <>
            <div className="tp-habit-label muted small">{activeHabitName}</div>
            <LiveTimer timer={runningTimer} actions={buildActions(runningTimer)} />
          </>
        ) : (
          <>
            {/* Etkinlik seçici (sadece bugün + etkinlik varsa) */}
            {!noHabitsToday && todayIndex >= 0 && todayIndex <= 6 ? (
              <div className="tp-habit-selector">
                <select
                  className="tp-habit-select"
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                >
                  <option value="">— Etkinlik seç —</option>
                  {week.habits.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Oturum hedefi */}
            <div className="tp-goal-row">
              <span className="tp-settings-label muted small">Oturum hedefi</span>
              <button
                type="button"
                className="tp-goal-select"
                onClick={() => setShowGoalPopup(true)}
              >
                <span className={selectedGoal ? "" : "muted"}>
                  {selectedGoal ? selectedGoal.text : "— Hedef seç —"}
                </span>
                <span className="tp-goal-caret">▾</span>
              </button>
            </div>

            <TimerSetup
              timerState={runningTimer ? "running" : ""}
              onStartTimer={(config) => {
                if (!selectedHabitId) return;
                onStartNew(selectedHabitId, todayIndex, config);
              }}
            />
          </>
        )}
      </div>

      {/* Durdurulmuş sayaçlar */}
      {pausedTimers.length > 0 ? (
        <div className="tp-paused-section">
          <div className="muted small tp-paused-title">DURAKLATILMIŞ</div>
          <div className="tp-paused-list">
            {pausedTimers.map((t) => (
              <PausedItem
                key={`${t.habitId}:${t.day}`}
                timer={t}
                habitName={week.habits.find((h) => h.id === t.habitId)?.name ?? ""}
                onResume={() => onResume(t)}
                onCancel={() => onCancel(t)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Hedef seç/ekle popup */}
      {showGoalPopup ? (
        <GoalPopup
          goals={goals}
          selectedId={selectedGoalId}
          onSelect={setSelectedGoalId}
          onAdd={onAddGoal}
          onDelete={(id) => {
            if (selectedGoalId === id) setSelectedGoalId("");
            onDeleteGoal(id);
          }}
          onClose={() => setShowGoalPopup(false)}
        />
      ) : null}
    </aside>
  );
}

function PausedItem({
  timer,
  habitName,
  onResume,
  onCancel,
}: {
  timer: ActiveTimer;
  habitName: string;
  onResume: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const totalMs = workTotalMs(timer, now);
  const mins = Math.floor(totalMs / 60000);
  const progress = phaseProgress(timer, now);

  return (
    <div
      className="tp-paused-item"
      data-timer={`${timer.habitId}:${timer.day}`}
    >
      <div className="tp-paused-row">
        <span className="tp-paused-name">{habitName}</span>
        <span className="tp-paused-time muted small">{mins}dk</span>
        <button className="tp-resume-btn" onClick={onResume}>▶ devam</button>
        <button className="tp-cancel-btn" onClick={onCancel}>×</button>
      </div>
      {progress != null ? (
        <div className="tp-paused-bar">
          <div
            className="tp-paused-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}


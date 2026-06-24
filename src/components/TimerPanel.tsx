import { useEffect, useState } from "react";
import type { ActiveTimer, Topic, TimerConfig, TimerSettings, WeekData } from "../types";
import { isRunning, workTotalMs, phaseProgress } from "../timer";
import { LiveTimer, TimerSetup, type PopTimerActions } from "./TimerWidget";
import { TopicPopup } from "./TopicPopup";
import { IconTarget } from "./Icons";
import { loadTopics, addTopic, deleteTopic } from "../db";

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
  userId,
  settings,
  onUpdateSettings,
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
  userId: string;
  settings: TimerSettings;
  onUpdateSettings: (s: TimerSettings) => void;
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
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showTopicPopup, setShowTopicPopup] = useState(false);
  const todayTimers = timers.filter((t) => t.day === todayIndex);
  const runningTimer = todayTimers.find(isRunning) ?? null;
  const pausedTimers = todayTimers.filter((t) => !isRunning(t));
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  // Seçili etkinlik geçersizleştiyse sıfırla
  useEffect(() => {
    if (selectedHabitId && !week.habits.find((h) => h.id === selectedHabitId)) {
      setSelectedHabitId("");
    }
  }, [week.habits, selectedHabitId]);

  // Seçili etkinliğin konularını yükle (etkinlik değişince konu seçimi sıfırlanır)
  useEffect(() => {
    setSelectedTopicId("");
    if (!selectedHabitId) {
      setTopics([]);
      return;
    }
    let cancel = false;
    loadTopics(selectedHabitId)
      .then((t) => { if (!cancel) setTopics(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [selectedHabitId]);

  async function handleAddTopic(name: string) {
    if (!selectedHabitId || !userId) return;
    try {
      const t = await addTopic(userId, selectedHabitId, name);
      setTopics((cur) => [...cur, t]);
    } catch { /* yoksay */ }
  }
  function handleDeleteTopic(id: string) {
    if (selectedTopicId === id) setSelectedTopicId("");
    setTopics((cur) => cur.filter((t) => t.id !== id));
    deleteTopic(id).catch(() => {});
  }

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
            <div className="tp-habit-label muted small">
              {activeHabitName}
              {runningTimer.topicName ? <> · <IconTarget size={12} /> {runningTimer.topicName}</> : ""}
            </div>
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

            {/* Konu (etkinliğe bağlı) — sadece etkinlik seçiliyse */}
            {selectedHabitId ? (
              <div className="tp-goal-row">
                <span className="tp-settings-label muted small">Konu</span>
                <button
                  type="button"
                  className="tp-goal-select"
                  onClick={() => setShowTopicPopup(true)}
                >
                  <span className={selectedTopic ? "" : "muted"}>
                    {selectedTopic ? selectedTopic.name : "Konusuz"}
                  </span>
                  <span className="tp-goal-caret">▾</span>
                </button>
              </div>
            ) : null}

            <TimerSetup
              timerState={runningTimer ? "running" : ""}
              onStartTimer={(config) => {
                if (!selectedHabitId) return;
                onStartNew(selectedHabitId, todayIndex, {
                  ...config,
                  topicId: selectedTopicId || null,
                  topicName: selectedTopic ? selectedTopic.name : null,
                });
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

      {/* Konu seç/ekle popup */}
      {showTopicPopup ? (
        <TopicPopup
          topics={topics}
          selectedId={selectedTopicId}
          onSelect={setSelectedTopicId}
          onAdd={handleAddTopic}
          onDelete={handleDeleteTopic}
          onClose={() => setShowTopicPopup(false)}
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
      {timer.topicName ? (
        <div className="tp-paused-topic muted small"><IconTarget size={12} /> {timer.topicName}</div>
      ) : null}
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


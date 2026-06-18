import { useEffect, useState } from "react";
import type { ActiveTimer, TimerConfig, Topic, TopicMinute } from "../types";
import type { DayType } from "./WeekGrid";
import { LiveTimer, TimerSetup, DeltaPicker, type PopTimerActions } from "./TimerWidget";
import { loadTopicMinutes, loadTopics, addTopic, deleteTopic } from "../db";
import { formatMinutes } from "../heat";
import { TopicPopup } from "./TopicPopup";

export type { PopTimerActions };

export function CellPopover({
  dayType,
  dayLabel,
  habitId,
  dayISO,
  userId,
  habitName,
  workMin,
  note,
  timerState,
  timer,
  timerActions,
  onStartTimer,
  onAddWork,
  onSetNote,
  onClose,
}: {
  dayType: DayType;
  dayLabel: string;
  habitId: string;
  dayISO: string;
  userId: string;
  habitName: string;
  workMin: number;
  note: string | null;
  timerState: "" | "running" | "pausedt";
  timer: ActiveTimer | null;
  timerActions: PopTimerActions | null;
  onStartTimer: (config: TimerConfig) => void;
  onAddWork: (deltaMin: number) => void;
  onSetNote: (note: string) => void;
  onClose: () => void;
}) {
  const isFuture = dayType === "future";
  const hasTimer = !!(timer && timerActions);
  const canStart = dayType === "today" && !hasTimer;

  // Konu bazında süre kırılımı (Supabase'den)
  const [topicMins, setTopicMins] = useState<TopicMinute[]>([]);
  useEffect(() => {
    if (workMin <= 0) {
      setTopicMins([]);
      return;
    }
    let cancel = false;
    loadTopicMinutes(habitId, dayISO)
      .then((t) => { if (!cancel) setTopicMins(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [habitId, dayISO, workMin]);

  const topicSum = topicMins.reduce((a, t) => a + t.min, 0);
  const untracked = Math.max(0, workMin - topicSum);

  // Timer başlatırken konu seçimi (sadece bugün + sayaç yokken)
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [showTopicPopup, setShowTopicPopup] = useState(false);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  useEffect(() => {
    if (!canStart) return;
    let cancel = false;
    loadTopics(habitId)
      .then((t) => { if (!cancel) setTopics(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [habitId, canStart]);

  async function handleAddTopic(name: string) {
    if (!userId) return;
    try {
      const t = await addTopic(userId, habitId, name);
      setTopics((cur) => [...cur, t]);
    } catch { /* yoksay */ }
  }
  function handleDeleteTopic(id: string) {
    if (selectedTopicId === id) setSelectedTopicId("");
    setTopics((cur) => cur.filter((t) => t.id !== id));
    deleteTopic(id).catch(() => {});
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cell-modal" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">
            {habitName} · {dayLabel}
          </span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {isFuture && !hasTimer ? (
          <p className="future-note muted small">
            İleri tarih — burada zaman takibi yok, ama plan/aktivite notu
            bırakabilirsin.
          </p>
        ) : (
          <>
            {hasTimer ? (
              <>
                <LiveTimer timer={timer!} actions={timerActions!} />
                <div className="popover-divider" />
              </>
            ) : dayType === "today" ? (
              <>
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
                <TimerSetup
                  timerState={timerState}
                  onStartTimer={(config) =>
                    onStartTimer({ ...config, topicId: selectedTopicId || null })
                  }
                />
                <div className="popover-divider" />
              </>
            ) : null}
            <div className="stat-edit-row">
              <BigStat workMin={workMin} />
              <DeltaPicker current={workMin} onApply={onAddWork} />
            </div>
            {workMin > 0 && topicMins.length > 0 ? (
              <div className="topic-breakdown">
                <span className="popover-label">Konular</span>
                <ul className="topic-list">
                  {topicMins.map((t) => (
                    <li className="topic-row" key={t.topicId}>
                      <span className="topic-name">{t.name}</span>
                      <span className="topic-val">{formatMinutes(t.min)}</span>
                    </li>
                  ))}
                  {untracked > 0 ? (
                    <li className="topic-row muted">
                      <span className="topic-name">Konusuz</span>
                      <span className="topic-val">{formatMinutes(untracked)}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <div className="popover-divider" />
          </>
        )}

        <NoteField note={note} onSetNote={onSetNote} />
      </div>

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
    </div>
  );
}

function NoteField({
  note,
  onSetNote,
}: {
  note: string | null;
  onSetNote: (note: string) => void;
}) {
  const [val, setVal] = useState(note ?? "");
  return (
    <div className="notefield">
      <span className="popover-label">Aktivite notu</span>
      <textarea
        className="note-area"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if ((val ?? "") !== (note ?? "")) onSetNote(val);
        }}
        placeholder="Bugün ne yaptın / ne yapacaksın?"
        rows={3}
      />
    </div>
  );
}

function BigStat({ workMin }: { workMin: number }) {
  const h = Math.floor(workMin / 60);
  const m = workMin % 60;
  if (h > 0) {
    return (
      <div className="bigstat">
        <span className="bigstat-num">
          {h}
          <span className="bigstat-unit">saat</span>
        </span>
        {m > 0 ? <span className="bigstat-sub">{m} dakika</span> : null}
      </div>
    );
  }
  return (
    <div className="bigstat">
      <span className="bigstat-num">
        {workMin}
        <span className="bigstat-unit">dakika</span>
      </span>
    </div>
  );
}

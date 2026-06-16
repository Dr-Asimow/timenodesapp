import { useEffect, useState } from "react";
import type { Goal, Reminder, TodoItem } from "../types";
import type { AmbientId } from "../ambient";
import { GoalPopup } from "./GoalPopup";
import { AmbientInline } from "./AmbientPlayer";

type RightTab = "hedef" | "hatirlatici" | "todo";

function fmtCountdown(targetAt: string): { label: string; expired: boolean } {
  const diff = new Date(targetAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Süresi doldu", expired: true };
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return { label: `${d}g ${h}sa`, expired: false };
  if (h > 0) return { label: `${h}sa ${m}dk`, expired: false };
  return { label: `${m}dk`, expired: false };
}

export function RightPanel({
  todos,
  todayISO,
  goals,
  reminders,
  onAddGoal,
  onDeleteGoal,
  onAddReminder,
  onDeleteReminder,
  onAddTodo,
  onToggleTodo,
  onDeleteItem,
  ambientId,
  ambientPlaying,
  ambientVol,
  onToggleAmbient,
  onAmbientVol,
}: {
  todos: TodoItem[];
  todayISO: string;
  goals: Goal[];
  reminders: Reminder[];
  onAddGoal: (text: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddReminder: (title: string, targetAt: string) => void;
  onDeleteReminder: (id: string) => void;
  onAddTodo: (title: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteItem: (id: string) => void;
  ambientId: AmbientId | null;
  ambientPlaying: boolean;
  ambientVol: number;
  onToggleAmbient: (id: AmbientId) => void;
  onAmbientVol: (v: number) => void;
}) {
  const [tab, setTab] = useState<RightTab>("hedef");

  return (
    <aside className="right-panel">
      {/* Üst sekmeli kart */}
      <div className="side-card right-tabs-card">
        <div className="rtab-btns">
          <button
            className={`rtab-btn${tab === "hedef" ? " active" : ""}`}
            onClick={() => setTab("hedef")}
            title="Hedefler"
          >
            🎯 Hedef
          </button>
          <button
            className={`rtab-btn${tab === "hatirlatici" ? " active" : ""}`}
            onClick={() => setTab("hatirlatici")}
            title="Hatırlatıcılar"
          >
            🔔 Hatırlat
          </button>
          <button
            className={`rtab-btn${tab === "todo" ? " active" : ""}`}
            onClick={() => setTab("todo")}
            title="Yapılacaklar"
          >
            ✓ To-do
          </button>
        </div>

        <div className="rtab-content">
          {tab === "hedef" ? (
            <GoalTab goals={goals} onAdd={onAddGoal} onDelete={onDeleteGoal} />
          ) : tab === "hatirlatici" ? (
            <ReminderTab
              reminders={reminders}
              onAdd={onAddReminder}
              onDelete={onDeleteReminder}
            />
          ) : (
            <TodoTab
              todos={todos}
              todayISO={todayISO}
              onAddTodo={onAddTodo}
              onToggle={onToggleTodo}
              onDelete={onDeleteItem}
            />
          )}
        </div>
      </div>

      {/* Müzik player kartı */}
      <AmbientInline
        current={ambientId}
        playing={ambientPlaying}
        volume={ambientVol}
        onToggle={onToggleAmbient}
        onVolume={onAmbientVol}
      />
    </aside>
  );
}

// --- Hedef sekmesi ---

function GoalTab({
  goals,
  onAdd,
  onDelete,
}: {
  goals: Goal[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <div className="rtab-inner">
      {goals.length === 0 ? (
        <p className="rtab-empty muted small">Henüz hedef eklenmemiş.</p>
      ) : (
        <ul className="rtab-list">
          {goals.map((g) => (
            <li key={g.id} className="rtab-item">
              <span className="rtab-item-text">{g.text}</span>
              <button className="rtab-del-btn" onClick={() => onDelete(g.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <button className="rtab-agenda-btn" onClick={() => setShowPopup(true)}>
        + Hedef ekle
      </button>
      {showPopup ? (
        <GoalPopup
          goals={goals}
          onAdd={onAdd}
          onDelete={onDelete}
          onClose={() => setShowPopup(false)}
        />
      ) : null}
    </div>
  );
}

// --- Hatırlatıcı sekmesi ---

function ReminderTab({
  reminders,
  onAdd,
  onDelete,
}: {
  reminders: Reminder[];
  onAdd: (title: string, targetAt: string) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const [, tick] = useState(0);

  // Her dakika geri sayımı güncelle
  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  function submit() {
    const t = title.trim();
    if (!t || !datetime) return;
    // datetime-local → ISO string
    const iso = new Date(datetime).toISOString();
    onAdd(t, iso);
    setTitle("");
    setDatetime("");
  }

  return (
    <div className="rtab-inner">
      <form
        className="rtab-reminder-form"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <input
          className="rtab-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hatırlatıcı başlığı…"
        />
        <input
          className="rtab-input"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
        <button type="submit" className="rtab-add-btn-full">+ Hatırlatıcı ekle</button>
      </form>
      {reminders.length === 0 ? (
        <p className="rtab-empty muted small">Hatırlatıcı yok.</p>
      ) : (
        <ul className="rtab-list">
          {reminders.map((r) => {
            const { label, expired } = fmtCountdown(r.target_at);
            return (
              <li key={r.id} className={`rtab-item reminder-item${expired ? " expired" : ""}`}>
                <div className="reminder-info">
                  <span className="rtab-item-text">{r.title}</span>
                  <span className={`reminder-countdown muted small${expired ? " expired" : ""}`}>
                    {label}
                  </span>
                </div>
                <button className="rtab-del-btn" onClick={() => onDelete(r.id)}>×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- To-do sekmesi ---

function TodoTab({
  todos,
  todayISO,
  onAddTodo,
  onToggle,
  onDelete,
}: {
  todos: TodoItem[];
  todayISO: string;
  onAddTodo: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [newTodo, setNewTodo] = useState("");

  const todoItems = todos.filter((t) => t.day === todayISO && !t.habitId);

  function submitTodo() {
    const t = newTodo.trim();
    if (!t) return;
    onAddTodo(t);
    setNewTodo("");
  }

  return (
    <div className="rtab-inner">
      <form
        className="rtab-add-row"
        onSubmit={(e) => { e.preventDefault(); submitTodo(); }}
      >
        <input
          className="rtab-input"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Yapılacak ekle…"
        />
        <button type="submit" className="rtab-add-btn">+</button>
      </form>

      {todoItems.length === 0 ? (
        <p className="rtab-empty muted small">Bugün için henüz bir öğe yok.</p>
      ) : (
        <ul className="rtab-list">
          {todoItems.map((it) => (
            <li key={it.id} className="rtab-item todo-item">
              <input
                type="checkbox"
                className="rtab-check"
                checked={it.done}
                onChange={(e) => onToggle(it.id, e.target.checked)}
              />
              <span className={`rtab-item-text${it.done ? " done" : ""}`}>{it.title}</span>
              <button className="rtab-del-btn" onClick={() => onDelete(it.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

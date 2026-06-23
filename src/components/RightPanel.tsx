import { useEffect, useState } from "react";
import type { Goal, Reminder, TodoItem } from "../types";
import type { AmbientId } from "../ambient";
import type { YouTubeApi } from "../useYouTube";
import { GoalPopup } from "./GoalPopup";
import { MusicCard } from "./AmbientPlayer";

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
  yt,
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
  onAddReminder: (title: string, targetAt: string, description?: string) => void;
  onDeleteReminder: (id: string) => void;
  onAddTodo: (title: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteItem: (id: string) => void;
  yt: YouTubeApi;
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
      <MusicCard
        yt={yt}
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
  onAdd: (title: string, targetAt: string, description?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rtab-inner">
      {reminders.length === 0 ? (
        <p className="rtab-empty muted small">Henüz hatırlatıcı eklenmemiş.</p>
      ) : (
        <ul className="rtab-list">
          {reminders.map((r) => {
            const { label, expired } = fmtCountdown(r.target_at);
            return (
              <li key={r.id} className={`rtab-item reminder-item${expired ? " expired" : ""}`}>
                <div className="reminder-info">
                  <span className="rtab-item-text">{r.title}</span>
                  {r.description ? (
                    <span className="reminder-desc muted small">{r.description}</span>
                  ) : null}
                  <span className={`reminder-countdown small${expired ? " expired" : ""}`}>
                    {expired ? "⏰ " : "⏳ "}{label}
                  </span>
                </div>
                <button className="rtab-del-btn" onClick={() => onDelete(r.id)}>×</button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="rtab-agenda-btn" onClick={() => setShowPopup(true)}>
        + Hatırlatıcı ekle
      </button>
      {showPopup ? (
        <ReminderPopup
          onAdd={(title, targetAt, desc) => {
            onAdd(title, targetAt, desc);
            setShowPopup(false);
          }}
          onClose={() => setShowPopup(false)}
        />
      ) : null}
    </div>
  );
}

// --- Hatırlatıcı ekleme popup'ı ---

function ReminderPopup({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, targetAt: string, description?: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  function submit() {
    const t = title.trim();
    if (!t || !date || !time) return;
    const iso = new Date(`${date}T${time}`).toISOString();
    onAdd(t, iso, desc.trim() || undefined);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal reminder-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">Hatırlatıcı ekle</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <div className="rp-field">
          <label className="rp-label">Başlık</label>
          <input
            className="rp-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ne hatırlatılsın?"
            autoFocus
          />
        </div>

        <div className="rp-field">
          <label className="rp-label">Açıklama <span className="muted small">(opsiyonel)</span></label>
          <textarea
            className="rp-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detay ekle…"
            rows={3}
          />
        </div>

        <div className="rp-row">
          <div className="rp-field rp-half">
            <label className="rp-label">Tarih</label>
            <input
              className="rp-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="rp-field rp-half">
            <label className="rp-label">Saat</label>
            <input
              className="rp-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <button
          className="primary-btn rp-submit"
          disabled={!title.trim() || !date || !time}
          onClick={submit}
        >
          Kaydet
        </button>
      </div>
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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Goal, Reminder, TodoItem } from "../types";
import type { AmbientId } from "../ambient";
import type { YouTubeApi } from "../useYouTube";
import { GoalPopup } from "./GoalPopup";
import { MusicCard } from "./AmbientPlayer";
import { IconTarget, IconBell, IconCheck } from "./Icons";

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
            <IconTarget size={14} /> Hedef
          </button>
          <button
            className={`rtab-btn${tab === "hatirlatici" ? " active" : ""}`}
            onClick={() => setTab("hatirlatici")}
            title="Hatırlatıcılar"
          >
            <IconBell size={14} /> Hatırlat
          </button>
          <button
            className={`rtab-btn${tab === "todo" ? " active" : ""}`}
            onClick={() => setTab("todo")}
            title="Yapılacaklar"
          >
            <IconCheck size={14} /> To-do
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

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const DOW = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

function MiniCal({
  value,
  onPick,
}: {
  value: string;
  onPick: (iso: string) => void;
}) {
  const today = new Date();
  const init = value ? new Date(value + "T00:00:00") : today;
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());

  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function prev() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function iso(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div className="mc">
      <div className="mc-head">
        <button type="button" className="mc-nav" onClick={prev}>‹</button>
        <span className="mc-title">{MONTH_NAMES[month]} {year}</span>
        <button type="button" className="mc-nav" onClick={next}>›</button>
      </div>
      <div className="mc-dow">
        {DOW.map((d) => <span key={d} className="mc-dow-cell">{d}</span>)}
      </div>
      <div className="mc-grid">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} className="mc-cell mc-empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dayISO = iso(d);
          const sel = dayISO === value;
          const isToday = dayISO === todayISO;
          return (
            <button
              key={d}
              type="button"
              className={`mc-cell${sel ? " mc-sel" : ""}${isToday ? " mc-today" : ""}`}
              onClick={() => onPick(dayISO)}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const WHEEL_H = 48;
const WHEEL_VISIBLE = 5;
const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINS_LIST = Array.from({ length: 60 }, (_, i) => i);

function ScrollWheel({
  items,
  initial,
  onIndex,
}: {
  items: number[];
  initial: number;
  onIndex: (i: number) => void;
}) {
  const n = items.length;
  const tripled = [...items, ...items, ...items];
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);
  const [idx, setIdx] = useState(initial);
  const idxRef = useRef(initial);
  const cbRef = useRef(onIndex);
  cbRef.current = onIndex;
  const wrapping = useRef(false);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = (n + initial) * WHEEL_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rawFromScroll(st: number) {
    return Math.round(st / WHEEL_H);
  }
  function wrapToCenter(el: HTMLDivElement) {
    const raw = rawFromScroll(el.scrollTop);
    if (raw < n / 2 || raw >= n * 2 + n / 2) {
      wrapping.current = true;
      el.scrollTop = (n + idxRef.current) * WHEEL_H;
      wrapping.current = false;
    }
  }
  function onScroll() {
    const el = ref.current;
    if (!el || wrapping.current) return;
    const raw = rawFromScroll(el.scrollTop);
    const i = ((raw % n) + n) % n;
    if (i !== idxRef.current) { idxRef.current = i; setIdx(i); cbRef.current(i); }
    wrapToCenter(el);
  }
  function onPointerDown(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    drag.current = { startY: e.clientY, startScroll: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !drag.current) return;
    el.scrollTop = drag.current.startScroll - (e.clientY - drag.current.startY);
  }
  function endDrag(e: React.PointerEvent) {
    const el = ref.current;
    if (!drag.current) return;
    drag.current = null;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch {}
      const raw = rawFromScroll(el.scrollTop);
      el.scrollTo({ top: raw * WHEEL_H, behavior: "smooth" });
    }
  }

  const pad = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_H;

  return (
    <div className="sw-wrap" style={{ height: WHEEL_VISIBLE * WHEEL_H }}>
      <div
        className="sw-scroll"
        ref={ref}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ height: WHEEL_VISIBLE * WHEEL_H }}
      >
        <div style={{ height: pad, flex: "none" }} />
        {tripled.map((v, i) => {
          const realIdx = ((i % n) + n) % n;
          const dist = Math.abs(realIdx - idx);
          const nearDist = Math.min(dist, n - dist);
          return (
            <div
              key={i}
              className={`sw-item${realIdx === idx ? " sw-sel" : ""}${nearDist === 1 ? " sw-near" : ""}`}
              style={{ height: WHEEL_H }}
            >
              {String(v).padStart(2, "0")}
            </div>
          );
        })}
        <div style={{ height: pad, flex: "none" }} />
      </div>
      <div className="sw-band" />
    </div>
  );
}

function TimePicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (hhmm: string) => void;
}) {
  const now = new Date();
  const initH = value ? Number(value.split(":")[0]) : now.getHours();
  const initM = value ? Number(value.split(":")[1]) : now.getMinutes();
  const hourRef = useRef(initH);
  const minRef = useRef(initM);

  function emit() {
    const hh = String(hourRef.current).padStart(2, "0");
    const mm = String(minRef.current).padStart(2, "0");
    onPick(`${hh}:${mm}`);
  }

  return (
    <div className="tps">
      <div className="tps-wheels">
        <ScrollWheel
          items={HOURS_LIST}
          initial={initH}
          onIndex={(i) => { hourRef.current = i; }}
        />
        <span className="tps-colon">:</span>
        <ScrollWheel
          items={MINS_LIST}
          initial={initM}
          onIndex={(i) => { minRef.current = i; }}
        />
      </div>
      <button type="button" className="primary-btn rp-submit" onClick={emit}>
        Tamam
      </button>
    </div>
  );
}

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
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);

  function submit() {
    const t = title.trim();
    if (!t || !date || !time) return;
    const iso = new Date(`${date}T${time}`).toISOString();
    onAdd(t, iso, desc.trim() || undefined);
  }

  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  return createPortal(
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
            rows={2}
          />
        </div>

        <div className="rp-row">
          <div className="rp-field rp-half">
            <label className="rp-label">Tarih</label>
            <button
              type="button"
              className={`rp-input rp-picker-btn${date ? "" : " muted"}`}
              onClick={() => { setShowCal(!showCal); setShowTime(false); }}
            >
              {date ? fmtDate(date) : "Gün seç"}
            </button>
          </div>
          <div className="rp-field rp-half">
            <label className="rp-label">Saat</label>
            <button
              type="button"
              className={`rp-input rp-picker-btn${time ? "" : " muted"}`}
              onClick={() => { setShowTime(!showTime); setShowCal(false); }}
            >
              {time || "Saat seç"}
            </button>
          </div>
        </div>

        {showCal ? (
          <MiniCal
            value={date}
            onPick={(d) => { setDate(d); setShowCal(false); }}
          />
        ) : null}

        {showTime ? (
          <TimePicker
            value={time}
            onPick={(t) => { setTime(t); setShowTime(false); }}
          />
        ) : null}

        <button
          className="primary-btn rp-submit"
          disabled={!title.trim() || !date || !time}
          onClick={submit}
        >
          Kaydet
        </button>
      </div>
    </div>,
    document.body
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { addDays, isoWeekNumber, mondayOf, toISODate } from "../storage";
import {
  addTodo,
  deleteTodo,
  loadDayNote,
  loadDayTodos,
  loadTodosInRange,
  setTodoDone,
} from "../db";
import type { Reminder, TodoItem } from "../types";
import { ReminderPopup } from "./RightPanel";
import { IconBell, IconCheck, IconCircle } from "./Icons";

type CalView = "week" | "month" | "year";

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const MONTHS_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];
const DOW_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const DOW_FULL = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];

function fmtTime(targetAt: string): string {
  const d = new Date(targetAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CalendarView({
  userId,
  reminders,
  onAddReminder,
  onSaveDayNote,
  onTodosChanged,
}: {
  userId: string;
  reminders: Reminder[];
  onAddReminder: (title: string, targetAt: string, description?: string) => void;
  onSaveDayNote: (dayISO: string, note: string) => void;
  // Bir günün to-do'ları değişti (dashboard senkronu için App'e haber ver)
  onTodosChanged: (dayISO: string) => void;
}) {
  const [view, setView] = useState<CalView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [popupDay, setPopupDay] = useState<string | null>(null);
  const [rangeTodos, setRangeTodos] = useState<TodoItem[]>([]);
  const [refresh, setRefresh] = useState(0);

  const todayISO = toISODate(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  // Görünür aralık (nokta işaretleri için to-do'lar buradan yüklenir)
  const monday = mondayOf(anchor);
  const from =
    view === "week" ? toISODate(monday)
    : view === "month" ? toISODate(new Date(year, month, 1))
    : `${year}-01-01`;
  const to =
    view === "week" ? toISODate(addDays(toISODate(monday), 6))
    : view === "month" ? toISODate(new Date(year, month + 1, 0))
    : `${year}-12-31`;

  useEffect(() => {
    let cancel = false;
    loadTodosInRange(from, to)
      .then((t) => { if (!cancel) setRangeTodos(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [from, to, refresh, userId]);

  // günISO → o günün öğeleri
  const todosByDay: Record<string, TodoItem[]> = {};
  for (const t of rangeTodos) (todosByDay[t.day] ??= []).push(t);
  const remsByDay: Record<string, Reminder[]> = {};
  for (const r of reminders) {
    const iso = toISODate(new Date(r.target_at));
    (remsByDay[iso] ??= []).push(r);
  }

  function nav(dir: -1 | 1) {
    if (view === "week") setAnchor(addDays(toISODate(anchor), dir * 7));
    else if (view === "month") setAnchor(new Date(year, month + dir, 1));
    else setAnchor(new Date(year + dir, month, 1));
  }

  const title =
    view === "week"
      ? (() => {
          const a = monday;
          const b = addDays(toISODate(monday), 6);
          const am = MONTHS_SHORT[a.getMonth()];
          const bm = MONTHS_SHORT[b.getMonth()];
          const range = am === bm
            ? `${a.getDate()}–${b.getDate()} ${am}`
            : `${a.getDate()} ${am} – ${b.getDate()} ${bm}`;
          return `${range} ${b.getFullYear()}`;
        })()
      : view === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : `${year}`;

  // Gün hücresindeki işaretler: to-do sayısı + hatırlatıcı zili
  const dayMarks = (iso: string) => {
    const t = todosByDay[iso] ?? [];
    const r = remsByDay[iso] ?? [];
    if (t.length === 0 && r.length === 0) return null;
    return (
      <span className="cal-marks">
        {t.length > 0 ? (
          <span className={`cal-mark-todo${t.every((x) => x.done) ? " all-done" : ""}`}>
            {t.length}
          </span>
        ) : null}
        {r.length > 0 ? <IconBell size={10} /> : null}
      </span>
    );
  };

  return (
    <div className="cal-card">
      <div className="cal-head">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => nav(-1)} aria-label="Önceki">‹</button>
          <button className="cal-nav-btn cal-today-btn" onClick={() => setAnchor(new Date())}>
            Bugün
          </button>
          <button className="cal-nav-btn" onClick={() => nav(1)} aria-label="Sonraki">›</button>
          <span className="cal-title">{title}</span>
        </div>
        <div className="cal-views">
          {(["week", "month", "year"] as CalView[]).map((v) => (
            <button
              key={v}
              className={`cal-view-btn${view === v ? " active" : ""}`}
              onClick={() => setView(v)}
            >
              {v === "week" ? "Hafta" : v === "month" ? "Ay" : "Yıl"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          year={year}
          month={month}
          todayISO={todayISO}
          dayMarks={dayMarks}
          onPickDay={setPopupDay}
        />
      ) : view === "week" ? (
        <div className="cal-week">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const iso = toISODate(addDays(toISODate(monday), d));
            const date = new Date(iso + "T00:00:00");
            const t = todosByDay[iso] ?? [];
            const r = remsByDay[iso] ?? [];
            return (
              <button
                key={iso}
                className={`cal-week-col${iso === todayISO ? " cal-now" : ""}`}
                onClick={() => setPopupDay(iso)}
              >
                <span className="cal-week-dow small">{DOW_SHORT[d]}</span>
                <span className="cal-week-num">{date.getDate()}</span>
                <span className="cal-week-items">
                  {r.map((x) => (
                    <span className="cal-week-item cal-week-rem" key={x.id}>
                      <IconBell size={10} /> {fmtTime(x.target_at)} {x.title}
                    </span>
                  ))}
                  {t.map((x) => (
                    <span className={`cal-week-item${x.done ? " done" : ""}`} key={x.id}>
                      {x.done ? <IconCheck size={10} /> : <IconCircle size={10} />} {x.title}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="cal-year">
          {Array.from({ length: 12 }).map((_, m) => (
            <div className="cal-year-month" key={m}>
              <button
                className="cal-year-title small"
                onClick={() => { setAnchor(new Date(year, m, 1)); setView("month"); }}
              >
                {MONTHS_SHORT[m]}
              </button>
              <MonthGrid
                year={year}
                month={m}
                todayISO={todayISO}
                mini
                hasItems={(iso) => !!todosByDay[iso]?.length || !!remsByDay[iso]?.length}
                onPickDay={setPopupDay}
              />
            </div>
          ))}
        </div>
      )}

      {popupDay ? (
        <CalDayPopup
          iso={popupDay}
          todayISO={todayISO}
          userId={userId}
          reminders={remsByDay[popupDay] ?? []}
          onAddReminder={onAddReminder}
          onSaveDayNote={onSaveDayNote}
          onMutated={(day) => { setRefresh((v) => v + 1); onTodosChanged(day); }}
          onClose={() => setPopupDay(null)}
        />
      ) : null}
    </div>
  );
}

// Ay ızgarası (büyük ay görünümü + yıl görünümündeki mini aylar ortak)
function MonthGrid({
  year,
  month,
  todayISO,
  mini,
  dayMarks,
  hasItems,
  onPickDay,
}: {
  year: number;
  month: number;
  todayISO: string;
  mini?: boolean;
  dayMarks?: (iso: string) => ReactNode;
  hasItems?: (iso: string) => boolean;
  onPickDay: (iso: string) => void;
}) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const iso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className={mini ? "cal-month cal-mini" : "cal-month"}>
      {!mini ? (
        <div className="cal-dow-row">
          {DOW_SHORT.map((d) => <span key={d} className="cal-dow small">{d}</span>)}
        </div>
      ) : null}
      <div className="cal-month-grid">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} className="cal-day cal-empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayISO = iso(i + 1);
          return (
            <button
              key={dayISO}
              className={
                `cal-day${dayISO === todayISO ? " cal-now" : ""}` +
                `${mini && hasItems?.(dayISO) ? " cal-has" : ""}`
              }
              onClick={() => onPickDay(dayISO)}
            >
              <span className="cal-day-num">{i + 1}</span>
              {!mini ? dayMarks?.(dayISO) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Gün popup'ı: tarih + yılın kaçıncı haftası, to-do & hatırlatıcı ekleme, otomatik kaydedilen not
function CalDayPopup({
  iso,
  todayISO,
  userId,
  reminders,
  onAddReminder,
  onSaveDayNote,
  onMutated,
  onClose,
}: {
  iso: string;
  todayISO: string;
  userId: string;
  reminders: Reminder[];
  onAddReminder: (title: string, targetAt: string, description?: string) => void;
  onSaveDayNote: (dayISO: string, note: string) => void;
  onMutated: (dayISO: string) => void;
  onClose: () => void;
}) {
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [newTodo, setNewTodo] = useState("");
  const [showReminder, setShowReminder] = useState(false);

  // Not alanı: butonsuz, yazdıkça (600 ms bekleyip) otomatik kaydedilir
  const [note, setNote] = useState<string | null>(null);
  const noteRef = useRef("");
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancel = false;
    loadDayTodos(iso)
      .then((t) => { if (!cancel) setTodos(t.filter((x) => !x.habitId)); })
      .catch(() => { if (!cancel) setTodos([]); });
    loadDayNote(iso)
      .then((n) => { if (!cancel) { setNote(n); noteRef.current = n; } })
      .catch(() => { if (!cancel) setNote(""); });
    return () => { cancel = true; };
  }, [iso]);

  const flushNote = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    onSaveDayNote(iso, noteRef.current);
  };
  // Kapanırken bekleyen notu kaydet
  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    flushNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeNote(v: string) {
    setNote(v);
    noteRef.current = v;
    dirtyRef.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushNote, 600);
  }

  async function submitTodo() {
    const t = newTodo.trim();
    if (!t || !todos) return;
    setNewTodo("");
    try {
      const item = await addTodo(userId, iso, null, t, todos.length);
      setTodos((cur) => [...(cur ?? []), item]);
      onMutated(iso);
    } catch {}
  }
  function toggleTodo(id: string, done: boolean) {
    setTodos((cur) => (cur ?? []).map((t) => (t.id === id ? { ...t, done } : t)));
    setTodoDone(id, done).then(() => onMutated(iso)).catch(() => {});
  }
  function removeTodo(id: string) {
    setTodos((cur) => (cur ?? []).filter((t) => t.id !== id));
    deleteTodo(id).then(() => onMutated(iso)).catch(() => {});
  }

  const date = new Date(iso + "T00:00:00");
  const dow = (date.getDay() + 6) % 7;
  const isPastDay = iso < todayISO;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="day-popup cal-popup" onClick={(e) => e.stopPropagation()}>
        <div className="day-popup-head">
          <div>
            <span className="day-popup-title">
              {date.getDate()} {MONTH_NAMES[date.getMonth()]} {date.getFullYear()} · {DOW_FULL[dow]}
            </span>
            <div className="cal-popup-week muted small">
              Yılın {isoWeekNumber(date)}. haftası
            </div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        {/* To-do'lar */}
        {todos && todos.length > 0 ? (
          <ul className="day-popup-list cal-popup-list">
            {todos.map((t) => (
              <li className={`day-popup-item${t.done ? " done" : ""}`} key={t.id}>
                <button
                  className="cal-popup-check"
                  onClick={() => toggleTodo(t.id, !t.done)}
                  title={t.done ? "Geri al" : "Tamamla"}
                >
                  {t.done ? <IconCheck size={13} /> : <IconCircle size={13} />}
                </button>
                <span className="cal-popup-item-text">{t.title}</span>
                <button className="rtab-del-btn" onClick={() => removeTodo(t.id)}>×</button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Hatırlatıcılar */}
        {reminders.length > 0 ? (
          <ul className="day-popup-list cal-popup-list">
            {reminders.map((r) => (
              <li className="day-popup-item" key={r.id}>
                <IconBell size={13} /> {fmtTime(r.target_at)} · {r.title}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Ekleme butonları */}
        <div className="cal-popup-btns">
          <button
            className="ghost-btn"
            onClick={() => setShowTodoInput((v) => !v)}
          >
            + To-do
          </button>
          <button
            className="ghost-btn"
            disabled={isPastDay}
            title={isPastDay ? "Geçmişe hatırlatıcı kurulamaz" : undefined}
            onClick={() => setShowReminder(true)}
          >
            + Hatırlatıcı
          </button>
        </div>

        {showTodoInput ? (
          <form
            className="rtab-add-row"
            onSubmit={(e) => { e.preventDefault(); submitTodo(); }}
          >
            <input
              className="rtab-input"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Yapılacak ekle…"
              autoFocus
            />
            <button type="submit" className="rtab-add-btn">+</button>
          </form>
        ) : null}

        {/* Not alanı (buton gerektirmez, otomatik kaydedilir) */}
        <textarea
          className="cal-popup-note"
          value={note ?? ""}
          disabled={note === null}
          onChange={(e) => changeNote(e.target.value)}
          onBlur={flushNote}
          placeholder={note === null ? "Yükleniyor…" : "Bu güne not al…"}
          rows={3}
        />

        {showReminder ? (
          <ReminderPopup
            initialDate={iso}
            onAdd={(title, targetAt, desc) => {
              onAddReminder(title, targetAt, desc);
              setShowReminder(false);
            }}
            onClose={() => setShowReminder(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

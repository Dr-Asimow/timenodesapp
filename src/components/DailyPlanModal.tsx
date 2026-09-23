import { useEffect, useRef, useState } from "react";
import type { Habit, Reminder, TimeBall, TodoItem } from "../types";
import type { TodoExtra } from "../db";
import { saveDailyPlan } from "../db";
import { newId } from "../storage";
import {
  BALL_DURATIONS,
  fmtPlanMin,
  planRewards,
  plannedMinutes,
} from "../plan";
import { HabitIcon } from "./HabitIcon";
import { IconBell } from "./Icons";
import { ReminderPopup, TodoPopup } from "./RightPanel";

const DAY_NAMES = [
  "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
];
const BALL_LABEL: Record<TimeBall["duration"], string> = {
  10: "10 dk",
  30: "30 dk",
  60: "1 saat",
};

// Havuz yerleşimi: sabit ızgara hücreleri; her top id'sinden türeyen hücreye
// (doluysa sonrakine) oturur → render'lar arası zıplamaz, üst üste binmez.
const POOL_COLS = 8;
const POOL_MIN_ROWS = 4;
const POOL_CELL_H = 28;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function poolLayout(pool: TimeBall[]) {
  const rows = Math.max(POOL_MIN_ROWS, Math.ceil(pool.length / POOL_COLS));
  const n = rows * POOL_COLS;
  const taken = new Set<number>();
  const pos = new Map<string, { left: string; top: number }>();
  for (const b of pool) {
    const h = hashId(b.id);
    let cell = h % n;
    while (taken.has(cell)) cell = (cell + 1) % n;
    taken.add(cell);
    // Hücre içinde küçük, sabit bir kayma (organik görünüm)
    const jx = ((h >> 4) % 5 - 2) * 0.06;
    const jy = ((h >> 8) % 5 - 2) * 0.06;
    const col = cell % POOL_COLS;
    const row = Math.floor(cell / POOL_COLS);
    pos.set(b.id, {
      left: `${((col + 0.5 + jx) / POOL_COLS) * 100}%`,
      top: (row + 0.5 + jy) * POOL_CELL_H,
    });
  }
  return { pos, height: rows * POOL_CELL_H };
}

function Ball({ duration }: { duration: TimeBall["duration"] }) {
  return <span className={`tb tb-${duration}`} />;
}

// Sürükleme hedefi: "pool" ya da etkinlik id'si
function dropTargetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest("[data-drop]");
  return el?.getAttribute("data-drop") ?? null;
}

export function DailyPlanModal({
  userId,
  todayISO,
  displayName,
  habits,
  initialBalls,
  initialNote,
  todos,
  reminders,
  onSaveNote,
  onToggleTodo,
  onAddTodo,
  onAddReminder,
  onClose,
}: {
  userId: string;
  todayISO: string;
  displayName: string;
  habits: Habit[];
  initialBalls: TimeBall[];
  initialNote: string;
  todos: TodoItem[];
  reminders: Reminder[];
  onSaveNote: (note: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onAddTodo: (title: string, extra?: TodoExtra) => void;
  onAddReminder: (title: string, targetAt: string, description?: string) => void;
  onClose: () => void;
}) {
  const [balls, setBalls] = useState<TimeBall[]>(initialBalls);
  const [kind, setKind] = useState<TimeBall["duration"]>(30);
  const [note, setNote] = useState(initialNote);
  const [popup, setPopup] = useState<"todo" | "reminder" | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    over: string | null;
  } | null>(null);
  const dragRef = useRef<{ id: string; x0: number; y0: number; moved: boolean } | null>(
    null
  );

  // --- Otomatik kayıt (toplar + not), kapanırken bekleyeni hemen yaz ---
  const pendingBalls = useRef<TimeBall[] | null>(null);
  const pendingNote = useRef<string | null>(null);
  const saveRef = useRef(onSaveNote);
  saveRef.current = onSaveNote;

  function flush() {
    if (pendingBalls.current) {
      saveDailyPlan(userId, todayISO, pendingBalls.current).catch((e) =>
        console.warn("Günlük plan kaydedilemedi:", e)
      );
      pendingBalls.current = null;
    }
    if (pendingNote.current !== null) {
      saveRef.current(pendingNote.current);
      pendingNote.current = null;
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // İlk açılışta da yaz: satır oluşur → bugün tekrar otomatik açılmaz
  useEffect(() => {
    pendingBalls.current = balls;
    const t = setTimeout(() => flushRef.current(), 400);
    return () => clearTimeout(t);
  }, [balls]);

  useEffect(() => {
    if (note === initialNote && pendingNote.current === null) return;
    pendingNote.current = note;
    const t = setTimeout(() => flushRef.current(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  useEffect(() => () => flushRef.current(), []);

  // --- Top işlemleri ---
  const addBall = () =>
    setBalls((cur) => [...cur, { id: newId(), duration: kind, habitId: null }]);
  // Taşınan top sona alınır → satırda bırakılma sırasıyla görünür
  const moveBall = (id: string, habitId: string | null) =>
    setBalls((cur) => {
      const b = cur.find((x) => x.id === id);
      if (!b || b.habitId === habitId) return cur;
      return [...cur.filter((x) => x.id !== id), { ...b, habitId }];
    });
  const removeBall = (id: string) =>
    setBalls((cur) => cur.filter((x) => x.id !== id));

  // --- Sürükle-bırak (pointer olayları: fare + dokunmatik) ---
  function onBallDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    dragRef.current = { id, x0: e.clientX, y0: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onBallMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
    d.moved = true;
    setDrag({ id: d.id, x: e.clientX, y: e.clientY, over: dropTargetAt(e.clientX, e.clientY) });
  }
  function onBallUp(e: React.PointerEvent, ball: TimeBall) {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.moved) {
      const over = dropTargetAt(e.clientX, e.clientY);
      if (over === "pool") moveBall(ball.id, null);
      else if (over && habits.some((h) => h.id === over)) moveBall(ball.id, over);
      return;
    }
    // Tıklama: etkinlikteki top havuza döner, havuzdaki top silinir
    if (ball.habitId) moveBall(ball.id, null);
    else removeBall(ball.id);
  }
  function onBallCancel() {
    dragRef.current = null;
    setDrag(null);
  }
  const ballHandlers = (b: TimeBall) => ({
    onPointerDown: (e: React.PointerEvent) => onBallDown(e, b.id),
    onPointerMove: onBallMove,
    onPointerUp: (e: React.PointerEvent) => onBallUp(e, b),
    onPointerCancel: onBallCancel,
  });

  // --- Türetilmiş değerler ---
  const pool = balls.filter((b) => b.habitId === null);
  const layout = poolLayout(pool);
  const totalMin = habits.reduce((s, h) => s + plannedMinutes(balls, h.id), 0);
  const { xp, coin } = planRewards(totalMin);
  const dragBall = drag ? balls.find((b) => b.id === drag.id) : null;

  const d = new Date(todayISO + "T00:00:00");
  const dateLabel = `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;

  // Bugünün to-do'ları + hatırlatıcılar (önce bugünküler, sonra yaklaşanlar)
  const dayTodos = todos.filter((t) => t.day === todayISO && !t.habitId);
  const upcoming = reminders
    .filter((r) => toLocalISO(r.target_at) >= todayISO)
    .map((r) => ({ r, today: toLocalISO(r.target_at) === todayISO }))
    .sort((a, b) => Number(b.today) - Number(a.today));

  return (
    <div className="modal-overlay dp-overlay">
      <div className="modal dp-modal" role="dialog" aria-label="Günlük planlama">
        <button className="modal-x dp-x" onClick={onClose} aria-label="Kapat">×</button>

        <div className="dp-col">
          <div className="dp-date">
            <div className="dp-date-main">{dateLabel}</div>
            <div className="dp-date-day">{DAY_NAMES[d.getDay()]}</div>
          </div>

          {/* Zaman havuzu */}
          <div className="dp-pool-bar">
            <button className="dp-add" onClick={addBall} title={`${BALL_LABEL[kind]} ekle`}>+</button>
            {BALL_DURATIONS.map((k) => (
              <button
                key={k}
                className={`dp-kind${kind === k ? " active" : ""}`}
                onClick={() => setKind(k)}
                title={BALL_LABEL[k]}
              >
                <Ball duration={k} />
              </button>
            ))}
            <span className="dp-legend muted">○ 10dk · ◐ 30dk · ● 1s</span>
          </div>
          <div
            className={`dp-pool${drag?.over === "pool" ? " over" : ""}`}
            data-drop="pool"
            style={{ height: layout.height + 8 }}
          >
            {pool.length === 0 ? (
              <span className="dp-pool-empty muted small">
                Top türünü seç, + ile havuza ekle
              </span>
            ) : null}
            {pool.map((b) => {
              const p = layout.pos.get(b.id)!;
              return (
                <span
                  key={b.id}
                  className={`dp-ball${drag?.id === b.id ? " dragging" : ""}`}
                  style={{ left: p.left, top: p.top + 4 }}
                  title={`${BALL_LABEL[b.duration]} · sürükle ya da silmek için tıkla`}
                  {...ballHandlers(b)}
                >
                  <Ball duration={b.duration} />
                </span>
              );
            })}
          </div>

          {/* Etkinlikler */}
          <h3 className="dp-h">Bugün ne yapıyorsun?</h3>
          <ul className="dp-habits">
            {habits.map((h) => {
              const mine = balls.filter((b) => b.habitId === h.id);
              const empty = Math.max(5, mine.length + 1) - mine.length;
              const min = plannedMinutes(balls, h.id);
              return (
                <li
                  key={h.id}
                  className={`dp-habit${drag?.over === h.id ? " over" : ""}`}
                  data-drop={h.id}
                >
                  <span className="dp-habit-name">
                    {h.icon ? (
                      <HabitIcon
                        name={h.icon}
                        className="dp-habit-ic"
                      />
                    ) : (
                      <span className="dp-habit-dot" />
                    )}
                    <span className="dp-habit-label">{h.name}</span>
                  </span>
                  <span className="dp-slots">
                    {mine.map((b) => (
                      <span
                        key={b.id}
                        className={`dp-ball${drag?.id === b.id ? " dragging" : ""}`}
                        title={`${BALL_LABEL[b.duration]} · havuza döndürmek için tıkla`}
                        {...ballHandlers(b)}
                      >
                        <Ball duration={b.duration} />
                      </span>
                    ))}
                    {Array.from({ length: empty }).map((_, i) => (
                      <span key={i} className="dp-slot" />
                    ))}
                  </span>
                  <span className="dp-habit-min">{min ? fmtPlanMin(min) : ""}</span>
                </li>
              );
            })}
          </ul>

          <div className="dp-totals">
            <span>Odak {fmtPlanMin(totalMin)}</span>
            <span>XP: {xp}</span>
            <span>Coin: {coin}</span>
          </div>
        </div>

        <div className="dp-col">
          <h2 className="dp-welcome">
            Hoş geldin <span className="dp-accent">{displayName}</span>
          </h2>

          <h3 className="dp-h">Not</h3>
          <textarea
            className="dp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bugün için kısa bir not…"
            rows={4}
          />

          <h3 className="dp-h">Yapılacaklar ve Planlar</h3>
          <div className="dp-todos">
            <ul className="dp-todo-list">
              {dayTodos.map((t) => (
                <li key={t.id} className={`dp-todo${t.done ? " done" : ""}`}>
                  <input
                    type="checkbox"
                    className="todo-card-check"
                    checked={t.done}
                    onChange={(e) => onToggleTodo(t.id, e.target.checked)}
                  />
                  <span>{t.title}</span>
                </li>
              ))}
              {upcoming.map(({ r, today }) => (
                <li key={r.id} className="dp-todo">
                  <span className="dp-todo-bell"><IconBell size={14} /></span>
                  <span>{r.title}</span>
                  <span className="dp-todo-when muted small">
                    {fmtReminderTime(r.target_at, today)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="dp-todo-actions">
              <button className="dp-mini-btn" onClick={() => setPopup("todo")} title="To-do ekle">+</button>
              <button className="dp-mini-btn" onClick={() => setPopup("reminder")} title="Hatırlatıcı ekle">
                <IconBell size={13} />
              </button>
            </div>
          </div>

          <button className="primary-btn dp-start" onClick={onClose}>
            Güne Başla
          </button>
        </div>

        {drag && dragBall ? (
          <span className="dp-ghost" style={{ left: drag.x, top: drag.y }}>
            <Ball duration={dragBall.duration} />
          </span>
        ) : null}
      </div>

      {popup === "todo" ? (
        <TodoPopup
          onAdd={(title, extra) => {
            onAddTodo(title, extra);
            setPopup(null);
          }}
          onClose={() => setPopup(null)}
        />
      ) : popup === "reminder" ? (
        <ReminderPopup
          initialDate={todayISO}
          onAdd={(title, targetAt, desc) => {
            onAddReminder(title, targetAt, desc);
            setPopup(null);
          }}
          onClose={() => setPopup(null)}
        />
      ) : null}
    </div>
  );
}

function toLocalISO(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Bugünkü hatırlatıcı → "14:30", sonraki günler → "25.09 14:30"
function fmtReminderTime(ts: string, today: boolean): string {
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (today) return hm;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
}

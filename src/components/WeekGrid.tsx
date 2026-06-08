import { useEffect, useState } from "react";
import type { ActiveTimer, Habit, TimerConfig, TodoItem, WeekData } from "../types";
import { addDays, newId, toISODate } from "../storage";
import { isRunning } from "../timer";
import { heatLevel, formatMinutes, formatHours } from "../heat";
import { loadDayTodos } from "../db";
import { CellPopover } from "./CellPopover";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

type CellSel = { habitId: string; day: number } | null;
export type DayType = "today" | "past" | "future";

// Belirli bir sayaca (ActiveTimer) etki eden kontrol fonksiyonları
export type TimerActions = {
  pause: (t: ActiveTimer) => void;
  resume: (t: ActiveTimer) => void;
  startBreak: (t: ActiveTimer, breakTargetMs: number | null) => void;
  resumeWork: (t: ActiveTimer) => void;
  ack: (t: ActiveTimer) => void;
  finish: (t: ActiveTimer) => void;
  cancel: (t: ActiveTimer) => void;
};

export function WeekGrid({
  week,
  activeTimers,
  onChange,
  onStartTimer,
  timerActions,
  sel,
  onSelChange,
}: {
  week: WeekData;
  activeTimers: ActiveTimer[];
  onChange: (w: WeekData) => void;
  onStartTimer: (habitId: string, day: number, config: TimerConfig) => void;
  timerActions: TimerActions;
  // Seçili hücre (popover) App'te tutulur ki DayPanel de açabilsin
  sel: CellSel;
  onSelChange: (sel: CellSel) => void;
}) {
  const setSel = onSelChange;
  const [newHabit, setNewHabit] = useState("");
  const [adding, setAdding] = useState(false);
  // Gün notu modalı için seçili gün (0..6) ya da null
  const [dayNoteSel, setDayNoteSel] = useState<number | null>(null);
  // Sürükle-bırak yeniden sıralama
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // Crosshair: imlecin üzerinde olduğu sütun (gün). Satır CSS :hover ile.
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const todayISO = toISODate(new Date());
  const days = DAY_LABELS.map((label, i) => {
    const d = addDays(week.startDate, i);
    return {
      label,
      date: d.getDate(),
      iso: d,
      isToday: toISODate(d) === todayISO,
    };
  });

  function setMinutes(habitId: string, day: number, value: number) {
    const next = Math.max(0, value);
    const row = (week.minutes[habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
    row[day] = next;
    onChange({ ...week, minutes: { ...week.minutes, [habitId]: row } });
  }

  function setActivityNote(habitId: string, day: number, note: string) {
    const row = (
      week.notes[habitId] ?? [null, null, null, null, null, null, null]
    ).slice();
    row[day] = note.trim() ? note : null;
    onChange({ ...week, notes: { ...week.notes, [habitId]: row } });
  }

  function setDayNoteAt(day: number, note: string) {
    const row = week.dayNotes.slice();
    row[day] = note.trim() ? note : null;
    onChange({ ...week, dayNotes: row });
  }

  function addMinutes(habitId: string, day: number, delta: number) {
    const cur = week.minutes[habitId]?.[day] ?? 0;
    // 0'ın altına düşmez (setMinutes Math.max(0,...) ile clamp'ler)
    setMinutes(habitId, day, cur + delta);
  }


  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    const h: Habit = { id: newId(), name };
    onChange({
      ...week,
      habits: [...week.habits, h],
      minutes: { ...week.minutes, [h.id]: [0, 0, 0, 0, 0, 0, 0] },
      breaks: { ...week.breaks, [h.id]: [0, 0, 0, 0, 0, 0, 0] },
      notes: {
        ...week.notes,
        [h.id]: [null, null, null, null, null, null, null],
      },
    });
    setNewHabit("");
    setAdding(false);
  }

  // Alışkanlık satırını from→to konumuna taşı (tüm satır verisi habit.id'ye bağlı, sadece sıra değişir)
  function moveHabit(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const habits = week.habits.slice();
    const [moved] = habits.splice(from, 1);
    habits.splice(to, 0, moved);
    onChange({ ...week, habits });
  }

  function dayTypeOf(day: number): DayType {
    const iso = toISODate(addDays(week.startDate, day));
    if (iso === todayISO) return "today";
    return iso < todayISO ? "past" : "future";
  }

  function removeHabit(habitId: string) {
    const h = week.habits.find((x) => x.id === habitId);
    if (!confirm(`"${h?.name}" alışkanlığı silinsin mi?`)) return;
    const minutes = { ...week.minutes };
    const breaks = { ...week.breaks };
    const notes = { ...week.notes };
    delete minutes[habitId];
    delete breaks[habitId];
    delete notes[habitId];
    onChange({
      ...week,
      habits: week.habits.filter((x) => x.id !== habitId),
      minutes,
      breaks,
      notes,
    });
  }

  const rowTotal = (habitId: string) =>
    (week.minutes[habitId] ?? []).reduce((a, b) => a + b, 0);
  const colTotal = (day: number) =>
    week.habits.reduce((a, h) => a + (week.minutes[h.id]?.[day] ?? 0), 0);
  const grandTotal = week.habits.reduce((a, h) => a + rowTotal(h.id), 0);

  const rangeStart = days[0];
  const rangeEnd = days[6];

  return (
    <div className="week">
      <div className="week-head">
        <div className="week-no">
          <span className="muted small">HAFTA</span>
          <span className="week-no-big">{week.weekNumber}</span>
        </div>
        <div className="week-range muted">
          {rangeStart.date} – {rangeEnd.date} · {week.year}
        </div>
        <div className="week-total">
          <span className="muted small">Toplam</span>
          <span className="week-total-big">{formatHours(grandTotal)} sa</span>
        </div>
      </div>

      <div className="grid-scroll">
        <table className="grid" onMouseLeave={() => setHoverDay(null)}>
          <thead>
            <tr>
              <th className="habit-col">Alışkanlık</th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className={`day-col ${d.isToday ? "today" : ""} ${
                    hoverDay === i ? "col-hl-head" : ""
                  }`}
                >
                  {d.isToday ? <span className="today-dot" /> : null}
                  <button
                    className="day-head-btn"
                    title="Gün notu ekle/gör"
                    onClick={() => setDayNoteSel(i)}
                  >
                    <span className="day-label">{d.label}</span>
                    <span className="day-date">{d.date}</span>
                    {week.dayNotes[i] ? <span className="note-dot" /> : null}
                  </button>
                </th>
              ))}
              <th className="total-col">(+)</th>
            </tr>
          </thead>
          <tbody>
            {week.habits.map((h, hIdx) => (
              <tr
                key={h.id}
                className={`${dragIdx === hIdx ? "dragging" : ""} ${
                  overIdx === hIdx && dragIdx !== null && dragIdx !== hIdx
                    ? "drag-over"
                    : ""
                }`}
                onDragOver={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  if (overIdx !== hIdx) setOverIdx(hIdx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) moveHabit(dragIdx, hIdx);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
              >
                <th className="habit-name">
                  <span
                    className="drag-handle"
                    title="Sürükleyerek sırala"
                    draggable
                    onDragStart={(e) => {
                      setDragIdx(hIdx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                  >
                    ⠿
                  </span>
                  <button
                    className="habit-link"
                    title="Alışkanlık sayfası (yakında)"
                  >
                    {h.name}
                  </button>
                  <button
                    className="row-del"
                    title="Sil"
                    onClick={() => removeHabit(h.id)}
                  >
                    ×
                  </button>
                </th>
                {days.map((_, day) => {
                  const mins = week.minutes[h.id]?.[day] ?? 0;
                  const brk = week.breaks[h.id]?.[day] ?? 0;
                  const lvl = heatLevel(mins);
                  const isSel =
                    sel && sel.habitId === h.id && sel.day === day;
                  const timer = activeTimers.find(
                    (t) => t.habitId === h.id && t.day === day
                  );
                  const timingState = timer
                    ? isRunning(timer)
                      ? "running"
                      : "pausedt"
                    : "";
                  const isFuture = dayTypeOf(day) === "future";
                  const hasNote = !!week.notes[h.id]?.[day];
                  const tip = hasNote
                    ? `📝 ${week.notes[h.id]![day]}`
                    : isFuture
                    ? "Gelecek gün — plan/not bırakabilirsin"
                    : mins > 0 || brk > 0
                    ? `Çalışma ${formatMinutes(mins)} · Ara ${formatMinutes(brk)}`
                    : "boş";
                  return (
                    <td
                      key={day}
                      className={`cell-td ${days[day].isToday ? "today-col" : ""} ${
                        hoverDay === day ? "col-hl" : ""
                      }`}
                      onMouseEnter={() => setHoverDay(day)}
                    >
                      <button
                        className={`cell lvl-${lvl} ${isSel ? "sel" : ""} ${timingState}`}
                        title={tip}
                        onClick={() =>
                          setSel(isSel ? null : { habitId: h.id, day })
                        }
                      >
                        {timer ? (
                          <span
                            className={`cell-timer-dot ${
                              isRunning(timer) ? "live" : "held"
                            }`}
                          />
                        ) : null}
                        {hasNote ? <span className="cell-note-dot" /> : null}
                      </button>
                    </td>
                  );
                })}
                <td className="total-td">{formatHours(rowTotal(h.id))}</td>
              </tr>
            ))}
            <tr className="add-habit-row">
              <td colSpan={days.length + 2}>
                <button className="add-habit-btn" onClick={() => setAdding(true)}>
                  + Alışkanlık ekle
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th className="habit-name foot">Günlük</th>
              {days.map((_, day) => (
                <td
                  key={day}
                  className={`total-td ${days[day].isToday ? "today-col" : ""} ${
                    hoverDay === day ? "col-hl" : ""
                  }`}
                  onMouseEnter={() => setHoverDay(day)}
                >
                  {formatHours(colTotal(day))}
                </td>
              ))}
              <td className="total-td grand">{formatHours(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="legend">
        <span className="muted small">Az</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`legend-box lvl-${l}`} />
        ))}
        <span className="muted small">Çok</span>
      </div>

      {sel
        ? (() => {
            const h = week.habits.find((x) => x.id === sel.habitId);
            if (!h) return null;
            const timer = activeTimers.find(
              (t) => t.habitId === sel.habitId && t.day === sel.day
            );
            const timingState = timer
              ? isRunning(timer)
                ? "running"
                : "pausedt"
              : "";
            return (
              <CellPopover
                dayType={dayTypeOf(sel.day)}
                dayLabel={`${days[sel.day].date} ${
                  MONTHS_TR[days[sel.day].iso.getMonth()]
                } ${DAY_LABELS[sel.day]}`}
                habitName={h.name}
                workMin={week.minutes[h.id]?.[sel.day] ?? 0}
                breakMin={week.breaks[h.id]?.[sel.day] ?? 0}
                note={week.notes[h.id]?.[sel.day] ?? null}
                timerState={timingState}
                timer={timer ?? null}
                timerActions={
                  timer
                    ? {
                        pause: () => timerActions.pause(timer),
                        resume: () => timerActions.resume(timer),
                        startBreak: (target) =>
                          timerActions.startBreak(timer, target),
                        resumeWork: () => timerActions.resumeWork(timer),
                        ack: () => timerActions.ack(timer),
                        finish: () => timerActions.finish(timer),
                        cancel: () => timerActions.cancel(timer),
                      }
                    : null
                }
                onStartTimer={(config) => {
                  // Başlat'ta popup'ı KAPATMA: kullanıcı çalışan sayacı
                  // büyükçe popup içinde görsün, geri dönüp dönmemek ona kalsın.
                  onStartTimer(h.id, sel.day, config);
                }}
                onAddWork={(d) => addMinutes(h.id, sel.day, d)}
                onSetNote={(note) => setActivityNote(h.id, sel.day, note)}
                onClose={() => setSel(null)}
              />
            );
          })()
        : null}

      {dayNoteSel !== null ? (
        <DaySummaryModal
          dayLabel={`${days[dayNoteSel].date} ${
            MONTHS_TR[days[dayNoteSel].iso.getMonth()]
          } ${DAY_LABELS[dayNoteSel]}`}
          dayISO={toISODate(addDays(week.startDate, dayNoteSel))}
          breakdown={week.habits.map((h) => ({
            name: h.name,
            work: week.minutes[h.id]?.[dayNoteSel] ?? 0,
            brk: week.breaks[h.id]?.[dayNoteSel] ?? 0,
          }))}
          note={week.dayNotes[dayNoteSel] ?? ""}
          onSaveNote={(note) => setDayNoteAt(dayNoteSel, note)}
          onClose={() => setDayNoteSel(null)}
        />
      ) : null}

      {adding ? (
        <div
          className="modal-overlay"
          onClick={() => {
            setNewHabit("");
            setAdding(false);
          }}
        >
          <form
            className="modal habit-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              addHabit();
            }}
          >
            <h2 className="modal-title">Yeni alışkanlık</h2>
            <input
              autoFocus
              className="habit-modal-input"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder="Alışkanlık ismi…"
            />
            <div className="modal-actions">
              <button className="primary-btn" type="submit">
                Ekle
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setNewHabit("");
                  setAdding(false);
                }}
              >
                Vazgeç
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

// Gün başlığına tıklayınca: o günün GÜNDEM özeti (yapılacaklar + süre dağılımı + not)
type DayBreakdown = { name: string; work: number; brk: number };

function DaySummaryModal({
  dayLabel,
  dayISO,
  breakdown,
  note,
  onSaveNote,
  onClose,
}: {
  dayLabel: string;
  dayISO: string;
  breakdown: DayBreakdown[];
  note: string;
  onSaveNote: (note: string) => void;
  onClose: () => void;
}) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [val, setVal] = useState(note);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    loadDayTodos(dayISO)
      .then((t) => {
        if (!cancel) {
          setTodos(t);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [dayISO]);

  function close() {
    if ((val ?? "") !== (note ?? "")) onSaveNote(val);
    onClose();
  }

  const habitItems = todos.filter((t) => t.habitId);
  const todoItems = todos.filter((t) => !t.habitId);
  const worked = breakdown.filter((b) => b.work > 0 || b.brk > 0);
  const totalWork = breakdown.reduce((a, b) => a + b.work, 0);

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal day-summary" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">{dayLabel}</span>
          <button className="modal-x" onClick={close} aria-label="Kapat">
            ×
          </button>
        </div>

        <section className="ds-section">
          <h4 className="ds-title">Gündem</h4>
          {loading ? (
            <p className="muted small">Yükleniyor…</p>
          ) : todos.length === 0 ? (
            <p className="muted small">Bu güne gündem eklenmemiş.</p>
          ) : (
            <div className="ds-list">
              {habitItems.map((it) => (
                <div className="ds-item habit" key={it.id}>
                  <span className="ds-dot" />
                  <span className="ds-item-text">{it.title}</span>
                </div>
              ))}
              {todoItems.map((it) => (
                <div className={`ds-item todo ${it.done ? "done" : ""}`} key={it.id}>
                  <span className="ds-check">{it.done ? "✓" : "○"}</span>
                  <span className="ds-item-text">{it.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ds-section">
          <h4 className="ds-title">Süre dağılımı</h4>
          {worked.length === 0 ? (
            <p className="muted small">Bu gün kayıtlı süre yok.</p>
          ) : (
            <div className="ds-list">
              {worked.map((b) => (
                <div className="ds-time" key={b.name}>
                  <span className="ds-time-name">{b.name}</span>
                  <span className="ds-time-val">
                    {formatMinutes(b.work)}
                    {b.brk > 0 ? (
                      <span className="muted"> · {formatMinutes(b.brk)} mola</span>
                    ) : null}
                  </span>
                </div>
              ))}
              <div className="ds-time total">
                <span className="ds-time-name">Toplam</span>
                <span className="ds-time-val">{formatMinutes(totalWork)}</span>
              </div>
            </div>
          )}
        </section>

        <section className="ds-section">
          <h4 className="ds-title">Gün notu</h4>
          <textarea
            className="note-area"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Bu güne dair genel notun…"
            rows={3}
          />
        </section>
      </div>
    </div>
  );
}

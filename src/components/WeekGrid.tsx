import { useState } from "react";
import type { ActiveTimer, Habit, TimerConfig, WeekData } from "../types";
import { addDays, newId, toISODate } from "../storage";
import { isRunning } from "../timer";
import { heatLevel, formatMinutes, formatHours } from "../heat";
import { CellPopover } from "./CellPopover";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

type CellSel = { habitId: string; day: number } | null;
export type DayType = "today" | "past" | "future";

export function WeekGrid({
  week,
  activeTimers,
  onChange,
  onStartTimer,
}: {
  week: WeekData;
  activeTimers: ActiveTimer[];
  onChange: (w: WeekData) => void;
  onStartTimer: (habitId: string, day: number, config: TimerConfig) => void;
}) {
  const [sel, setSel] = useState<CellSel>(null);
  const [newHabit, setNewHabit] = useState("");
  const [adding, setAdding] = useState(false);

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

  function addMinutes(habitId: string, day: number, delta: number) {
    const cur = week.minutes[habitId]?.[day] ?? 0;
    if (delta < 0 && cur + delta < cur) {
      if (!confirm(`${formatMinutes(Math.abs(delta))} çıkarılsın mı?`)) return;
    }
    setMinutes(habitId, day, cur + delta);
  }

  function clearCell(habitId: string, day: number) {
    if (confirm("Bu hücre sıfırlansın mı?")) setMinutes(habitId, day, 0);
  }

  // Mola dakikaları (week.breaks) düzenleme
  function setBreakMinutes(habitId: string, day: number, value: number) {
    const next = Math.max(0, value);
    const row = (week.breaks[habitId] ?? [0, 0, 0, 0, 0, 0, 0]).slice();
    row[day] = next;
    onChange({ ...week, breaks: { ...week.breaks, [habitId]: row } });
  }

  function addBreakMinutes(habitId: string, day: number, delta: number) {
    const cur = week.breaks[habitId]?.[day] ?? 0;
    if (delta < 0) {
      if (!confirm(`${formatMinutes(Math.abs(delta))} mola çıkarılsın mı?`))
        return;
    }
    setBreakMinutes(habitId, day, cur + delta);
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
    });
    setNewHabit("");
    setAdding(false);
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
    delete minutes[habitId];
    delete breaks[habitId];
    onChange({
      ...week,
      habits: week.habits.filter((x) => x.id !== habitId),
      minutes,
      breaks,
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
        <table className="grid">
          <thead>
            <tr>
              <th className="habit-col">Alışkanlık</th>
              {days.map((d, i) => (
                <th key={i} className={`day-col ${d.isToday ? "today" : ""}`}>
                  {d.isToday ? <span className="today-dot" /> : null}
                  <div className="day-label">{d.label}</div>
                  <div className="day-date">{d.date}</div>
                </th>
              ))}
              <th className="total-col">(+)</th>
            </tr>
          </thead>
          <tbody>
            {week.habits.map((h) => (
              <tr key={h.id}>
                <th className="habit-name">
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
                  const tip =
                    mins > 0 || brk > 0
                      ? `Çalışma ${formatMinutes(mins)} · Ara ${formatMinutes(
                          brk
                        )}`
                      : "boş";
                  return (
                    <td
                      key={day}
                      className={`cell-td ${days[day].isToday ? "today-col" : ""}`}
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
                  className={`total-td ${days[day].isToday ? "today-col" : ""}`}
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
                dayLabel={DAY_LABELS[sel.day]}
                habitName={h.name}
                workMin={week.minutes[h.id]?.[sel.day] ?? 0}
                breakMin={week.breaks[h.id]?.[sel.day] ?? 0}
                timerState={timingState}
                onStartTimer={(config) => {
                  onStartTimer(h.id, sel.day, config);
                  setSel(null);
                }}
                onAddWork={(d) => addMinutes(h.id, sel.day, d)}
                onAddBreak={(d) => addBreakMinutes(h.id, sel.day, d)}
                onClearWork={() => clearCell(h.id, sel.day)}
                onClose={() => setSel(null)}
              />
            );
          })()
        : null}

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

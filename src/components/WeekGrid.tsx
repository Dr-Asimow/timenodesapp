import { useEffect, useState } from "react";
import type { ActiveTimer, Habit, TimerConfig, TodoItem, WeekData } from "../types";
import { addDays, newId, toISODate } from "../storage";
import { isRunning } from "../timer";
import { heatLevel, formatMinutes } from "../heat";
import { loadDayTodos } from "../db";
import { CellPopover } from "./CellPopover";
import { IconNote, IconCheck, IconCircle } from "./Icons";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const FULL_DAY_LABELS = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];
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
  userId,
  activeTimers,
  onChange,
  onStartTimer,
  timerActions,
  sel,
  onSelChange,
  onOpenDayNote,
  onOpenHabitPage,
  prevTotals,
  viewingOther,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  week: WeekData;
  userId: string;
  activeTimers: ActiveTimer[];
  onChange: (w: WeekData) => void;
  onStartTimer: (habitId: string, day: number, config: TimerConfig) => void;
  timerActions: TimerActions;
  // Seçili hücre (popover) App'te tutulur ki DayPanel de açabilsin
  sel: CellSel;
  onSelChange: (sel: CellSel) => void;
  // O günün günlüğünü (Not Defteri) aç
  onOpenDayNote: (dayISO: string, label: string) => void;
  // Etkinliğin kalıcı not sayfasını aç
  onOpenHabitPage: (habitId: string, name: string) => void;
  // Geçen haftanın alışkanlık bazında toplam çalışma dk'sı (habitId→dk)
  prevTotals: Record<string, number> | null;
  // Hafta gezinmesi: önceki/sonraki hafta ve güncel haftaya dön
  viewingOther: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}) {
  const setSel = onSelChange;
  const [newHabit, setNewHabit] = useState("");
  const [adding, setAdding] = useState(false);
  // Gün detayı panelinde seçili gün (0..6) — varsayılan: bugün
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const iso = toISODate(new Date());
    for (let i = 0; i < 7; i++) {
      if (toISODate(addDays(week.startDate, i)) === iso) return i;
    }
    return 0;
  });
  // Seçili günün gündemi (gün detayı paneli)
  const [dayTodos, setDayTodos] = useState<TodoItem[]>([]);
  const [dayTodosLoading, setDayTodosLoading] = useState(true);
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

  const selectedISO = toISODate(addDays(week.startDate, selectedDay));

  useEffect(() => {
    let cancel = false;
    setDayTodosLoading(true);
    loadDayTodos(selectedISO)
      .then((t) => {
        if (!cancel) {
          setDayTodos(t);
          setDayTodosLoading(false);
        }
      })
      .catch(() => {
        if (!cancel) setDayTodosLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [selectedISO]);

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

  function addMinutes(habitId: string, day: number, delta: number) {
    const cur = week.minutes[habitId]?.[day] ?? 0;
    // 0'ın altına düşmez (setMinutes Math.max(0,...) ile clamp'ler)
    setMinutes(habitId, day, cur + delta);
  }


  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    const h: Habit = { id: newId(), name, color: null };
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
    if (!confirm(`"${h?.name}" etkinliği silinsin mi?`)) return;
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
  const prevGrand = week.habits.reduce(
    (a, h) => a + (prevTotals?.[h.id] ?? 0),
    0
  );
  const completedHabits = week.habits.filter((h) => rowTotal(h.id) > 0).length;
  const changePct =
    prevGrand > 0 ? Math.round(((grandTotal - prevGrand) / prevGrand) * 100) : null;

  const rangeStart = days[0];
  const rangeEnd = days[6];
  const startMonth = rangeStart.iso.getMonth();
  const endMonth = rangeEnd.iso.getMonth();
  const rangeLabel =
    startMonth === endMonth
      ? `${rangeStart.date} – ${rangeEnd.date} ${MONTHS_TR[endMonth]} ${week.year}`
      : `${rangeStart.date} ${MONTHS_TR[startMonth]} – ${rangeEnd.date} ${MONTHS_TR[endMonth]} ${week.year}`;

  // Heatmap altındaki "Gün detayı" paneli için seçili güne ait veriler
  const selectedTotal = colTotal(selectedDay);
  const selectedWorked = week.habits
    .map((h) => ({
      name: h.name,
      color: h.color,
      work: week.minutes[h.id]?.[selectedDay] ?? 0,
    }))
    .filter((b) => b.work > 0);
  const selectedLabel = `${days[selectedDay].date} ${
    MONTHS_TR[days[selectedDay].iso.getMonth()]
  } ${FULL_DAY_LABELS[selectedDay]}`;
  const selectedTodoItems = dayTodos.filter((t) => !t.habitId);

  return (
    <>
    <div className="week">
      <div className="week-head">
        <div className="week-no">
          <span className="muted small">HAFTA</span>
          <span className="week-no-big">{week.weekNumber}</span>
        </div>
        <div className="week-range muted">
          {rangeLabel}
        </div>
        <div className="week-nav">
          <button
            className="week-nav-btn"
            title="Önceki hafta"
            onClick={onPrevWeek}
          >
            ‹
          </button>
          {viewingOther ? (
            <button
              className="week-nav-today"
              title="Bugüne dön"
              onClick={onToday}
            >
              Bugüne dön
            </button>
          ) : null}
          <button
            className="week-nav-btn"
            title="Sonraki hafta"
            onClick={onNextWeek}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid-row">
        <div className="grid-scroll">
          <table className="grid" onMouseLeave={() => setHoverDay(null)}>
          <thead>
            <tr>
              <th className="habit-col">Etkinlik</th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className={`day-col ${d.isToday ? "today" : ""} ${
                    selectedDay === i ? "selected-day" : ""
                  } ${hoverDay === i ? "col-hl-head" : ""}`}
                >
                  {d.isToday ? <span className="today-dot" /> : null}
                  <button
                    className="day-head-btn"
                    title="Gün detayını göster"
                    onClick={() => setSelectedDay(i)}
                  >
                    <span className="day-label">{d.label}</span>
                    <span className="day-date">{d.date}</span>
                  </button>
                </th>
              ))}
              <th className="total-col">
                toplam saat
                <span className="muted small"> (+)</span>
              </th>
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
                  <span
                    className="habit-dot"
                    style={{ background: h.color || "var(--accent)" }}
                  />
                  <button
                    className="habit-link"
                    title="Etkinlik sayfasını aç"
                    onClick={() => onOpenHabitPage(h.id, h.name)}
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
                    ? `✎ ${week.notes[h.id]![day]}`
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
                        data-cell-id={`${h.id}:${day}`}
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
                <td className="total-td">{formatMinutes(rowTotal(h.id))}</td>
              </tr>
            ))}
            <tr className="add-habit-row">
              <td colSpan={days.length + 2}>
                <button className="add-habit-btn" onClick={() => setAdding(true)}>
                  + Etkinlik ekle
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
                  {formatMinutes(colTotal(day))}
                </td>
              ))}
              <td className="total-td grand">{formatMinutes(grandTotal)}</td>
            </tr>
          </tfoot>
          </table>
        </div>

        <aside className="lw-hud">
          <div className="lw-head">geçen hafta</div>
          <div className="lw-list">
            {week.habits.map((h) => (
              <div className="lw-row" key={h.id}>
                {prevTotals ? formatMinutes(prevTotals[h.id] ?? 0) : "—"}
              </div>
            ))}
          </div>
          <div className="lw-addspacer" />
          <div className="lw-foot">
            {prevTotals ? formatMinutes(prevGrand) : "—"}
          </div>
        </aside>
      </div>

      <div className="legend">
        <span className="muted small">Az</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`legend-box lvl-${l}`} />
        ))}
        <span className="muted small">Çok</span>
      </div>

      <div className="day-detail">
        <div className="day-detail-head">
          <span>
            <span className="ds-dot" /> {selectedLabel}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="day-detail-total">
              Toplam {formatMinutes(selectedTotal)}
            </span>
            <button
              className="notebook-btn-sm"
              onClick={() => onOpenDayNote(selectedISO, selectedLabel)}
            >
              📓 Günlük
            </button>
          </div>
        </div>
        <div className="day-detail-cols">
          <div className="day-detail-col">
            <h4 className="ds-title">Aktiviteler</h4>
            {selectedWorked.length === 0 ? (
              <p className="muted small">Bu gün kayıtlı süre yok.</p>
            ) : (
              <div className="habit-bars">
                {selectedWorked.map((b) => (
                  <div className="habit-bar-row" key={b.name}>
                    <span className="habit-bar-name">
                      <span
                        className="habit-dot"
                        style={{ background: b.color || "var(--accent)" }}
                      />
                      <span className="habit-bar-name-text">{b.name}</span>
                    </span>
                    <div className="habit-bar-track">
                      <div
                        className="habit-bar-fill"
                        style={{
                          width: `${
                            selectedTotal > 0 ? (b.work / selectedTotal) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="habit-bar-val">{formatMinutes(b.work)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="day-detail-col">
            <h4 className="ds-title">Yapılacaklar</h4>
            {dayTodosLoading ? (
              <p className="muted small">Yükleniyor…</p>
            ) : selectedTodoItems.length === 0 ? (
              <p className="muted small">Bu güne yapılacak eklenmemiş.</p>
            ) : (
              <div className="ds-list">
                {selectedTodoItems.map((it) => (
                  <div
                    className={`ds-item todo ${it.done ? "done" : ""}`}
                    key={it.id}
                  >
                    <span className="ds-check">{it.done ? <IconCheck size={13} /> : <IconCircle size={13} />}</span>
                    <span className="ds-item-text">{it.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                habitId={h.id}
                dayISO={toISODate(days[sel.day].iso)}
                userId={userId}
                habitName={h.name}
                workMin={week.minutes[h.id]?.[sel.day] ?? 0}
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
            <h2 className="modal-title">Yeni etkinlik</h2>
            <input
              autoFocus
              className="habit-modal-input"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder="Etkinlik ismi…"
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
    </>
  );
}

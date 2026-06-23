import { useEffect, useState } from "react";
import { addDays, mondayOf, toISODate } from "../storage";
import { formatMinutes, heatLevel } from "../heat";
import { loadDayTodos } from "../db";
import type { HabitSeries } from "../db";
import type { Reminder, TodoItem } from "../types";

const MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];
const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function rangeLabel(startISO: string): string {
  const a = addDays(startISO, 0);
  const b = addDays(startISO, 6);
  const am = MONTHS[a.getMonth()];
  const bm = MONTHS[b.getMonth()];
  return am === bm
    ? `${a.getDate()}–${b.getDate()} ${am}`
    : `${a.getDate()} ${am} – ${b.getDate()} ${bm}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${DAY_NAMES[dow]}`;
}

// Bir günün etkinlik bazında süre kırılımı (habitSeries.daily'den, azalan)
function dayBreakdown(
  habitSeries: HabitSeries[] | null,
  iso: string
): { name: string; color: string | null; min: number }[] {
  if (!habitSeries) return [];
  return habitSeries
    .map((h) => ({ name: h.name, color: h.color, min: h.daily[iso] ?? 0 }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);
}

const PALETTE = ["#5b8def", "#e5894d", "#3fb950", "#a371f7", "#f778ba", "#e3b341"];

export function WeeksPage({
  year,
  weeks,
  totals,
  habitSeries,
  reminders,
  currentStartISO,
  onOpenWeek,
  onOpenDayNote,
}: {
  year: number;
  weeks: { weekNumber: number; startISO: string }[];
  totals: Record<number, number[]> | null;
  habitSeries: HabitSeries[] | null;
  reminders: Reminder[];
  currentStartISO: string;
  onOpenWeek: (startISO: string) => void;
  onOpenDayNote: (dayISO: string, label: string) => void;
}) {
  const [popupDay, setPopupDay] = useState<string | null>(null);
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);

  // günISO → dk (weeks + totals'tan; yeni sorgu yok)
  const daily: Record<string, number> = {};
  weeks.forEach((w) => {
    const days = totals?.[w.weekNumber];
    if (days) days.forEach((dk, d) => {
      daily[toISODate(addDays(w.startISO, d))] = dk;
    });
  });

  let lastMonth = -1;
  const yearCols = weeks.map((w) => {
    const wMonth = addDays(w.startISO, 0).getMonth();
    const showMonth = wMonth !== lastMonth;
    lastMonth = wMonth;
    return { w, monthLabel: showMonth ? MONTHS[wMonth] : "" };
  });

  // Tek ısı hücresi (yıllık + aylık ortak): tıkla→popup, hover→ipucu
  const cell = (date: Date, key: string) => {
    const iso = toISODate(date);
    const dk = daily[iso] ?? 0;
    return (
      <button
        key={key}
        className={`heat-cell lvl-${heatLevel(dk)}`}
        onClick={() => setPopupDay(iso)}
        onMouseEnter={(e) => setHover({ iso, x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setHover({ iso, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHover(null)}
      />
    );
  };

  const hoverItems = hover ? dayBreakdown(habitSeries, hover.iso) : [];
  const hoverMax = Math.max(1, ...hoverItems.map((i) => i.min));

  return (
    <div className="weeks-page">
      <div className="weeks-head">
        <h2>Haftalar · {year}</h2>
        <span className="muted small">
          Bir haftaya tıkla → o haftayı düzenle / notlarına bak
        </span>
      </div>

      <div className="weeks-grid">
        {weeks.map((w) => {
          const days = totals?.[w.weekNumber] ?? null;
          const total = days ? days.reduce((a, b) => a + b, 0) : 0;
          const state =
            w.startISO === currentStartISO
              ? "current"
              : w.startISO < currentStartISO
              ? "past"
              : "future";
          return (
            <button
              key={w.startISO}
              className={`wk-tile ${state}`}
              onClick={() => onOpenWeek(w.startISO)}
              title={rangeLabel(w.startISO)}
            >
              <div className="wk-top-row">
                <span className="wk-no">{w.weekNumber}</span>
                {total > 0 ? (
                  <span className="wk-total">{formatMinutes(total)}</span>
                ) : null}
              </div>
              <span className="wk-range muted">{rangeLabel(w.startISO)}</span>
              <div className="wk-mini-heat" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <div
                    key={d}
                    className={`wk-mini-cell lvl-${heatLevel(days?.[d] ?? 0)}`}
                  />
                ))}
              </div>
              {state === "current" ? <span className="wk-tag">bu hafta</span> : null}
            </button>
          );
        })}
      </div>

      {/* Yıllık ısı haritası (timeline) */}
      <div className="heatmap-section">
        <h3 className="heatmap-title">Yıllık ısı haritası</h3>
        <div className="year-heat-scroll">
          <div className="year-heat-months">
            {yearCols.map(({ w, monthLabel }) => (
              <span className="year-heat-month" key={w.startISO}>{monthLabel}</span>
            ))}
          </div>
          <div className="year-heat">
            {yearCols.map(({ w }) => (
              <div className="year-heat-col" key={w.startISO}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => cell(addDays(w.startISO, d), `${w.startISO}:${d}`))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aylık ısı haritası (timeline) */}
      <div className="heatmap-section">
        <h3 className="heatmap-title">Aylık ısı haritası</h3>
        <div className="month-heat-strip">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => {
            const first = new Date(year, m, 1);
            const offset = (first.getDay() + 6) % 7;
            const daysInMonth = new Date(year, m + 1, 0).getDate();
            return (
              <div className="month-heat" key={m}>
                <div className="month-heat-title">{MONTHS[m]}</div>
                <div className="month-heat-grid">
                  {Array.from({ length: offset }).map((_, i) => (
                    <div key={`e${i}`} className="heat-cell empty" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) =>
                    cell(new Date(year, m, i + 1), `${m}:${i}`)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Masaüstü hover ipucu (fare yanında) */}
      {hover && hoverItems.length > 0 ? (
        <div
          className="heat-tip"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="heat-tip-day">{dayLabel(hover.iso)}</div>
          {hoverItems.map((it, i) => (
            <div className="heat-tip-row" key={it.name}>
              <span className="heat-tip-name">{it.name}</span>
              <div className="heat-tip-track">
                <div
                  className="heat-tip-fill"
                  style={{
                    width: `${(it.min / hoverMax) * 100}%`,
                    background: it.color || PALETTE[i % PALETTE.length],
                  }}
                />
              </div>
              <span className="heat-tip-val">{formatMinutes(it.min)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Gün detay popup'ı */}
      {popupDay ? (
        <DayPopup
          iso={popupDay}
          breakdown={dayBreakdown(habitSeries, popupDay)}
          reminders={reminders.filter(
            (r) => toISODate(new Date(r.target_at)) === popupDay
          )}
          onOpenDayNote={onOpenDayNote}
          onGoToWeek={() =>
            onOpenWeek(toISODate(mondayOf(new Date(popupDay + "T00:00:00"))))
          }
          onClose={() => setPopupDay(null)}
        />
      ) : null}
    </div>
  );
}

function DayPopup({
  iso,
  breakdown,
  reminders,
  onOpenDayNote,
  onGoToWeek,
  onClose,
}: {
  iso: string;
  breakdown: { name: string; color: string | null; min: number }[];
  reminders: Reminder[];
  onOpenDayNote: (dayISO: string, label: string) => void;
  onGoToWeek: () => void;
  onClose: () => void;
}) {
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  useEffect(() => {
    let cancel = false;
    loadDayTodos(iso)
      .then((t) => { if (!cancel) setTodos(t.filter((x) => !x.habitId)); })
      .catch(() => { if (!cancel) setTodos([]); });
    return () => { cancel = true; };
  }, [iso]);

  const total = breakdown.reduce((a, b) => a + b.min, 0);
  const max = Math.max(1, ...breakdown.map((b) => b.min));
  const label = dayLabel(iso);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="day-popup" onClick={(e) => e.stopPropagation()}>
        <div className="day-popup-head">
          <span className="day-popup-title">{label}</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        {/* Süre kırılımı */}
        <div className="day-popup-sec">
          <span className="day-popup-label muted small">
            Toplam {formatMinutes(total)}
          </span>
          {breakdown.length === 0 ? (
            <p className="muted small">Bu gün kayıtlı süre yok.</p>
          ) : (
            <ul className="day-popup-bars">
              {breakdown.map((b, i) => (
                <li className="day-popup-bar-row" key={b.name}>
                  <span className="day-popup-bar-name">{b.name}</span>
                  <div className="day-popup-bar-track">
                    <div
                      className="day-popup-bar-fill"
                      style={{
                        width: `${(b.min / max) * 100}%`,
                        background: b.color || PALETTE[i % PALETTE.length],
                      }}
                    />
                  </div>
                  <span className="day-popup-bar-val">{formatMinutes(b.min)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* To-do */}
        {todos && todos.length > 0 ? (
          <div className="day-popup-sec">
            <span className="day-popup-label muted small">Yapılacaklar</span>
            <ul className="day-popup-list">
              {todos.map((t) => (
                <li className={`day-popup-item${t.done ? " done" : ""}`} key={t.id}>
                  <span className="day-popup-check">{t.done ? "✓" : "○"}</span>
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Hatırlatıcılar */}
        {reminders.length > 0 ? (
          <div className="day-popup-sec">
            <span className="day-popup-label muted small">Hatırlatıcılar</span>
            <ul className="day-popup-list">
              {reminders.map((r) => (
                <li className="day-popup-item" key={r.id}>
                  🔔 {r.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Aksiyonlar */}
        <div className="day-popup-actions">
          <button
            className="ghost-btn"
            onClick={() => { onOpenDayNote(iso, label); onClose(); }}
          >
            📓 Günlük
          </button>
          <button className="primary-btn small" onClick={onGoToWeek}>
            Güne git →
          </button>
        </div>
      </div>
    </div>
  );
}

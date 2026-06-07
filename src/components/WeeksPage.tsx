import { addDays } from "../storage";
import { formatHours, heatLevel } from "../heat";

const MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function rangeLabel(startISO: string): string {
  const a = addDays(startISO, 0);
  const b = addDays(startISO, 6);
  const am = MONTHS[a.getMonth()];
  const bm = MONTHS[b.getMonth()];
  return am === bm
    ? `${a.getDate()}–${b.getDate()} ${am}`
    : `${a.getDate()} ${am} – ${b.getDate()} ${bm}`;
}

const DAY_LABELS = ["P", "S", "Ç", "P", "C", "C", "P"];

export function WeeksPage({
  year,
  weeks,
  totals,
  currentStartISO,
  onOpenWeek,
}: {
  year: number;
  weeks: { weekNumber: number; startISO: string }[];
  totals: Record<number, number[]> | null;
  currentStartISO: string;
  onOpenWeek: (startISO: string) => void;
}) {
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
                  <span className="wk-total">{formatHours(total)}s</span>
                ) : null}
              </div>
              <span className="wk-range muted">{rangeLabel(w.startISO)}</span>

              {/* Mini ısı haritası: 7 gün */}
              <div className="wk-mini-heat" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <div
                    key={d}
                    className={`wk-mini-cell lvl-${heatLevel(days?.[d] ?? 0)}`}
                    title={`${DAY_LABELS[d]}: ${days?.[d] ?? 0}dk`}
                  />
                ))}
              </div>

              {state === "current" ? (
                <span className="wk-tag">bu hafta</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

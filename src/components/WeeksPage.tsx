import { addDays } from "../storage";
import { formatHours } from "../heat";

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

export function WeeksPage({
  year,
  weeks,
  totals,
  currentStartISO,
  onOpenWeek,
}: {
  year: number;
  weeks: { weekNumber: number; startISO: string }[];
  totals: Record<number, number> | null;
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
          const total = totals?.[w.weekNumber] ?? 0;
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
              <span className="wk-no">{w.weekNumber}</span>
              <span className="wk-range muted">{rangeLabel(w.startISO)}</span>
              <span className="wk-total">
                {total > 0 ? `${formatHours(total)} sa` : "—"}
              </span>
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

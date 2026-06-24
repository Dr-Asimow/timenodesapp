import type { ActiveTimer, WeekData } from "../types";
import { IconWarning } from "./Icons";

export function MultiTaskModal({
  runningTimers,
  week,
  onPauseOthers,
  onKeepBoth,
  onCancel,
}: {
  runningTimers: ActiveTimer[];
  week: WeekData;
  onPauseOthers: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}) {
  const names = runningTimers
    .map((t) => week.habits.find((h) => h.id === t.habitId)?.name ?? "—")
    .filter(Boolean);
  const label =
    names.length === 1 ? `"${names[0]}" sayacını` : "çalışan sayaçları";

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon"><IconWarning size={28} /></div>
        <h2 className="modal-title">Multi-task yapmaya çalışıyorsun</h2>
        <p className="modal-body muted">
          Şu an{" "}
          <strong className="modal-strong">{names.join(", ")}</strong>{" "}
          {names.length === 1 ? "sayacı çalışıyor" : "sayaçları çalışıyor"}.
          Yeni bir sayaç başlatmak üzeresin.
        </p>
        <div className="modal-actions">
          <button className="primary-btn" onClick={onPauseOthers}>
            {label} durdur ve devam et
          </button>
          <button className="ghost-btn" onClick={onKeepBoth}>
            İki sayaçla devam et
          </button>
        </div>
        <button className="modal-close muted" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}

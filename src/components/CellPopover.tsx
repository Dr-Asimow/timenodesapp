import { useState } from "react";
import type { ActiveTimer, TimerConfig } from "../types";
import type { DayType } from "./WeekGrid";
import { LiveTimer, TimerSetup, DeltaPicker, type PopTimerActions } from "./TimerWidget";

export type { PopTimerActions };

export function CellPopover({
  dayType,
  dayLabel,
  habitName,
  workMin,
  note,
  timerState,
  timer,
  timerActions,
  onStartTimer,
  onAddWork,
  onSetNote,
  onClose,
}: {
  dayType: DayType;
  dayLabel: string;
  habitName: string;
  workMin: number;
  note: string | null;
  timerState: "" | "running" | "pausedt";
  timer: ActiveTimer | null;
  timerActions: PopTimerActions | null;
  onStartTimer: (config: TimerConfig) => void;
  onAddWork: (deltaMin: number) => void;
  onSetNote: (note: string) => void;
  onClose: () => void;
}) {
  const isFuture = dayType === "future";
  const hasTimer = !!(timer && timerActions);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cell-modal" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">
            {habitName} · {dayLabel}
          </span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {isFuture && !hasTimer ? (
          <p className="future-note muted small">
            İleri tarih — burada zaman takibi yok, ama plan/aktivite notu
            bırakabilirsin.
          </p>
        ) : (
          <>
            {hasTimer ? (
              <>
                <LiveTimer timer={timer!} actions={timerActions!} />
                <div className="popover-divider" />
              </>
            ) : dayType === "today" ? (
              <>
                <TimerSetup
                  timerState={timerState}
                  onStartTimer={onStartTimer}
                />
                <div className="popover-divider" />
              </>
            ) : null}
            <div className="stat-edit-row">
              <BigStat workMin={workMin} />
              <DeltaPicker current={workMin} onApply={onAddWork} />
            </div>
            <div className="popover-divider" />
          </>
        )}

        <NoteField note={note} onSetNote={onSetNote} />
      </div>
    </div>
  );
}

function NoteField({
  note,
  onSetNote,
}: {
  note: string | null;
  onSetNote: (note: string) => void;
}) {
  const [val, setVal] = useState(note ?? "");
  return (
    <div className="notefield">
      <span className="popover-label">Aktivite notu</span>
      <textarea
        className="note-area"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if ((val ?? "") !== (note ?? "")) onSetNote(val);
        }}
        placeholder="Bugün ne yaptın / ne yapacaksın?"
        rows={3}
      />
    </div>
  );
}

function BigStat({ workMin }: { workMin: number }) {
  const h = Math.floor(workMin / 60);
  const m = workMin % 60;
  if (h > 0) {
    return (
      <div className="bigstat">
        <span className="bigstat-num">
          {h}
          <span className="bigstat-unit">saat</span>
        </span>
        {m > 0 ? <span className="bigstat-sub">{m} dakika</span> : null}
      </div>
    );
  }
  return (
    <div className="bigstat">
      <span className="bigstat-num">
        {workMin}
        <span className="bigstat-unit">dakika</span>
      </span>
    </div>
  );
}

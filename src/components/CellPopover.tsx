import { useState } from "react";
import type { TimerConfig } from "../types";
import type { DayType } from "./WeekGrid";

const FOCUS_MIN = 5;
const FOCUS_MAX = 120;
const BREAK_MIN = 1;
const BREAK_MAX = 30;

function endsAtLabel(focusMin: number, breakMin: number, cycles: number) {
  const totalMin = cycles * focusMin + Math.max(0, cycles - 1) * breakMin;
  const end = new Date(Date.now() + totalMin * 60000);
  const hh = String(end.getHours()).padStart(2, "0");
  const mm = String(end.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function CellPopover({
  dayType,
  dayLabel,
  habitName,
  workMin,
  breakMin,
  timerState,
  onStartTimer,
  onAddWork,
  onClose,
}: {
  dayType: DayType;
  dayLabel: string;
  habitName: string;
  workMin: number;
  breakMin: number;
  timerState: "" | "running" | "pausedt";
  onStartTimer: (config: TimerConfig) => void;
  onAddWork: (deltaMin: number) => void;
  onClose: () => void;
}) {
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

        {dayType === "today" ? (
          <>
            <TimerSetup timerState={timerState} onStartTimer={onStartTimer} />
            <div className="popover-divider" />
          </>
        ) : null}

        <BigStat workMin={workMin} breakMin={breakMin} />
        <EditRow onAddWork={onAddWork} />
      </div>
    </div>
  );
}

// Büyük çalışma süresi + yanında mola
function BigStat({ workMin, breakMin }: { workMin: number; breakMin: number }) {
  return (
    <div className="bigstat">
      <span className="bigstat-num">
        {workMin}
        <span className="bigstat-unit">dk</span>
      </span>
      <span className="bigstat-break">{breakMin}dk mola</span>
    </div>
  );
}

// Tek satır: − [süre] + (boşken varsayılan 25dk)
function EditRow({ onAddWork }: { onAddWork: (deltaMin: number) => void }) {
  const [amt, setAmt] = useState("");
  const amount = () => {
    const n = parseInt(amt, 10);
    return isNaN(n) || n <= 0 ? 25 : n;
  };
  return (
    <div className="editrow">
      <button className="editrow-minus" onClick={() => onAddWork(-amount())}>
        −
      </button>
      <input
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        placeholder="dk"
        inputMode="numeric"
      />
      <button className="editrow-plus" onClick={() => onAddWork(amount())}>
        +
      </button>
    </div>
  );
}

function TimerSetup({
  timerState,
  onStartTimer,
}: {
  timerState: "" | "running" | "pausedt";
  onStartTimer: (config: TimerConfig) => void;
}) {
  const [mode, setMode] = useState<"pomodoro" | "stopwatch">("pomodoro");
  const [focus, setFocus] = useState(30);
  const [brk, setBrk] = useState(5);
  const [cycles, setCycles] = useState(4);

  if (timerState === "running") {
    return (
      <button className="timer-start-btn" disabled>
        ● Sayaç çalışıyor
      </button>
    );
  }
  if (timerState === "pausedt") {
    return (
      <button
        className="timer-start-btn"
        onClick={() => onStartTimer({ workTargetMs: null, plannedBreakMs: null })}
      >
        ▶ Sayaca devam et
      </button>
    );
  }

  return (
    <div className="setup">
      <div className="mode-toggle">
        <button
          className={mode === "pomodoro" ? "on" : ""}
          onClick={() => setMode("pomodoro")}
        >
          Pomodoro
        </button>
        <button
          className={mode === "stopwatch" ? "on" : ""}
          onClick={() => setMode("stopwatch")}
        >
          Serbest
        </button>
      </div>

      {mode === "pomodoro" ? (
        <div className="setup-body">
          <Slider
            label="Odak"
            value={focus}
            min={FOCUS_MIN}
            max={FOCUS_MAX}
            step={5}
            onChange={setFocus}
          />
          <Slider
            label="Mola"
            value={brk}
            min={BREAK_MIN}
            max={BREAK_MAX}
            step={1}
            onChange={setBrk}
          />
          <div className="cycles-row">
            <span className="setup-label">Döngü</span>
            <div className="cycles-ctrl">
              <button onClick={() => setCycles((c) => Math.max(1, c - 1))}>
                −
              </button>
              <span className="cycles-val">{cycles}</span>
              <button onClick={() => setCycles((c) => Math.min(12, c + 1))}>
                +
              </button>
            </div>
            <span className="ends-at muted small">
              Bitiş ~ {endsAtLabel(focus, brk, cycles)}
            </span>
          </div>
          <button
            className="start-btn"
            onClick={() =>
              onStartTimer({
                workTargetMs: focus * 60000,
                plannedBreakMs: brk * 60000,
              })
            }
          >
            ▶ Başlat
          </button>
        </div>
      ) : (
        <div className="setup-body">
          <p className="stopwatch-desc muted small">
            İstediğin kadar çalış, dilediğinde molaya geç, istediğinde bitir.
          </p>
          <button
            className="start-btn"
            onClick={() =>
              onStartTimer({ workTargetMs: null, plannedBreakMs: null })
            }
          >
            ▶ Başlat
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="setup-label">{label}</span>
        <span className="slider-val">
          {value} <span className="muted">dk</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ActiveTimer, TimerConfig } from "../types";
import type { DayType } from "./WeekGrid";
import {
  isRunning,
  phaseTotalMs,
  phaseProgress,
  phaseTargetMs,
  workTotalMs,
  breakTotalMs,
  alarmRinging,
  workMinutes,
  formatClock,
} from "../timer";

// Popup içindeki canlı sayaca bağlı (seçili timer'a sabitlenmiş) kontroller
export type PopTimerActions = {
  pause: () => void;
  resume: () => void;
  startBreak: (breakTargetMs: number | null) => void;
  resumeWork: () => void;
  ack: () => void;
  finish: () => void;
  cancel: () => void;
};

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
  breakMin: number;
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
            <BigStat workMin={workMin} breakMin={breakMin} />
            <EditRow onAddWork={onAddWork} />
            <div className="popover-divider" />
          </>
        )}

        <NoteField note={note} onSetNote={onSetNote} />
      </div>
    </div>
  );
}

// Popup içinde büyük, canlı tıklayan sayaç + kontroller.
// Alarm bip'i üst çubuktaki TimerCard'da çalar (burada çift çalmaz), bu yüzden
// burada sadece görsel + buton var.
function LiveTimer({
  timer,
  actions,
}: {
  timer: ActiveTimer;
  actions: PopTimerActions;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = isRunning(timer);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const onBreak = timer.phase === "break";
  const total = phaseTotalMs(timer, now);
  const progress = phaseProgress(timer, now);
  const target = phaseTargetMs(timer);
  const ringing = alarmRinging(timer, now);
  const [showBreak, setShowBreak] = useState(false);

  const phaseLabel = onBreak
    ? running
      ? "molada"
      : "mola duraklatıldı"
    : running
    ? "çalışıyor"
    : "duraklatıldı";
  const remain =
    target != null ? formatClock(Math.max(0, target - total)) : null;

  function breakClick() {
    if (timer.plannedBreakMs != null) actions.startBreak(timer.plannedBreakMs);
    else setShowBreak((v) => !v);
  }
  function finish() {
    const mins = workMinutes(timer, now);
    if (
      mins <= 0 &&
      !confirm("Çalışma süresi 1 dakikadan az. Yine de kaydedilsin mi?")
    )
      return;
    actions.finish();
  }
  function cancel() {
    if (confirm("Sayaç iptal edilsin mi? Süre kaydedilmez.")) actions.cancel();
  }

  return (
    <div
      className={`pop-timer ${onBreak ? "brk" : "work"} ${
        ringing ? "ringing" : ""
      }`}
    >
      <div className="pop-timer-clock">{formatClock(total)}</div>
      <div className="pop-timer-sub">
        <span className={`pop-timer-phase ${onBreak ? "brk" : "work"}`}>
          ● {phaseLabel}
        </span>
        {remain ? <span className="muted small"> · kalan {remain}</span> : null}
      </div>
      {progress != null ? (
        <div className="pop-timer-track">
          <div
            className={`pop-timer-fill ${onBreak ? "brk" : "work"}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
      <div className="pop-timer-stats muted small">
        Tamamlanan {Math.round(workTotalMs(timer, now) / 60000)}dk · Ara{" "}
        {Math.round(breakTotalMs(timer, now) / 60000)}dk
      </div>

      {ringing ? (
        <div className="pop-timer-actions">
          <button className="primary-btn small" onClick={actions.ack}>
            Alarmı durdur & devam
          </button>
          {onBreak ? (
            <button className="ghost-btn accent" onClick={actions.resumeWork}>
              ▶ Çalışmaya dön
            </button>
          ) : (
            <button
              className="ghost-btn"
              onClick={() => actions.startBreak(timer.plannedBreakMs)}
            >
              ☕ Ara ver
            </button>
          )}
        </div>
      ) : (
        <div className="pop-timer-actions">
          {onBreak ? (
            <button className="ghost-btn accent" onClick={actions.resumeWork}>
              ▶ Çalışmaya dön
            </button>
          ) : running ? (
            <>
              <button className="ghost-btn" onClick={actions.pause}>
                ❚❚ Duraklat
              </button>
              <div className="break-wrap">
                <button className="ghost-btn" onClick={breakClick}>
                  ☕ Ara ver
                </button>
                {showBreak ? (
                  <div
                    className="break-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[5, 10, 15].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setShowBreak(false);
                          actions.startBreak(m * 60000);
                        }}
                      >
                        {m}dk
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowBreak(false);
                        actions.startBreak(null);
                      }}
                    >
                      ∞ Sınırsız
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <button className="ghost-btn accent" onClick={actions.resume}>
              ▶ Devam
            </button>
          )}
          <button className="primary-btn small" onClick={finish}>
            Bitir & kaydet
          </button>
          <button className="ghost-btn danger" onClick={cancel}>
            İptal
          </button>
        </div>
      )}
    </div>
  );
}

// Aktivite notu (blur'da kaydeder)
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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ActiveTimer, TimerConfig } from "../types";
import {
  isRunning,
  phaseTotalMs,
  phaseProgress,
  phaseTargetMs,
  breakTotalMs,
  alarmRinging,
  workMinutes,
  workTotalMs,
  formatClock,
} from "../timer";

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

export function endsAtLabel(focusMin: number, breakMin: number, cycles: number) {
  const totalMin = cycles * focusMin + Math.max(0, cycles - 1) * breakMin;
  const end = new Date(Date.now() + totalMin * 60000);
  const hh = String(end.getHours()).padStart(2, "0");
  const mm = String(end.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Çalışıyor / duraklatıldı canlı sayaç görünümü
export function LiveTimer({
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

// Sayaç başlangıç formu (Pomodoro / Serbest mod)
export function TimerSetup({
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
        onClick={() =>
          onStartTimer({ workTargetMs: null, plannedBreakMs: null, cycles: 1, topicId: null })
        }
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
          <TimerSlider
            label="Odak"
            value={focus}
            min={FOCUS_MIN}
            max={FOCUS_MAX}
            step={5}
            onChange={setFocus}
          />
          <TimerSlider
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
                cycles,
                topicId: null,
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
              onStartTimer({ workTargetMs: null, plannedBreakMs: null, cycles: 1, topicId: null })
            }
          >
            ▶ Başlat
          </button>
        </div>
      )}
    </div>
  );
}

export function TimerSlider({
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
  const pct = ((value - min) / (max - min)) * 100;
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
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-2) ${pct}%, var(--panel-2) 100%)`,
        }}
      />
    </div>
  );
}

// --- Dakika ekle/çıkar: dikey scroll slider --------------------------------
const STEP_MIN = 5;
const MAX_MIN = 240;
const ITEM_H = 34;
const VISIBLE = 5;

const DELTA_STEPS: number[] = [];
for (let v = MAX_MIN; v >= -MAX_MIN; v -= STEP_MIN) DELTA_STEPS.push(v);
const ZERO_INDEX = DELTA_STEPS.indexOf(0);

function fmtDelta(min: number): string {
  if (min === 0) return "0";
  const sign = min > 0 ? "+" : "−";
  const a = Math.abs(min);
  if (a < 60) return `${sign}${a}dk`;
  const h = Math.round((a / 60) * 10) / 10;
  return `${sign}${String(h).replace(".", ",")} saat`;
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0 dk";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}sa ${m}dk`;
  if (h > 0) return `${h} saat`;
  return `${m} dk`;
}

export function DeltaPicker({
  current,
  onApply,
}: {
  current: number;
  onApply: (deltaMin: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);
  const [idx, setIdx] = useState(ZERO_INDEX);
  const [dragging, setDragging] = useState(false);
  const delta = DELTA_STEPS[idx];
  const newTotal = Math.max(0, current + delta);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = ZERO_INDEX * ITEM_H;
  }, []);

  function indexFromScroll(scrollTop: number) {
    return Math.max(
      0,
      Math.min(DELTA_STEPS.length - 1, Math.round(scrollTop / ITEM_H))
    );
  }

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = indexFromScroll(el.scrollTop);
    if (i !== idx) setIdx(i);
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    drag.current = { startY: e.clientY, startScroll: el.scrollTop };
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !drag.current) return;
    el.scrollTop = drag.current.startScroll - (e.clientY - drag.current.startY);
  }
  function endDrag(e: React.PointerEvent) {
    const el = ref.current;
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch { /* yoksay */ }
      el.scrollTo({ top: indexFromScroll(el.scrollTop) * ITEM_H, behavior: "smooth" });
    }
  }

  function apply() {
    if (delta === 0) return;
    onApply(delta);
    setIdx(ZERO_INDEX);
    if (ref.current) ref.current.scrollTop = ZERO_INDEX * ITEM_H;
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;

  return (
    <div className="delta-row">
      <div className="delta-picker-wrap" style={{ height: VISIBLE * ITEM_H }}>
        <div
          className={`delta-picker ${dragging ? "dragging" : ""}`}
          ref={ref}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ height: VISIBLE * ITEM_H }}
        >
          <div style={{ height: pad, flex: "none" }} />
          {DELTA_STEPS.map((v, i) => {
            const dist = Math.abs(i - idx);
            return (
              <div
                key={v}
                className={`delta-item ${i === idx ? "sel" : ""} ${
                  dist === 1 ? "near" : ""
                } ${v > 0 ? "pos" : v < 0 ? "neg" : ""}`}
                style={{ height: ITEM_H }}
              >
                {fmtDelta(v)}
              </div>
            );
          })}
          <div style={{ height: pad, flex: "none" }} />
        </div>
        <div className="delta-center-band" />
      </div>

      <div className="delta-apply">
        <button
          className={`delta-btn ${delta < 0 ? "minus" : "plus"}`}
          disabled={delta === 0}
          onClick={apply}
        >
          {delta === 0 ? "Kaydır" : delta > 0 ? `+ Ekle` : `− Çıkar`}
        </button>
        <span className="delta-preview muted small">
          {delta === 0 ? formatMinutes(current) : `→ ${formatMinutes(newTotal)}`}
        </span>
      </div>
    </div>
  );
}

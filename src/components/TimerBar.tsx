import { useEffect, useState } from "react";
import type { ActiveTimer, WeekData } from "../types";
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
import { playAlarm } from "../alarm";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const BREAK_OPTIONS = [5, 10, 15]; // dakika

function timerKey(t: ActiveTimer) {
  return `${t.habitId}:${t.day}`;
}

function fmtMin(ms: number) {
  return `${Math.round(ms / 60000)}dk`;
}

export function TimersStack({
  timers,
  week,
  onPause,
  onResume,
  onStartBreak,
  onResumeWork,
  onAck,
  onUpdate,
  onFinish,
  onCancel,
}: {
  timers: ActiveTimer[];
  week: WeekData;
  onPause: (t: ActiveTimer) => void;
  onResume: (t: ActiveTimer) => void;
  onStartBreak: (t: ActiveTimer, breakTargetMs: number | null) => void;
  onResumeWork: (t: ActiveTimer) => void;
  onAck: (t: ActiveTimer) => void;
  onUpdate: (t: ActiveTimer) => void;
  onFinish: (t: ActiveTimer) => void;
  onCancel: (t: ActiveTimer) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = timers.some(isRunning);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [anyRunning]);

  if (timers.length === 0) return null;

  return (
    <div className="timers-stack">
      {timers.map((t) => (
        <TimerCard
          key={timerKey(t)}
          timer={t}
          now={now}
          week={week}
          onPause={() => onPause(t)}
          onResume={() => onResume(t)}
          onStartBreak={(target) => onStartBreak(t, target)}
          onResumeWork={() => onResumeWork(t)}
          onAck={() => onAck(t)}
          onFinish={() => onFinish(t)}
          onCancel={() => onCancel(t)}
        />
      ))}
    </div>
  );
}

function ProgressRing({
  progress,
  phase,
  label,
}: {
  progress: number;
  phase: "work" | "break";
  label: string;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg width="54" height="54" viewBox="0 0 54 54" className="ring">
        <circle className="ring-bg" cx="27" cy="27" r={r} />
        <circle
          className={`ring-fg ${phase}`}
          cx="27"
          cy="27"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform="rotate(-90 27 27)"
        />
      </svg>
      <span className="ring-label">{label}</span>
    </div>
  );
}

function TimerCard({
  timer,
  now,
  week,
  onPause,
  onResume,
  onStartBreak,
  onResumeWork,
  onAck,
  onFinish,
  onCancel,
}: {
  timer: ActiveTimer;
  now: number;
  week: WeekData;
  onPause: () => void;
  onResume: () => void;
  onStartBreak: (breakTargetMs: number | null) => void;
  onResumeWork: () => void;
  onAck: () => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const habit = week.habits.find((h) => h.id === timer.habitId);
  const running = isRunning(timer);
  const onBreak = timer.phase === "break";
  const total = phaseTotalMs(timer, now);
  const progress = phaseProgress(timer, now);
  const target = phaseTargetMs(timer);
  const ringing = alarmRinging(timer, now);
  const [showBreak, setShowBreak] = useState(false);

  // Alarm çalarken susturulana (ack) kadar her ~2.5sn'de bip çal
  useEffect(() => {
    if (!ringing) return;
    playAlarm();
    const id = setInterval(playAlarm, 2500);
    return () => clearInterval(id);
  }, [ringing]);

  function finish() {
    const mins = workMinutes(timer, now);
    if (mins <= 0) {
      if (!confirm("Çalışma süresi 1 dakikadan az. Yine de kapatılsın mı?"))
        return;
    }
    onFinish();
  }
  function cancel() {
    if (confirm(`"${habit?.name}" sayacı iptal edilsin mi? Süre kaydedilmez.`))
      onCancel();
  }
  // "Ara ver": pomodoro mola süresi varsa direkt başlat, yoksa menü göster
  function breakClick() {
    if (timer.plannedBreakMs != null) {
      onStartBreak(timer.plannedBreakMs);
    } else {
      setShowBreak((v) => !v);
    }
  }

  const phaseLabel = onBreak
    ? running
      ? "molada"
      : "mola duraklatıldı"
    : running
    ? "çalışıyor"
    : "duraklatıldı";

  const ringLabel =
    target != null ? formatClock(Math.max(0, target - total)) : "";

  return (
    <div
      className={`timer-bar ${running ? "running" : "paused"} ${
        onBreak ? "break" : "work"
      } ${ringing ? "ringing" : ""}`}
      data-timer={`${timer.habitId}:${timer.day}`}
    >
      <span className={`pulse ${running ? "on" : ""} ${onBreak ? "brk" : ""}`} />
      <div className="timer-meta">
        <span className="timer-habit">{habit?.name ?? "—"}</span>
        <span className="timer-day muted small">
          {DAY_LABELS[timer.day]} · {phaseLabel}
        </span>
        <span className="timer-stats muted small">
          Tamamlanan {fmtMin(workTotalMs(timer, now))} · Ara{" "}
          {fmtMin(breakTotalMs(timer, now))}
        </span>
      </div>

      <div className="timer-clock">{formatClock(total)}</div>

      {progress != null ? (
        <ProgressRing
          progress={progress}
          phase={timer.phase}
          label={ringLabel}
        />
      ) : null}

      {ringing ? (
        <div className="alarm-area">
          <span className="alarm-text">
            🔔 {onBreak ? "Mola süresi doldu!" : "Hedef süre doldu!"}
          </span>
          <button className="alarm-btn" onClick={onAck}>
            Alarmı durdur ve devam et
          </button>
          {onBreak ? (
            <button className="ghost-btn accent" onClick={onResumeWork}>
              ▶ Çalışmaya dön
            </button>
          ) : (
            <button className="ghost-btn" onClick={() => onStartBreak(timer.plannedBreakMs)}>
              ☕ Ara ver
            </button>
          )}
        </div>
      ) : (
        <div className="timer-actions">
          {onBreak ? (
            <button className="ghost-btn accent" onClick={onResumeWork}>
              ▶ Çalışmaya dön
            </button>
          ) : running ? (
            <>
              <button className="ghost-btn" onClick={onPause}>
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
                    {BREAK_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setShowBreak(false);
                          onStartBreak(m * 60000);
                        }}
                      >
                        {m}dk
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowBreak(false);
                        onStartBreak(null);
                      }}
                    >
                      ∞ Sınırsız
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <button className="ghost-btn accent" onClick={onResume}>
              ▶ Devam
            </button>
          )}
          <button className="primary-btn small" onClick={finish}>
            Bitir &amp; kaydet
          </button>
          <button className="ghost-btn danger" onClick={cancel}>
            İptal
          </button>
        </div>
      )}
    </div>
  );
}

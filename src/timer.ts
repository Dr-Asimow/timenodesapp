import type { ActiveTimer } from "./types";

export function isRunning(t: ActiveTimer): boolean {
  return t.startedAt != null;
}

// Geçerli evrede, son devam'dan beri geçen canlı segment
function liveSegment(t: ActiveTimer, now: number): number {
  return t.startedAt != null ? Math.max(0, now - t.startedAt) : 0;
}

export function workTotalMs(t: ActiveTimer, now: number = Date.now()): number {
  return t.workMs + (t.phase === "work" ? liveSegment(t, now) : 0);
}

export function breakTotalMs(t: ActiveTimer, now: number = Date.now()): number {
  return t.breakMs + (t.phase === "break" ? liveSegment(t, now) : 0);
}

// İçinde bulunulan evrenin toplam süresi (ekrandaki ana sayaç)
export function phaseTotalMs(t: ActiveTimer, now: number = Date.now()): number {
  return t.phase === "work" ? workTotalMs(t, now) : breakTotalMs(t, now);
}

export function phaseTargetMs(t: ActiveTimer): number | null {
  return t.phase === "work" ? t.workTargetMs : t.breakTargetMs;
}

// Hedefli evrede ilerleme oranı 0..1; sınırsızsa null
export function phaseProgress(
  t: ActiveTimer,
  now: number = Date.now()
): number | null {
  const target = phaseTargetMs(t);
  if (target == null || target <= 0) return null;
  return Math.min(1, phaseTotalMs(t, now) / target);
}

// Geçerli evrede hedefe ulaşıldı mı?
export function targetReached(t: ActiveTimer, now: number = Date.now()): boolean {
  const target = phaseTargetMs(t);
  return target != null && phaseTotalMs(t, now) >= target;
}

// Geçerli evrenin alarmı kullanıcı tarafından onaylandı mı (susturuldu mu)?
export function phaseAcked(t: ActiveTimer): boolean {
  return t.phase === "work" ? t.workAlarmAck : t.breakAlarmAck;
}

// Alarm şu an çalıyor mu? (hedef doldu, sayaç çalışıyor, henüz onaylanmadı)
export function alarmRinging(t: ActiveTimer, now: number = Date.now()): boolean {
  return isRunning(t) && targetReached(t, now) && !phaseAcked(t);
}

// Hücreye kaydedilecek çalışma dakikası (en yakın tam dakikaya yuvarlanır)
export function workMinutes(t: ActiveTimer, now: number = Date.now()): number {
  return Math.round(workTotalMs(t, now) / 60000);
}

// Canlı segmenti ait olduğu kovaya katlayıp startedAt'i sıfırlar (duraklat / evre değişimi)
export function settle(t: ActiveTimer, now: number = Date.now()): ActiveTimer {
  if (t.startedAt == null) return t;
  const seg = liveSegment(t, now);
  return {
    ...t,
    startedAt: null,
    workMs: t.workMs + (t.phase === "work" ? seg : 0),
    breakMs: t.breakMs + (t.phase === "break" ? seg : 0),
  };
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Web Audio ile basit alarm bipi (harici dosya gerektirmez)
let ctx: AudioContext | null = null;

// Paylaşılan AudioContext'i hazırla (desteklenmiyorsa hata fırlatır)
function audio(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  ctx = ctx ?? new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Tarayıcı, sayfa yenilendikten sonra kullanıcı etkileşimi olmadan sesi açmaz;
// (yenilemeden sonra da süren sayaç sessiz kalmasın diye) her tıklama/tuşta
// ses bağlamını hazırla/uyandır
function unlock() {
  try {
    audio();
  } catch {
    // ses desteklenmiyorsa sessizce geç
  }
}
for (const ev of ["pointerdown", "pointerup", "keydown"]) {
  window.addEventListener(ev, unlock, { capture: true, passive: true });
}

// t0 anında tek bir sinüs tonu çal
function tone(c: AudioContext, freq: number, t0: number, dur: number, vol: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur - 0.02);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function playAlarm(): void {
  try {
    const c = audio();
    // Üç kısa bip
    [0, 0.32, 0.64].forEach((offset) => tone(c, 880, c.currentTime + offset, 0.28, 0.35));
  } catch {
    // sesi destekanmıyorsa sessizce geç
  }
}

// Yumuşak, kısa "ding-dong" — sayacın hâlâ çalıştığını hatırlatmak için
export function playChime(): void {
  try {
    const c = audio();
    tone(c, 660, c.currentTime, 0.45, 0.15);
    tone(c, 990, c.currentTime + 0.18, 0.6, 0.12);
  } catch {
    // sesi destekanmıyorsa sessizce geç
  }
}

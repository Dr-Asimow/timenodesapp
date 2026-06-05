// Web Audio ile basit alarm bipi (harici dosya gerektirmez)
let ctx: AudioContext | null = null;

export function playAlarm(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") ctx.resume();
    const start = ctx.currentTime;
    // Üç kısa bip
    [0, 0.32, 0.64].forEach((offset) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const t0 = start + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + 0.28);
    });
  } catch {
    // sesi destekanmıyorsa sessizce geç
  }
}

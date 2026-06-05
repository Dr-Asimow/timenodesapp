// Dakikayı ısı-haritası seviyesine (0..5) çevirir.
// Katı pomodoro yok; ton arttıkça daha fazla zaman demek (glow değil, sadece ton).
export function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes <= 25) return 1;
  if (minutes <= 50) return 2;
  if (minutes <= 100) return 3;
  if (minutes <= 150) return 4;
  return 5;
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  // 2.5 saat gibi, gereksiz sıfır olmadan
  return (Math.round(hours * 10) / 10).toString().replace(".", ",");
}

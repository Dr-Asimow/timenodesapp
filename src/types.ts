export type Habit = {
  id: string;
  name: string;
};

// minutes[habitId][dayIndex 0..6] = dakika
export type Minutes = Record<string, number[]>;

export type WeekData = {
  weekNumber: number;
  year: number;
  // Haftanın Pazartesi gününün ISO tarihi (YYYY-MM-DD)
  startDate: string;
  habits: Habit[];
  // minutes = çalışma dakikaları, breaks = mola dakikaları (hücre bazında)
  minutes: Minutes;
  breaks: Minutes;
  // notes = aktivite notları (habit+gün); dayNotes = gün notları (7 gün)
  notes: Record<string, (string | null)[]>;
  dayNotes: (string | null)[];
};

export type TimerPhase = "work" | "break";

export type ActiveTimer = {
  habitId: string;
  day: number; // 0..6
  // İçinde bulunulan evre: çalışma mı, mola mı
  phase: TimerPhase;
  // Geçerli evrenin son devam ettiği an (epoch ms); duraklatınca null
  startedAt: number | null;
  // Settle edilmiş (canlı segment hariç) toplam çalışma süresi (ms)
  workMs: number;
  // Settle edilmiş toplam mola süresi (ms)
  breakMs: number;
  // Çalışma hedefi (ms). null = sınırsız (serbest mod)
  workTargetMs: number | null;
  // Geçerli mola evresinin hedefi (ms). null = sınırsız mola
  breakTargetMs: number | null;
  // Pomodoro yapılandırmasından gelen varsayılan mola süresi ("Ara ver" kısayolu)
  plannedBreakMs: number | null;
  // Hedef dolunca alarm çalar; kullanıcı onaylayınca (ack) susar. Evre başına.
  workAlarmAck: boolean;
  breakAlarmAck: boolean;
};

// Sayaç başlatma yapılandırması (config popup'tan gelir)
export type TimerConfig = {
  workTargetMs: number | null; // null = serbest (stopwatch)
  plannedBreakMs: number | null; // pomodoro mola süresi; serbestte null
};

export type AppState = {
  username: string;
  week: WeekData;
  // Aynı anda birden çok sayaç olabilir (çalışan + duraklatılmış).
  // Her hücre (habitId+day) için en fazla bir sayaç.
  timers?: ActiveTimer[];
};

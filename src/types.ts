export type Habit = {
  id: string;
  name: string;
  // Etkinlik rengi (hex). null/boş ise varsayılan accent rengi kullanılır.
  color: string | null;
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

// Günlük gündem öğesi: haftalık tablodan seçilen alışkanlık (habitId dolu)
// ya da serbest yazılan yapılacak (todo). done sadece todo'larda kullanılır.
export type TodoDifficulty = "kolay" | "orta" | "zor";

export type TodoItem = {
  id: string;
  day: string; // ISO tarih (YYYY-MM-DD)
  habitId: string | null;
  title: string;
  done: boolean;
  position: number;
  // Serbest to-do'lar için ek alanlar (alışkanlık bağlılarında kullanılmaz)
  description: string | null;
  difficulty: TodoDifficulty | null;
  deadline: string | null; // ISO tarih-saat (deadline)
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
  // Pomodoro döngü sayısı (kaç odak fazı). Serbest/tek sayaçta 1.
  cyclesTotal: number;
  // Tamamlanan odak fazı sayısı (0..cyclesTotal)
  cyclesDone: number;
  // Çalışılan konu (kalıcı, etkinliğe bağlı). null = konusuz.
  topicId: string | null;
  // Konu adı (gösterim için; topicId'den ayrı sorgu gerekmesin diye saklanır)
  topicName: string | null;
};

// Sayaç başlatma yapılandırması (config popup'tan gelir)
export type TimerConfig = {
  workTargetMs: number | null; // null = serbest (stopwatch)
  plannedBreakMs: number | null; // pomodoro mola süresi; serbestte null
  cycles: number; // pomodoro döngü sayısı; serbestte 1
  topicId: string | null; // çalışılan konu; null = konusuz
  topicName: string | null; // konu adı (gösterim için)
};

// Etkinliğe bağlı kalıcı konu (topics tablosu)
export type Topic = {
  id: string;
  habitId: string;
  name: string;
};

// Bir hücrenin konu bazında süre kırılımı (topic_minutes'ten)
export type TopicMinute = {
  topicId: string;
  name: string;
  min: number;
};

export type AppState = {
  username: string;
  week: WeekData;
  // Aynı anda birden çok sayaç olabilir (çalışan + duraklatılmış).
  // Her hücre (habitId+day) için en fazla bir sayaç.
  timers?: ActiveTimer[];
};

// Günlük hedef (goals tablosu)
export type Goal = {
  id: string;
  day: string; // ISO tarih (YYYY-MM-DD)
  text: string;
};

// Hatırlatıcı (reminders tablosu)
export type Reminder = {
  id: string;
  title: string;
  description: string | null;
  target_at: string; // ISO timestamp
};

// Favori müzik (music_favorites tablosu — tek YouTube videosu)
export type MusicFavorite = {
  id: string;
  videoId: string;
  title: string;
};

// Cihaz-yerel sayaç tercihleri (localStorage)
export type TimerSettings = {
  alarmEnabled: boolean;
  autoBreak: boolean; // true = mola otomatik başlar
};

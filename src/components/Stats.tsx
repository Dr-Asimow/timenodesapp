import { formatHours, formatMinutes } from "../heat";
import type { YearStats } from "../db";

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

export function Stats({
  year,
  weekTotalMin,
  currentWeek,
  stats,
}: {
  year: number;
  weekTotalMin: number;
  currentWeek: number;
  stats: YearStats | null;
}) {
  if (!stats) {
    return (
      <div className="stats-page">
        <h2 className="stats-head">İstatistikler · {year}</h2>
        <p className="muted small">Yükleniyor…</p>
      </div>
    );
  }

  const breakRatio =
    stats.totalWork + stats.totalBreak > 0
      ? Math.round(
          (stats.totalBreak / (stats.totalWork + stats.totalBreak)) * 100
        )
      : 0;
  const maxHabit = stats.perHabit[0]?.min ?? 0;
  const weeks = Array.from({ length: 53 }, (_, i) => i + 1);
  const maxWeek = Math.max(1, ...weeks.map((w) => stats.perWeek[w] ?? 0));

  return (
    <div className="stats-page">
      <h2 className="stats-head">İstatistikler · {year}</h2>

      <div className="stats-cards">
        <BigCard
          label={`${year} toplam`}
          value={`${formatHours(stats.totalWork)} sa`}
        />
        <BigCard label="Bu hafta" value={`${formatHours(weekTotalMin)} sa`} />
        <BigCard label="Aktif gün" value={`${stats.activeDays}`} />
        <BigCard
          label="En verimli gün"
          value={
            stats.bestDay ? `${formatHours(stats.bestDay.min)} sa` : "—"
          }
          sub={stats.bestDay ? dayLabel(stats.bestDay.day) : undefined}
        />
        <BigCard label="Mola oranı" value={`%${breakRatio}`} />
      </div>

      <section className="stats-section">
        <h3 className="stats-title">Etkinlik dağılımı</h3>
        {stats.perHabit.length === 0 ? (
          <p className="muted small">Bu yıl henüz kayıt yok.</p>
        ) : (
          <div className="habit-bars">
            {stats.perHabit.map((h) => (
              <div className="habit-bar-row" key={h.name}>
                <span className="habit-bar-name">{h.name}</span>
                <div className="habit-bar-track">
                  <div
                    className="habit-bar-fill"
                    style={{
                      width: `${maxHabit > 0 ? (h.min / maxHabit) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="habit-bar-val">{formatMinutes(h.min)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stats-section">
        <h3 className="stats-title">Haftalık çalışma</h3>
        <div className="week-chart">
          {weeks.map((w) => {
            const min = stats.perWeek[w] ?? 0;
            const h = maxWeek > 0 ? (min / maxWeek) * 100 : 0;
            return (
              <div
                key={w}
                className={`week-bar-wrap ${w === currentWeek ? "current" : ""}`}
                title={`${w}. hafta · ${formatHours(min)} sa`}
              >
                <div
                  className="week-bar"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="week-chart-axis muted small">
          <span>1. hafta</span>
          <span>{currentWeek}. hafta (şimdi)</span>
          <span>53</span>
        </div>
      </section>
    </div>
  );
}

function BigCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label muted small">{label}</div>
      {sub ? <div className="stat-sub muted small">{sub}</div> : null}
    </div>
  );
}

import { useState } from "react";
import { formatHours, formatMinutes } from "../heat";
import { mondayOf, addDays, toISODate } from "../storage";
import type { HabitSeries, YearStats } from "../db";

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// Etkinlik rengi yoksa kullanılacak yedek palet
const PALETTE = [
  "#5b8def", "#e5894d", "#3fb950", "#a371f7",
  "#f778ba", "#e3b341", "#56d4dd", "#db61a2",
];

function colorOf(h: { color: string | null }, idx: number): string {
  return h.color || PALETTE[idx % PALETTE.length];
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

type DistRange = "all" | "year" | "month" | "week";
type TrendMode = "weekly" | "monthly";

export function Stats({
  year,
  weekTotalMin,
  stats,
}: {
  year: number;
  weekTotalMin: number;
  currentWeek: number;
  stats: YearStats | null;
}) {
  const [mode, setMode] = useState<TrendMode>("weekly");
  const [offset, setOffset] = useState(0); // 0 = bu hafta/ay, negatif = geçmiş
  const [range, setRange] = useState<DistRange>("year");

  if (!stats) {
    return (
      <div className="stats-page">
        <h2 className="stats-head">İstatistikler · {year}</h2>
        <p className="muted small">Yükleniyor…</p>
      </div>
    );
  }

  // Bu hafta / bu ay gün listeleri (dağılım için, offset'siz)
  const thisWeekISOs = weekDays(0);
  const thisMonthISOs = monthDays(0);

  function sumDays(h: HabitSeries, isos: string[]): number {
    return isos.reduce((acc, iso) => acc + (h.daily[iso] ?? 0), 0);
  }

  const distribution =
    range === "all"
      ? stats.allTimePerHabit
      : range === "year"
      ? stats.perHabit
      : stats.habitSeries
          .map((h) => ({
            name: h.name,
            color: h.color,
            min: sumDays(h, range === "month" ? thisMonthISOs : thisWeekISOs),
          }))
          .filter((x) => x.min > 0)
          .sort((a, b) => b.min - a.min);
  const maxHabit = distribution[0]?.min ?? 0;

  const RANGES: [DistRange, string][] = [
    ["all", "Tüm zamanlar"],
    ["year", "Yıllık"],
    ["month", "Aylık"],
    ["week", "Haftalık"],
  ];

  return (
    <div className="stats-page">
      <h2 className="stats-head">İstatistikler · {year}</h2>

      <div className="stats-cards">
        <BigCard label={`${year} toplam`} value={`${formatHours(stats.totalWork)} sa`} />
        <BigCard label="Bu hafta" value={`${formatHours(weekTotalMin)} sa`} />
        <BigCard label="Aktif gün" value={`${stats.activeDays}`} />
        <BigCard
          label="En verimli gün"
          value={stats.bestDay ? `${formatHours(stats.bestDay.min)} sa` : "—"}
          sub={stats.bestDay ? dayLabel(stats.bestDay.day) : undefined}
        />
      </div>

      <section className="stats-section">
        <div className="stats-title-row">
          <h3 className="stats-title">Etkinlik dağılımı</h3>
          <div className="range-tags">
            {RANGES.map(([r, label]) => (
              <button
                key={r}
                className={`range-tag${range === r ? " on" : ""}`}
                onClick={() => setRange(r)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {distribution.length === 0 ? (
          <p className="muted small">Bu aralıkta kayıt yok.</p>
        ) : (
          <div className="habit-bars">
            {distribution.map((h, i) => (
              <div className="habit-bar-row" key={h.name}>
                <span className="habit-bar-name">
                  <span className="habit-dot" style={{ background: colorOf(h, i) }} />
                  <span className="habit-bar-name-text">{h.name}</span>
                </span>
                <div className="habit-bar-track">
                  <div
                    className="habit-bar-fill"
                    style={{ width: `${maxHabit > 0 ? (h.min / maxHabit) * 100 : 0}%` }}
                  />
                </div>
                <span className="habit-bar-val">{formatMinutes(h.min)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stats-section">
        <div className="stats-title-row">
          <h3 className="stats-title">Etkinlik trendi</h3>
          <div className="mode-toggle stats-mode">
            <button
              className={mode === "weekly" ? "on" : ""}
              onClick={() => { setMode("weekly"); setOffset(0); }}
            >
              Haftalık
            </button>
            <button
              className={mode === "monthly" ? "on" : ""}
              onClick={() => { setMode("monthly"); setOffset(0); }}
            >
              Aylık
            </button>
          </div>
        </div>

        {stats.habitSeries.length === 0 ? (
          <p className="muted small">Bu yıl henüz kayıt yok.</p>
        ) : (
          <TrendChart
            series={stats.habitSeries}
            mode={mode}
            offset={offset}
            onOffset={setOffset}
          />
        )}
      </section>
    </div>
  );
}

// --- Trend grafiği (günlük kırılım, hafta/ay gezinme, hover ipucu) ---

// offset'e göre haftanın 7 gününün ISO'ları (Pzt..Paz)
function weekDays(offset: number): string[] {
  const monday = mondayOf(new Date());
  const startISO = toISODate(addDays(toISODate(monday), offset * 7));
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(startISO, i)));
}

// offset'e göre ayın tüm günlerinin ISO'ları
function monthDays(offset: number): string[] {
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const yr = d.getFullYear();
  const mo = d.getMonth();
  const n = new Date(yr, mo + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => toISODate(new Date(yr, mo, i + 1)));
}

function TrendChart({
  series,
  mode,
  offset,
  onOffset,
}: {
  series: HabitSeries[];
  mode: TrendMode;
  offset: number;
  onOffset: (o: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const dayISOs = mode === "weekly" ? weekDays(offset) : monthDays(offset);
  const n = dayISOs.length;
  const vals = (h: HabitSeries) => dayISOs.map((iso) => h.daily[iso] ?? 0);
  const maxVal = Math.max(1, ...series.flatMap((h) => vals(h)));

  const W = 720, H = 240, padL = 38, padR = 14, padT = 12, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + (1 - v / maxVal) * plotH;

  const yTicks = [0, 0.5, 1].map((f) => ({ v: maxVal * f, yPos: padT + (1 - f) * plotH }));

  // X etiketleri: haftalık → gün adları; aylık → her ~5. gün
  const xLabels: { i: number; text: string }[] = [];
  if (mode === "weekly") {
    for (let i = 0; i < n; i++) xLabels.push({ i, text: DAYS_TR[i] });
  } else {
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step)
      xLabels.push({ i, text: `${i + 1}` });
  }

  // Gezinme başlığı (seçili aralık)
  let rangeTitle: string;
  if (mode === "weekly") {
    const a = new Date(dayISOs[0] + "T00:00:00");
    const b = new Date(dayISOs[6] + "T00:00:00");
    rangeTitle =
      a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()} ${MONTHS_TR[a.getMonth()]}`
        : `${a.getDate()} ${MONTHS_TR[a.getMonth()]} – ${b.getDate()} ${MONTHS_TR[b.getMonth()]}`;
  } else {
    const d = new Date(dayISOs[0] + "T00:00:00");
    rangeTitle = `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
  }

  const hoverISO = hover != null ? dayISOs[hover] : null;
  const hoverItems =
    hoverISO != null
      ? series
          .map((h, i) => ({ name: h.name, color: colorOf(h, i), min: h.daily[hoverISO] ?? 0 }))
          .filter((x) => x.min > 0)
          .sort((a, b) => b.min - a.min)
      : [];
  const hoverPct = hover != null ? (x(hover) / W) * 100 : 0;
  const hoverLabel =
    hoverISO != null
      ? mode === "weekly"
        ? `${DAYS_TR[hover!]} · ${new Date(hoverISO + "T00:00:00").getDate()} ${MONTHS_TR[new Date(hoverISO + "T00:00:00").getMonth()]}`
        : dayLabel(hoverISO)
      : "";

  return (
    <div className="trend-wrap">
      <div className="trend-nav">
        <button className="trend-arrow" onClick={() => onOffset(offset - 1)} title="Önceki">‹</button>
        <span className="trend-range">{rangeTitle}</span>
        <button
          className="trend-arrow"
          onClick={() => onOffset(Math.min(0, offset + 1))}
          disabled={offset >= 0}
          title="Sonraki"
        >
          ›
        </button>
      </div>

      <div className="trend-chart-wrap">
        <svg
          className="line-chart"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line x1={padL} y1={t.yPos} x2={W - padR} y2={t.yPos} className="lc-grid" />
              <text x={padL - 6} y={t.yPos + 3} className="lc-axis" textAnchor="end">
                {formatHours(t.v)}
              </text>
            </g>
          ))}

          {xLabels.map((l) => (
            <text key={l.i} x={x(l.i)} y={H - 8} className="lc-axis" textAnchor="middle">
              {l.text}
            </text>
          ))}

          {/* Hover dikey göstergesi */}
          {hover != null ? (
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} className="lc-cursor" />
          ) : null}

          {/* Çizgiler */}
          {series.map((h, idx) => {
            const data = vals(h);
            const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <polyline
                key={h.id}
                points={pts}
                fill="none"
                stroke={colorOf(h, idx)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Hover noktaları */}
          {hover != null
            ? series.map((h, idx) => {
                const v = h.daily[dayISOs[hover]] ?? 0;
                if (v <= 0) return null;
                return (
                  <circle key={h.id} cx={x(hover)} cy={y(v)} r={3.5} fill={colorOf(h, idx)} />
                );
              })
            : null}

          {/* Şeffaf hover yakalama bölgeleri (gün başına) */}
          {dayISOs.map((iso, i) => (
            <rect
              key={iso}
              x={padL + (n <= 1 ? 0 : ((i - 0.5) / (n - 1)) * plotW)}
              y={padT}
              width={n <= 1 ? plotW : plotW / (n - 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hover != null && hoverItems.length > 0 ? (
          <div
            className="trend-tip"
            style={{
              left: `${hoverPct}%`,
              transform: `translateX(${hoverPct > 60 ? "-100%" : "0"})`,
            }}
          >
            <div className="trend-tip-day">{hoverLabel}</div>
            {hoverItems.map((it) => (
              <div className="trend-tip-row" key={it.name}>
                <span className="trend-tip-dot" style={{ background: it.color }} />
                <span className="trend-tip-name">{it.name}</span>
                <span className="trend-tip-val">{formatMinutes(it.min)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="chart-legend">
        {series.map((h, i) => (
          <span className="legend-item" key={h.id}>
            <span className="legend-dot" style={{ background: colorOf(h, i) }} />
            {h.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function BigCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label muted small">{label}</div>
      {sub ? <div className="stat-sub muted small">{sub}</div> : null}
    </div>
  );
}

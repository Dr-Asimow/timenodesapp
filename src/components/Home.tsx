import { formatHours } from "../heat";

export type View = "home" | "week" | "weeks" | "profile" | "stats";

export function initials(name: string): string {
  const s = name.trim();
  if (!s) return "?";
  const parts = s.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export function Home({
  username,
  weekTotalMin,
  coins,
  onNavigate,
}: {
  username: string;
  weekTotalMin: number;
  coins: number;
  onNavigate: (v: View) => void;
}) {
  return (
    <div className="home">
      <button
        className="home-hero as-button"
        onClick={() => onNavigate("profile")}
        title="Profili aç"
      >
        <div className="avatar-lg">{initials(username)}</div>
        <div className="home-hero-text">
          <div className="home-hello">
            Merhaba, <strong>@{username}</strong>
          </div>
          <div className="muted small">
            Bu hafta {formatHours(weekTotalMin)} sa · {coins} time coin
          </div>
        </div>
        <div className="lvl-badge">Lv 1</div>
        <span className="hero-arrow">→</span>
      </button>

      <div className="home-menu">
        <MenuCard
          primary
          icon="📅"
          title="Mevcut Hafta"
          sub="Bu haftanın zaman takibini yap"
          onClick={() => onNavigate("week")}
        />
        <MenuCard
          icon="🗂️"
          title="Haftalar"
          sub="Geçmiş haftalara bak & karşılaştır"
          onClick={() => onNavigate("weeks")}
        />
        <MenuCard
          icon="📊"
          title="İstatistikler"
          sub="Zaman dağılımın, trendler, özet"
          onClick={() => onNavigate("stats")}
        />
      </div>
    </div>
  );
}

function MenuCard({
  icon,
  title,
  sub,
  primary,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`menu-card ${primary ? "primary" : ""}`} onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <span className="menu-text">
        <span className="menu-title">{title}</span>
        <span className="menu-sub muted small">{sub}</span>
      </span>
      <span className="menu-arrow">→</span>
    </button>
  );
}

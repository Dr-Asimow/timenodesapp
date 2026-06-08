import { formatHours } from "../heat";
import { BadgeCard, uidFromId, dateDMY } from "./BadgeCard";

export type View = "home" | "week" | "weeks" | "profile" | "stats";

export function initials(name: string): string {
  const s = name.trim();
  if (!s) return "?";
  const parts = s.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export function Home({
  userId,
  username,
  displayName,
  avatarUrl,
  memberSince,
  weekTotalMin,
  coins,
  onNavigate,
}: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberSince: string;
  weekTotalMin: number;
  coins: number;
  onNavigate: (v: View) => void;
}) {
  return (
    <div className="home">
      <div className="home-hello-line">
        Merhaba, <strong>{displayName || username}</strong>
        <span className="muted small">
          {" "}
          · bu hafta {formatHours(weekTotalMin)} sa · {coins} time coin
        </span>
      </div>

      <div className="home-split">
        <div
          className="home-card"
          role="button"
          tabIndex={0}
          title="Profili aç"
          onClick={() => onNavigate("profile")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("profile");
          }}
        >
          <BadgeCard
            name={displayName || username}
            imageUrl={avatarUrl}
            uid={uidFromId(userId)}
            dateLabel={dateDMY(memberSince)}
          />
          <span className="home-card-hint muted small">Profili aç →</span>
        </div>

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
          <MenuCard
            icon="👤"
            title="Profil"
            sub="Kartın, hesap ve ayarlar"
            onClick={() => onNavigate("profile")}
          />
        </div>
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

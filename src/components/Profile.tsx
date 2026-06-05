import { useState } from "react";
import { formatHours } from "../heat";
import { initials } from "./Home";

export function Profile({
  username,
  displayName,
  contactEmail,
  weekTotalMin,
  coins,
}: {
  username: string;
  displayName: string;
  contactEmail: string;
  weekTotalMin: number;
  coins: number;
}) {
  // Şimdilik yerel önizleme (kalıcı yükleme = Supabase Storage, sonraki adım)
  const [avatar, setAvatar] = useState<string | null>(null);

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAvatar(URL.createObjectURL(file));
  }

  return (
    <div className="profile">
      <div className="profile-top">
        <label className="avatar-upload" title="Profil resmi seç">
          {avatar ? (
            <img src={avatar} alt="avatar" />
          ) : (
            <span className="avatar-initials">{initials(username)}</span>
          )}
          <span className="avatar-cam">📷</span>
          <input type="file" accept="image/*" onChange={pickAvatar} hidden />
        </label>
        <div className="profile-id">
          <h2 className="profile-name">{displayName || username}</h2>
          <div className="muted">@{username}</div>
          {contactEmail ? (
            <div className="muted small">{contactEmail}</div>
          ) : null}
        </div>
      </div>

      <div className="profile-stats">
        <Stat label="Time Coin" value={`${coins}`} />
        <Stat label="Bu hafta" value={`${formatHours(weekTotalMin)} sa`} />
        <Stat label="Seviye" value="1" />
        <Stat label="Seri" value="—" />
      </div>

      <p className="muted small profile-note">
        Seviye, rozetler ve seri (gamification) yakında. Profil resmi şu an
        yalnızca önizleme — kalıcı yükleme (Supabase Storage) sonraki adımda
        eklenecek.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label muted small">{label}</div>
    </div>
  );
}

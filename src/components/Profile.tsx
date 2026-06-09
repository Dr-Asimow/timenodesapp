import { useState } from "react";
import { formatHours } from "../heat";
import { updateDisplayName, updatePassword, uploadAvatar } from "../db";
import { BadgeCard, dateDMY } from "./BadgeCard";
import { THEMES, getSavedTheme, applyTheme, type ThemeId } from "../theme";

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function memberSinceLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export function Profile({
  userId,
  username,
  displayName,
  contactEmail,
  avatarUrl,
  memberSince,
  friendCode,
  weekTotalMin,
  coins,
}: {
  userId: string;
  username: string;
  displayName: string;
  contactEmail: string;
  avatarUrl: string | null;
  memberSince: string;
  friendCode: string | null;
  weekTotalMin: number;
  coins: number;
}) {
  const [art, setArt] = useState<string | null>(avatarUrl);
  const [name, setName] = useState(displayName);
  const [nameInput, setNameInput] = useState(displayName);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyUid() {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pano erişimi yoksa yoksay */
    }
  }

  const [theme, setTheme] = useState<ThemeId>(getSavedTheme);

  function pickTheme(id: ThemeId) {
    applyTheme(id);
    setTheme(id);
  }

  const [showPw, setShowPw] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  async function uploadFile(file: File) {
    setBusy("avatar");
    setMsg(null);
    try {
      const url = await uploadAvatar(userId, file);
      setArt(url);
      setMsg("Kart görseli güncellendi.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Görsel yüklenemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function saveName() {
    const v = nameInput.trim();
    if (!v || v === name) return;
    setBusy("name");
    setMsg(null);
    try {
      await updateDisplayName(v);
      setName(v);
      setMsg("Görünen ad güncellendi.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ad güncellenemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < 6) {
      setMsg("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("Şifreler eşleşmiyor.");
      return;
    }
    setBusy("pw");
    setMsg(null);
    try {
      await updatePassword(pw1);
      setPw1("");
      setPw2("");
      setShowPw(false);
      setMsg("Şifre güncellendi.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Şifre güncellenemedi.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="profile">
      <div className="profile-grid">
        <div className="profile-card-col">
          <BadgeCard
            name={name || username}
            imageUrl={art}
            uid={friendCode ?? "········"}
            dateLabel={dateDMY(memberSince)}
            onPickImage={uploadFile}
            busy={busy === "avatar"}
          />
          <button
            className={`uid-copy${copied ? " copied" : ""}`}
            onClick={copyUid}
            disabled={!friendCode}
            title="UID'ni kopyala (arkadaş eklemek için)"
          >
            <span className="uid-copy-code">
              UID&nbsp;{friendCode ?? "········"}
            </span>
            <span className="uid-copy-ic">{copied ? "✓ kopyalandı" : "⧉"}</span>
          </button>
        </div>

        <div className="profile-side">
          <div className="profile-id">
            <h2 className="profile-name">{name || username}</h2>
            <div className="muted">@{username}</div>
            {contactEmail ? (
              <div className="muted small">{contactEmail}</div>
            ) : null}
            <div className="muted small">
              Üye: {memberSinceLabel(memberSince)}
            </div>
          </div>

          <div className="profile-stats">
            <Stat label="Time Coin" value={`${coins}`} />
            <Stat label="Bu hafta" value={`${formatHours(weekTotalMin)} sa`} />
            <Stat label="Seviye" value="1" />
            <Stat label="Seri" value="—" />
          </div>

          {msg ? <div className="profile-msg">{msg}</div> : null}

          <div className="account-box">
            <h3 className="account-title">Görünüm</h3>
            <div className="theme-picker">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch${theme === t.id ? " active" : ""}`}
                  onClick={() => pickTheme(t.id)}
                  title={t.label}
                >
                  <div
                    className="theme-swatch-preview"
                    style={{
                      background: t.bg,
                      borderBottom: `1px solid ${t.border}`,
                    }}
                  >
                    <span
                      className="theme-swatch-dot"
                      style={{ background: t.accent }}
                    />
                  </div>
                  <div
                    className="theme-swatch-name"
                    style={{ background: t.panel }}
                  >
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="account-box">
            <h3 className="account-title">Hesap</h3>

            <div className="account-row">
              <label className="account-label">Görünen ad</label>
              <div className="account-field">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Görünen ad"
                  maxLength={40}
                />
                <button
                  className="primary-btn small"
                  onClick={saveName}
                  disabled={busy === "name" || nameInput.trim() === name}
                >
                  Kaydet
                </button>
              </div>
            </div>

            <div className="account-row">
              <label className="account-label">Kart görseli</label>
              <div className="account-field">
                <label className="ghost-btn small file-btn">
                  {busy === "avatar" ? "Yükleniyor…" : "Görsel yükle"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(f);
                    }}
                    disabled={busy === "avatar"}
                  />
                </label>
                <span className="muted small">Karta yansır + renk verir</span>
              </div>
            </div>

            <div className="account-row">
              <label className="account-label">Şifre</label>
              {showPw ? (
                <form className="account-pw" onSubmit={savePassword}>
                  <input
                    type="password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    placeholder="Yeni şifre (≥6)"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Yeni şifre (tekrar)"
                    autoComplete="new-password"
                  />
                  <div className="account-pw-actions">
                    <button
                      className="primary-btn small"
                      type="submit"
                      disabled={busy === "pw"}
                    >
                      Güncelle
                    </button>
                    <button
                      className="ghost-btn small"
                      type="button"
                      onClick={() => {
                        setShowPw(false);
                        setPw1("");
                        setPw2("");
                      }}
                    >
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <div className="account-field">
                  <button
                    className="ghost-btn small"
                    onClick={() => setShowPw(true)}
                  >
                    Şifre değiştir
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="muted small profile-note">
            Kart çerçevesi ve clasp ileride market'ten değiştirilebilir skinler
            olacak. Varsayılan kart, görselinden otomatik renk alır.
          </p>
        </div>
      </div>
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

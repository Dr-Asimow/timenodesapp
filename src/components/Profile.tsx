import { useState } from "react";
import { formatHours } from "../heat";
import { initials } from "./Home";
import { updateDisplayName, updatePassword, uploadAvatar } from "../db";

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// userId'den sabit 12 haneli UID üret (kart görünümü için)
function uidFromId(id: string): string {
  const hex = (id.replace(/[^0-9a-f]/gi, "").slice(0, 15) || "0").toLowerCase();
  const n = BigInt("0x" + hex) % 1000000000000n;
  return n.toString().padStart(12, "0");
}

function dateDMY(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
}

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
  weekTotalMin,
  coins,
}: {
  userId: string;
  username: string;
  displayName: string;
  contactEmail: string;
  avatarUrl: string | null;
  memberSince: string;
  weekTotalMin: number;
  coins: number;
}) {
  const [art, setArt] = useState<string | null>(avatarUrl);
  const [name, setName] = useState(displayName);
  const [nameInput, setNameInput] = useState(displayName);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Şifre değiştir
  const [showPw, setShowPw] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const uid = uidFromId(userId);
  const cardName = name || username;
  // İsim uzunluğuna göre font boyu (max 2 satır, min okunur boyut)
  const nameSize =
    cardName.length <= 8
      ? 30
      : cardName.length <= 12
      ? 26
      : cardName.length <= 16
      ? 22
      : cardName.length <= 22
      ? 18
      : 16;

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      {/* Sol: kimlik kartı */}
      <div className="id-card">
        <label className="id-body" title="Kart görselini değiştir">
          {art ? (
            <img className="id-art-img" src={art} alt="" />
          ) : (
            <div className="id-art-fallback">{initials(cardName)}</div>
          )}
          <span className="id-status" />
          <div className="id-overlay" />
          <div className="id-name" style={{ fontSize: nameSize }}>
            {cardName}
            <span className="id-name-dot">.</span>
          </div>
          <div className="id-foot">
            <span>{dateDMY(memberSince)}</span>
            <span>UID:{uid}</span>
          </div>
          <span className="id-cam">📷</span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={onPickAvatar}
            disabled={busy === "avatar"}
          />
        </label>
        <div className="id-lanyard" />
        <div className="id-slot" />
      </div>

      {/* Sağ: hesap bilgileri + düzenleme */}
      <div className="profile-side">
        <div className="profile-id">
          <h2 className="profile-name">{name || username}</h2>
          <div className="muted">@{username}</div>
          {contactEmail ? (
            <div className="muted small">{contactEmail}</div>
          ) : null}
        </div>

        <div className="profile-stats">
          <Stat label="Time Coin" value={`${coins}`} />
          <Stat label="Bu hafta" value={`${formatHours(weekTotalMin)} sa`} />
          <Stat label="Seviye" value="1" />
          <Stat label="Seri" value="—" />
        </div>

        {msg ? <div className="profile-msg">{msg}</div> : null}

        <div className="account-box">
          <h3 className="account-title">Hesap</h3>

          {/* Görünen ad */}
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

          {/* Kart görseli */}
          <div className="account-row">
            <label className="account-label">Kart görseli</label>
            <div className="account-field">
              <label className="ghost-btn small file-btn">
                {busy === "avatar" ? "Yükleniyor…" : "Görsel yükle"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onPickAvatar}
                  disabled={busy === "avatar"}
                />
              </label>
              <span className="muted small">Karta yansır</span>
            </div>
          </div>

          {/* Şifre */}
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

          {/* Üyelik */}
          <div className="account-row">
            <label className="account-label">Üyelik</label>
            <div className="account-static muted small">
              {memberSinceLabel(memberSince)}
            </div>
          </div>
        </div>

        <p className="muted small profile-note">
          Seviye, rozetler ve seri (gamification) yakında. Kart çerçevesi,
          ipi ve geçiş efekti ileride özelleştirilebilir olacak.
        </p>
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

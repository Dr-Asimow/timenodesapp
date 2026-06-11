import { useState } from "react";

// Arkadaşlar sayfası — KABUK (Faz 0). Henüz backend yok: UID ile ekleme,
// arkadaş listesi ve gelen istekler statik/placeholder olarak gösterilir.
// Akış bağlandığında (Faz 3) bu bileşen db.ts fonksiyonlarına bağlanacak.
export function FriendsPage({ friendCode }: { friendCode: string | null }) {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");

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

  return (
    <div className="friends">
      <div className="friends-head">
        <h2 className="friends-title">Arkadaşlar</h2>
        <p className="muted small">
          Arkadaşlarını UID ile ekle, kartlarını birbirinizle paylaşın.
        </p>
      </div>

      <div className="friends-soon muted small">
        🚧 Altyapı henüz kurulmadı — bu sayfa şimdilik bir önizleme. Ekleme ve
        liste yakında çalışır hâle gelecek.
      </div>

      {/* Kendi UID'in (paylaşmak için) */}
      <div className="account-box">
        <h3 className="account-title">Senin UID'in</h3>
        <button
          className={`uid-copy${copied ? " copied" : ""}`}
          onClick={copyUid}
          disabled={!friendCode}
          title="UID'ni kopyala (arkadaşların seni eklemesi için)"
        >
          <span className="uid-copy-code">UID&nbsp;{friendCode ?? "········"}</span>
          <span className="uid-copy-ic">{copied ? "✓ kopyalandı" : "⧉"}</span>
        </button>
      </div>

      {/* UID ile arkadaş ekle (devre dışı placeholder) */}
      <div className="account-box">
        <h3 className="account-title">UID ile arkadaş ekle</h3>
        <div className="account-field">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="8 haneli UID"
            inputMode="numeric"
            disabled
          />
          <button className="primary-btn small" disabled>
            Ekle
          </button>
        </div>
      </div>

      {/* Gelen istekler (boş durum) */}
      <div className="account-box">
        <h3 className="account-title">Gelen istekler</h3>
        <div className="friends-empty muted small">Bekleyen istek yok.</div>
      </div>

      {/* Arkadaş listesi (boş durum) */}
      <div className="account-box">
        <h3 className="account-title">Arkadaşların</h3>
        <div className="friends-empty muted small">
          Henüz arkadaşın yok. Bir UID ekleyerek başla.
        </div>
      </div>
    </div>
  );
}

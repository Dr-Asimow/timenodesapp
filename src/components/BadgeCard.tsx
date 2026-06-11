import { useRef } from "react";
import frameUrl from "../assets/card/card_frame.png";
import defaultImageUrl from "../assets/card/card_image.png";
import { TiltedCard } from "./TiltedCard";

// --- Skin tanımı (ileride market'ten değiştirilebilir) ---------------
// Konvansiyon: tüm katman asset'leri (frame, clasp, gelecekteki süslemeler)
// aynı 252×486-oranlı tuvale çizilir (şablon: _skin_template.png, 2× = 504×1040,
// her kenarda ~%8 bleed/taşma payı). Hepsi inset:0 ile üst üste hizalanır;
// yalnızca kullanıcı görseli için `window` yüzdeleri verilir.
export type CardSkin = {
  id: string;
  frame: string; // 252×520 oranlı PNG, üstte askı boşluğu
  clasp?: string; // opsiyonel ayrı katman (aynı tuval) — yoksa çizilmez
  glass?: boolean; // app parıltısı (varsayılan açık)
  // Kullanıcı görselinin yerleştiği pencere (kart yüzdesi olarak)
  window: { top: number; left: number; right: number; bottom: number };
};

// Yeni skin eklemek için: asset'leri şablona çiz, buraya bir kayıt ekle.
export const SKINS: Record<string, CardSkin> = {
  default: {
    id: "default",
    frame: frameUrl,
    // _skin_template.png'deki görsel penceresi yüzdeleri
    window: { top: 27, left: 12, right: 12, bottom: 11 },
  },
};

export const DEFAULT_SKIN: CardSkin = SKINS.default;

// userId'den sabit 12 haneli UID
export function uidFromId(id: string): string {
  const hex = (id.replace(/[^0-9a-f]/gi, "").slice(0, 15) || "0").toLowerCase();
  const n = BigInt("0x" + hex) % 1000000000000n;
  return n.toString().padStart(12, "0");
}
export function dateDMY(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
}

export function BadgeCard({
  name,
  imageUrl,
  uid,
  dateLabel,
  onPickImage,
  busy,
  skin = DEFAULT_SKIN,
}: {
  name: string;
  imageUrl: string | null;
  uid: string;
  dateLabel: string;
  onPickImage?: (file: File) => void;
  busy?: boolean;
  skin?: CardSkin;
}) {
  const img = imageUrl || defaultImageUrl;
  const fileRef = useRef<HTMLInputElement>(null);

  const nameSize =
    name.length <= 8 ? 28 :
    name.length <= 12 ? 24 :
    name.length <= 16 ? 20 :
    name.length <= 22 ? 17 : 15;

  return (
    <TiltedCard rotateAmplitude={8} scaleOnHover={1.04}>
      <div className="badge-card">
      {/* 1) Frame (en altta, kendi rengiyle — tint YOK) */}
      <img className="bc-frame" src={skin.frame} alt="" />

      {/* Glass — frame şekline maskeli (asset'e gömülü değil, uygulama üretir) */}
      {skin.glass !== false ? (
        <div
          className="bc-glass"
          style={{
            WebkitMaskImage: `url(${skin.frame})`,
            maskImage: `url(${skin.frame})`,
          }}
        />
      ) : null}

      {/* 3) Kullanıcı görseli + 5) gradient + 4) bilgiler — iç pencerede */}
      <div
        className={`bc-window ${onPickImage ? "editable" : ""}`}
        style={{
          top: `${skin.window.top}%`,
          left: `${skin.window.left}%`,
          right: `${skin.window.right}%`,
          bottom: `${skin.window.bottom}%`,
        }}
        onClick={onPickImage ? () => fileRef.current?.click() : undefined}
        title={onPickImage ? "Kart görselini değiştir" : undefined}
      >
        <img className="bc-userimg" src={img} alt="" />
        <div className="bc-grad" />
        <div className="bc-info">
          <div className="bc-name" style={{ fontSize: nameSize }}>
            {name}
            <span className="bc-dot">.</span>
          </div>
          <div className="bc-foot">
            <span>{dateLabel}</span>
            <span>UID:{uid}</span>
          </div>
        </div>
        {onPickImage ? (
          <>
            <span className="bc-cam">{busy ? "…" : "📷"}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickImage(f);
              }}
              disabled={busy}
            />
          </>
        ) : null}
      </div>

      {/* 2) Clasp — opsiyonel asset katmanı (aynı tuval, en üstte). Yoksa çizilmez. */}
      {skin.clasp ? (
        <img className="bc-clasp" src={skin.clasp} alt="" aria-hidden="true" />
      ) : null}
      </div>
    </TiltedCard>
  );
}

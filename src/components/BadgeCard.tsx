import { useRef } from "react";
import frameUrl from "../assets/card/card_frame.png";
import defaultImageUrl from "../assets/card/card_image.png";
import { TiltedCard } from "./TiltedCard";

// --- Skin tanımı (ileride market'ten değiştirilebilir) ---------------
export type CardSkin = {
  id: string;
  frame: string;
  // Kullanıcı görselinin yerleştiği pencere (kart yüzdesi olarak)
  window: { top: number; left: number; right: number; bottom: number };
};

export const DEFAULT_SKIN: CardSkin = {
  id: "default",
  frame: frameUrl,
  // card_image.png'nin opak alanından ölçüldü
  window: { top: 24.7, left: 5.13, right: 5.13, bottom: 2.47 },
};

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
      <div
        className="bc-glass"
        style={{
          WebkitMaskImage: `url(${skin.frame})`,
          maskImage: `url(${skin.frame})`,
        }}
      />

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

      {/* 2) Clasp (CSS — tema rengiyle, asset yerine; üst orta) */}
      <div className="bc-clasp" aria-hidden="true" />
      </div>
    </TiltedCard>
  );
}

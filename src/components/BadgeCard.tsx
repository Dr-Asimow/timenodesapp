import { useEffect, useRef, useState } from "react";
import frameUrl from "../assets/card/card_frame.png";
import claspUrl from "../assets/card/card_clasp.png";
import defaultImageUrl from "../assets/card/card_image.png";

// --- Skin tanımı (ileride market'ten değiştirilebilir) ---------------
export type CardSkin = {
  id: string;
  frame: string;
  clasp: string;
  // Kullanıcı görselinin yerleştiği pencere (kart yüzdesi olarak)
  window: { top: number; left: number; right: number; bottom: number };
  // Frame rengini kullanıcı görselinden türet (yalnızca default skin'de)
  dynamicTint: boolean;
};

export const DEFAULT_SKIN: CardSkin = {
  id: "default",
  frame: frameUrl,
  clasp: claspUrl,
  // card_frame.png'nin şeffaf iç penceresinden ölçüldü
  window: { top: 24.7, left: 5.6, right: 5.6, bottom: 2.7 },
  dynamicTint: true,
};

// --- Renk yardımcıları (HSL clamp ile normalize) ---------------------
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// Kullanıcı görselinden baskın/accent rengi çıkar; gri ise null (tint yok)
function useDominantColor(url: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setColor(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cw = 36, ch = 72;
        const cv = document.createElement("canvas");
        cv.width = cw; cv.height = ch;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, cw, ch);
        const d = ctx.getImageData(0, 0, cw, ch).data;
        // Doygunlukla ağırlıklandırılmış ortalama (renkli pikseller baskın)
        let wr = 0, wg = 0, wb = 0, ws = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
          if (a < 128) continue;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const wgt = sat * sat + 0.02;
          wr += r * wgt; wg += g * wgt; wb += b * wgt; ws += wgt;
        }
        if (ws === 0) {
          if (!cancelled) setColor(null);
          return;
        }
        const avg: [number, number, number] = [wr / ws, wg / ws, wb / ws];
        let [h, s, l] = rgbToHsl(avg[0], avg[1], avg[2]);
        if (s < 0.08) {
          // Gri/renksiz görsel → tint uygulama
          if (!cancelled) setColor(null);
          return;
        }
        // Normalize: çok parlak/koyu okunabilirliği bozmasın
        s = Math.max(0.32, Math.min(0.85, s));
        l = Math.max(0.42, Math.min(0.6, l));
        const [r2, g2, b2] = hslToRgb(h, s, l);
        if (!cancelled) setColor(`rgb(${r2}, ${g2}, ${b2})`);
      } catch {
        if (!cancelled) setColor(null); // CORS vb. → tint yok
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return color;
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
  const tintColor = useDominantColor(skin.dynamicTint ? img : null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameSize =
    name.length <= 8 ? 28 :
    name.length <= 12 ? 24 :
    name.length <= 16 ? 20 :
    name.length <= 22 ? 17 : 15;

  const maskStyle = {
    WebkitMaskImage: `url(${skin.frame})`,
    maskImage: `url(${skin.frame})`,
  } as React.CSSProperties;

  return (
    <div className="badge-card">
      {/* 1) Frame (en altta) */}
      <img className="bc-frame" src={skin.frame} alt="" />

      {/* default skin: kullanıcı renginden tint (frame şeklinde maskeli, sadece ton) */}
      {skin.dynamicTint && tintColor ? (
        <div
          className="bc-tint"
          style={{ ...maskStyle, background: tintColor }}
        />
      ) : null}

      {/* uygulama tarafı glass (frame şeklinde maskeli, şeffaf alanları doldurmaz) */}
      <div className="bc-glass" style={maskStyle} />

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

      {/* 2) Clasp (en üstte, frame ile aynı eksende) */}
      <img className="bc-clasp" src={skin.clasp} alt="" aria-hidden="true" />
    </div>
  );
}

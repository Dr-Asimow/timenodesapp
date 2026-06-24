import { IconWarning } from "./Icons";
// timenodes. marka işareti — sondaki nokta yazılıyormuş gibi fade in/out yapar
export function Brand({
  size = "lg",
  tagline = true,
}: {
  size?: "lg" | "sm";
  tagline?: boolean;
}) {
  return (
    <div className={`brandmark ${size}`}>
      <div className="brand-title">
        timenodes<span className="brand-dot">.</span>
      </div>
      {tagline ? (
        <p className="brand-tagline">See where your time actually goes</p>
      ) : null}
    </div>
  );
}

// Tam ekran yükleniyor görünümü (aynı marka + animasyonlu nokta)
// Veri yüklenirken hata oluşursa sonsuz spinner yerine hatayı gösterir.
export function LoadingScreen({ error }: { error?: string | null } = {}) {
  return (
    <div className="loading-screen">
      <Brand />
      {error ? (
        <div className="loading-error">
          <p><IconWarning size={14} /> {error}</p>
          <button className="primary-btn small" onClick={() => window.location.reload()}>
            Tekrar dene
          </button>
        </div>
      ) : null}
    </div>
  );
}

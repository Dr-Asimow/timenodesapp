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
export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Brand />
    </div>
  );
}

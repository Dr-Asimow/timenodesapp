export function WeeksPage({ currentWeekNo }: { currentWeekNo: number }) {
  return (
    <div className="placeholder-page">
      <div className="ph-icon">🗂️</div>
      <h2>Haftalar</h2>
      <p className="muted">
        Buradan geçmiş haftalarına gidip "ne yapmışım" diye bakabileceksin —
        2-3 hafta öncesine atlamak, haftaları yan yana karşılaştırmak için.
      </p>
      <p className="muted small">
        Yakında. Şu an {currentWeekNo}. haftadasın.
      </p>
    </div>
  );
}

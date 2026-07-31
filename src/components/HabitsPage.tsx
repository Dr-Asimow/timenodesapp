import { useState } from "react";
import type { Habit } from "../types";
import type { HabitHealthLite } from "../db";

// Sağlık skoruna göre yatay barın rengi (süre/saat GÖSTERİLMEZ, sadece sağlık).
function healthColor(score: number): string {
  if (score >= 60) return "var(--lvl-5)";
  if (score >= 25) return "var(--lvl-3)";
  return "var(--danger)";
}

// Notlar sayfası: tüm aktif etkinlikler kapsül olarak (sadece ad + sağlık barı),
// "Etkinlik Ekle" kapsülü ve altta arşivlenmiş etkinlikler. Kapsüle tıklayınca
// etkinlik detay sayfası (renk/ad/kategori/notlar) açılır.
export function HabitsPage({
  habits,
  health,
  archivedHabits,
  onOpenHabit,
  onAddHabit,
  onRestoreHabit,
}: {
  habits: Habit[];
  health: Record<string, HabitHealthLite> | null;
  archivedHabits: Habit[];
  onOpenHabit: (habitId: string, name: string) => void;
  onAddHabit: (name: string) => void;
  onRestoreHabit: (habitId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function submitAdd() {
    const n = name.trim();
    if (!n) return;
    onAddHabit(n);
    setName("");
    setAdding(false);
  }

  return (
    <div className="notes-page">
      <h2 className="notes-h">Alışkanlıklar</h2>
      <div className="hcaps">
        {habits.map((h) => {
          const hh = health?.[h.id];
          const score = hh?.score ?? 0;
          return (
            <button
              className="hcap"
              key={h.id}
              onClick={() => onOpenHabit(h.id, h.name)}
            >
              <span className="hcap-name">{h.name}</span>
              <div className="hcap-bar">
                <div
                  className="hcap-fill"
                  style={{ width: `${score}%`, background: healthColor(score) }}
                />
              </div>
            </button>
          );
        })}
        <button className="hcap hcap-add" onClick={() => setAdding(true)}>
          <span className="hcap-plus">+</span>
          <span className="hcap-add-label">Etkinlik Ekle</span>
        </button>
      </div>

      {archivedHabits.length > 0 ? (
        <>
          <h2 className="notes-h">Arşiv</h2>
          <div className="hcaps">
            {archivedHabits.map((h) => (
              <button
                className="hcap hcap-arch"
                key={h.id}
                title="Geri getir"
                onClick={() => onRestoreHabit(h.id)}
              >
                <span className="hcap-name">{h.name}</span>
                <span className="hcap-arch-label muted small">Geri getir</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {adding ? (
        <div
          className="modal-overlay"
          onClick={() => {
            setName("");
            setAdding(false);
          }}
        >
          <form
            className="modal habit-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd();
            }}
          >
            <h2 className="modal-title">Yeni etkinlik</h2>
            <input
              autoFocus
              className="habit-modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Etkinlik ismi…"
            />
            <div className="modal-actions">
              <button className="primary-btn" type="submit">
                Ekle
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setName("");
                  setAdding(false);
                }}
              >
                Vazgeç
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

import { useState } from "react";
import type { Goal } from "../types";

// Hedef seçme/ekleme popup'ı — hem sol panel (TimerPanel) hem sağ panel
// (RightPanel) tarafından kullanılır. onSelect verilirse seçim modu açıktır.
export function GoalPopup({
  goals,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onClose,
}: {
  goals: Goal[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="goal-popup" onClick={(e) => e.stopPropagation()}>
        <div className="goal-popup-head">
          <span className="muted small">HEDEFLER</span>
          <button className="goal-popup-x" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {goals.length === 0 ? (
          <p className="rtab-empty muted small">Henüz hedef yok.</p>
        ) : (
          <ul className="goal-popup-list">
            {goals.map((g) => (
              <li
                key={g.id}
                className={`goal-popup-item${selectedId === g.id ? " sel" : ""}`}
              >
                {onSelect ? (
                  <button
                    className="goal-popup-pick"
                    onClick={() => {
                      onSelect(g.id);
                      onClose();
                    }}
                  >
                    {g.text}
                  </button>
                ) : (
                  <span className="goal-popup-text">{g.text}</span>
                )}
                <button
                  className="goal-popup-del"
                  onClick={() => onDelete(g.id)}
                  aria-label="Sil"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="goal-popup-add"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            className="rtab-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yeni hedef…"
          />
          <button type="submit" className="rtab-add-btn">
            +
          </button>
        </form>
      </div>
    </div>
  );
}

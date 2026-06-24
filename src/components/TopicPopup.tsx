import { useState } from "react";
import { createPortal } from "react-dom";
import type { Topic } from "../types";

// Konu seçme/ekleme popup'ı (etkinliğe bağlı kalıcı konular).
// onSelect verilirse seçim modu açıktır.
export function TopicPopup({
  topics,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onClose,
}: {
  topics: Topic[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdd: (name: string) => void;
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

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="goal-popup" onClick={(e) => e.stopPropagation()}>
        <div className="goal-popup-head">
          <span className="muted small">KONULAR</span>
          <button className="goal-popup-x" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {onSelect ? (
          <button
            className="goal-popup-pick topic-none"
            onClick={() => {
              onSelect("");
              onClose();
            }}
          >
            Konusuz
          </button>
        ) : null}

        {topics.length === 0 ? (
          <p className="rtab-empty muted small">Henüz konu yok.</p>
        ) : (
          <ul className="goal-popup-list">
            {topics.map((t) => (
              <li
                key={t.id}
                className={`goal-popup-item${selectedId === t.id ? " sel" : ""}`}
              >
                {onSelect ? (
                  <button
                    className="goal-popup-pick"
                    onClick={() => {
                      onSelect(t.id);
                      onClose();
                    }}
                  >
                    {t.name}
                  </button>
                ) : (
                  <span className="goal-popup-text">{t.name}</span>
                )}
                <button
                  className="goal-popup-del"
                  onClick={() => onDelete(t.id)}
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
            placeholder="Yeni konu…"
          />
          <button type="submit" className="rtab-add-btn">
            +
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

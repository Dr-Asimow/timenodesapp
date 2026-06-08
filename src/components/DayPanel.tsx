import { useState } from "react";
import type { Habit, TodoItem } from "../types";
import { formatMinutes } from "../heat";

export function DayPanel({
  dateLabel,
  dayName,
  habits,
  items,
  todayMinutes,
  runningHabitIds,
  onAddHabit,
  onAddTodo,
  onToggleTodo,
  onDeleteItem,
  onStartHabit,
  onOpenHabit,
  onOpenNote,
}: {
  dateLabel: string;
  dayName: string;
  habits: Habit[];
  items: TodoItem[];
  todayMinutes: Record<string, number>;
  runningHabitIds: Set<string>;
  onAddHabit: (habitId: string, habitName: string) => void;
  onAddTodo: (title: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteItem: (id: string) => void;
  onStartHabit: (habitId: string) => void;
  onOpenHabit: (habitId: string) => void;
  onOpenNote: () => void;
}) {
  const [modal, setModal] = useState(false);

  const habitItems = items.filter((i) => i.habitId);
  const todoItems = items.filter((i) => !i.habitId);
  const empty = items.length === 0;

  return (
    <aside className="day-panel">
      <div className="day-panel-head">
        <div className="day-panel-date">{dateLabel}</div>
        <div className="day-panel-name">{dayName}</div>
      </div>

      <div className="day-agenda">
        {empty ? (
          <button className="agenda-add-big" onClick={() => setModal(true)}>
            <span className="agenda-add-plus">+</span>
            <span>Gündem ekle</span>
          </button>
        ) : (
          <>
            {habitItems.map((it) => {
              const running = it.habitId
                ? runningHabitIds.has(it.habitId)
                : false;
              const mins = it.habitId ? todayMinutes[it.habitId] ?? 0 : 0;
              return (
                <div
                  className="agenda-item habit"
                  key={it.id}
                  title="Sayaç penceresini aç"
                  onClick={() => it.habitId && onOpenHabit(it.habitId)}
                >
                  <span className="agenda-title">{it.title}</span>
                  {mins > 0 ? (
                    <span className="agenda-min">{formatMinutes(mins)}</span>
                  ) : null}
                  {running ? (
                    <span className="agenda-running">● çalışıyor</span>
                  ) : (
                    <button
                      className="agenda-start"
                      onClick={(e) => {
                        e.stopPropagation();
                        it.habitId && onStartHabit(it.habitId);
                      }}
                    >
                      ▶ başla
                    </button>
                  )}
                  <button
                    className="agenda-del"
                    title="Kaldır"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(it.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {todoItems.map((it) => (
              <label className="agenda-item todo" key={it.id}>
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={(e) => onToggleTodo(it.id, e.target.checked)}
                />
                <span className={`agenda-title ${it.done ? "done" : ""}`}>
                  {it.title}
                </span>
                <button
                  className="agenda-del"
                  title="Sil"
                  onClick={() => onDeleteItem(it.id)}
                >
                  ×
                </button>
              </label>
            ))}

            <button className="agenda-add-small" onClick={() => setModal(true)}>
              + Gündem ekle
            </button>
          </>
        )}
      </div>

      <button className="notebook-btn" onClick={onOpenNote}>
        📓 Günlük
      </button>

      {modal ? (
        <AgendaModal
          habits={habits}
          items={items}
          onAddHabit={onAddHabit}
          onAddTodo={onAddTodo}
          onRemove={onDeleteItem}
          onClose={() => setModal(false)}
        />
      ) : null}
    </aside>
  );
}

function AgendaModal({
  habits,
  items,
  onAddHabit,
  onAddTodo,
  onRemove,
  onClose,
}: {
  habits: Habit[];
  items: TodoItem[];
  onAddHabit: (habitId: string, habitName: string) => void;
  onAddTodo: (title: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [todo, setTodo] = useState("");

  // habitId → eklenmiş gündem öğesi (varsa)
  const addedByHabit = new Map<string, string>();
  for (const it of items) if (it.habitId) addedByHabit.set(it.habitId, it.id);

  function submitTodo() {
    const t = todo.trim();
    if (!t) return;
    onAddTodo(t);
    setTodo("");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal agenda-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-x" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <div className="agenda-cols">
          <div className="agenda-col">
            <h3 className="agenda-col-title">Günlük Etkinlikler</h3>
            <p className="agenda-col-hint muted small">
              Haftalık tablodaki işlerden bugüne ekle
            </p>
            <div className="agenda-habit-list">
              {habits.map((h) => {
                const addedId = addedByHabit.get(h.id);
                return (
                  <button
                    key={h.id}
                    className={`agenda-habit ${addedId ? "added" : ""}`}
                    onClick={() =>
                      addedId ? onRemove(addedId) : onAddHabit(h.id, h.name)
                    }
                  >
                    <span>{h.name}</span>
                    <span className="agenda-habit-mark">
                      {addedId ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="agenda-col">
            <h3 className="agenda-col-title">Yapılacak Ekle</h3>
            <p className="agenda-col-hint muted small">
              Bugüne özel bir to-do yaz
            </p>
            <form
              className="agenda-todo-form"
              onSubmit={(e) => {
                e.preventDefault();
                submitTodo();
              }}
            >
              <input
                autoFocus
                className="agenda-todo-input"
                value={todo}
                onChange={(e) => setTodo(e.target.value)}
                placeholder="Örn. Müşteriye teklif gönder"
              />
              <button className="agenda-todo-add" type="submit">
                +
              </button>
            </form>

            <div className="agenda-todo-preview">
              {items
                .filter((i) => !i.habitId)
                .map((i) => (
                  <div className="agenda-todo-chip" key={i.id}>
                    <span>{i.title}</span>
                    <button onClick={() => onRemove(i.id)} aria-label="Sil">
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

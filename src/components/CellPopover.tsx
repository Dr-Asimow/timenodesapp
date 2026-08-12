import { useEffect, useState } from "react";
import type { Topic, TopicMinute } from "../types";
import type { DayType } from "./WeekGrid";
import { DeltaPicker } from "./TimerWidget";
import { loadTopicMinutes, loadTopics, addTopic, deleteTopic, addTopicMinutes, clearCellWork } from "../db";
import { formatMinutes } from "../heat";
import { TopicPopup } from "./TopicPopup";

export function CellPopover({
  dayType,
  dayLabel,
  habitId,
  dayISO,
  userId,
  habitName,
  workMin,
  note,
  onAddWork,
  onSetNote,
  onClose,
}: {
  dayType: DayType;
  dayLabel: string;
  habitId: string;
  dayISO: string;
  userId: string;
  habitName: string;
  workMin: number;
  note: string | null;
  onAddWork: (deltaMin: number) => void;
  onSetNote: (note: string) => void;
  onClose: () => void;
}) {
  const isFuture = dayType === "future";

  // Konu bazında süre kırılımı (Supabase'den)
  const [topicMins, setTopicMins] = useState<TopicMinute[]>([]);
  useEffect(() => {
    if (workMin <= 0) {
      setTopicMins([]);
      return;
    }
    let cancel = false;
    loadTopicMinutes(habitId, dayISO)
      .then((t) => { if (!cancel) setTopicMins(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [habitId, dayISO, workMin]);

  const topicSum = topicMins.reduce((a, t) => a + t.min, 0);
  const untracked = Math.max(0, workMin - topicSum);
  // Barlar toplam süreye göre ölçeklenir (kırılım toplamı aşarsa ona göre)
  const barMax = Math.max(workMin, topicSum, 1);

  // Süre ekleme/çıkarmanın hedefi olan konu seçimi
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [showTopicPopup, setShowTopicPopup] = useState(false);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const selectedTopicMin =
    topicMins.find((t) => t.topicId === selectedTopicId)?.min ?? 0;
  // Etkinliğin konusu varsa konu seçimi zorunlu (Konusuz ile süre verilemez)
  const topicRequired = !isFuture && topics.length > 0 && !selectedTopicId;
  useEffect(() => {
    if (isFuture) return;
    let cancel = false;
    loadTopics(habitId)
      .then((t) => { if (!cancel) setTopics(t); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [habitId, isFuture]);

  // Çalışma dakikası TEK DEFTERE (topic_minutes) yazılır: kategori seçiliyse ona,
  // değilse kategorisiz (NULL) satıra. onAddWork yalnız yereldeki hücre toplamını
  // (anlık görüntü) günceller; kalıcı değer topic_minutes'tir.
  async function applyDelta(delta: number) {
    if (topicRequired) return; // konu zorunlu ama seçilmemiş
    let d = delta;
    // Negatifte ilgili satırın altına düşme: seçili kategori süresi ya da kategorisiz kısım kadar sınırla
    if (d < 0) {
      const cap = selectedTopic ? selectedTopicMin : untracked;
      d = -Math.min(-d, cap);
    }
    if (d === 0) return;
    try {
      await addTopicMinutes(userId, habitId, dayISO, selectedTopic ? selectedTopic.id : null, d);
    } catch {
      return; // yazılamadıysa yerel toplamı da değiştirme
    }
    onAddWork(d);
  }

  async function handleAddTopic(name: string) {
    if (!userId) return;
    try {
      const t = await addTopic(userId, habitId, name);
      setTopics((cur) => [...cur, t]);
    } catch { /* yoksay */ }
  }
  function handleDeleteTopic(id: string) {
    if (selectedTopicId === id) setSelectedTopicId("");
    setTopics((cur) => cur.filter((t) => t.id !== id));
    deleteTopic(id).catch(() => {});
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cell-modal" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">
            {habitName} · {dayLabel}
          </span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {isFuture ? (
          workMin > 0 ? (
            <div className="future-stale">
              <div className="cell-bigstat">
                <BigStat workMin={workMin} />
              </div>
              <p className="future-note muted small">
                Bu ileri tarihte hatalı kayıtlı süre var (eski bir sayaçtan
                kalmış). İleri tarihte zaman takibi olmadığı için sıfırlayabilirsin.
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={async () => {
                  // Kalıcı kayıt tek defterde (topic_minutes) — önce onu temizle
                  try { await clearCellWork(habitId, dayISO); } catch { /* yoksay */ }
                  onAddWork(-workMin); // yereldeki hücre toplamını da sıfırla
                  onClose();
                }}
              >
                Süreyi sıfırla
              </button>
            </div>
          ) : (
            <p className="future-note muted small">
              İleri tarih — burada zaman takibi yok, ama plan/aktivite notu
              bırakabilirsin.
            </p>
          )
        ) : (
          <>
            <div className="cell-bigstat">
              <BigStat workMin={workMin} />
            </div>
            {topicMins.length > 0 ? (
              <div className="topic-breakdown">
                <span className="popover-label">Konular</span>
                <ul className="topic-list">
                  {topicMins.map((t) => (
                    <li className="topic-row" key={t.topicId}>
                      <span className="topic-name">{t.name}</span>
                      <span className="topic-bar-track">
                        <span
                          className="topic-bar-fill"
                          style={{ width: `${Math.min(100, (t.min / barMax) * 100)}%` }}
                        />
                      </span>
                      <span className="topic-val">{formatMinutes(t.min)}</span>
                    </li>
                  ))}
                  {untracked > 0 ? (
                    <li className="topic-row muted">
                      <span className="topic-name">Konusuz</span>
                      <span className="topic-bar-track">
                        <span
                          className="topic-bar-fill"
                          style={{ width: `${Math.min(100, (untracked / barMax) * 100)}%` }}
                        />
                      </span>
                      <span className="topic-val">{formatMinutes(untracked)}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <div className="popover-divider" />
            <div className="tp-goal-row">
              <span className="tp-settings-label muted small">Konu</span>
              <button
                type="button"
                className={`tp-goal-select${topicRequired ? " topic-required" : ""}`}
                onClick={() => setShowTopicPopup(true)}
              >
                <span className={selectedTopic ? "" : "muted"}>
                  {selectedTopic
                    ? selectedTopic.name
                    : topics.length > 0
                    ? "Konu seç"
                    : "Konusuz"}
                </span>
                <span className="tp-goal-caret">▾</span>
              </button>
              {topicRequired ? (
                <span className="topic-required-hint">
                  Süre eklemek için bir konu seç (ya da yeni konu ekle).
                </span>
              ) : null}
            </div>
            <div className="cell-delta">
              <DeltaPicker
                current={selectedTopic ? selectedTopicMin : workMin}
                onApply={applyDelta}
                disabled={topicRequired}
              />
            </div>
            <div className="popover-divider" />
          </>
        )}

        <NoteField note={note} onSetNote={onSetNote} />
      </div>

      {showTopicPopup ? (
        <TopicPopup
          topics={topics}
          selectedId={selectedTopicId}
          onSelect={setSelectedTopicId}
          onAdd={handleAddTopic}
          onDelete={handleDeleteTopic}
          onClose={() => setShowTopicPopup(false)}
        />
      ) : null}
    </div>
  );
}

function NoteField({
  note,
  onSetNote,
}: {
  note: string | null;
  onSetNote: (note: string) => void;
}) {
  const [val, setVal] = useState(note ?? "");
  return (
    <div className="notefield">
      <span className="popover-label">Aktivite notu</span>
      <textarea
        className="note-area"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if ((val ?? "") !== (note ?? "")) onSetNote(val);
        }}
        placeholder="Bugün ne yaptın / ne yapacaksın?"
        rows={3}
      />
    </div>
  );
}

function BigStat({ workMin }: { workMin: number }) {
  const h = Math.floor(workMin / 60);
  const m = workMin % 60;
  if (h > 0) {
    return (
      <div className="bigstat">
        <span className="bigstat-num">
          {h}
          <span className="bigstat-unit">saat</span>
        </span>
        {m > 0 ? <span className="bigstat-sub">{m} dakika</span> : null}
      </div>
    );
  }
  return (
    <div className="bigstat">
      <span className="bigstat-num">
        {workMin}
        <span className="bigstat-unit">dakika</span>
      </span>
    </div>
  );
}

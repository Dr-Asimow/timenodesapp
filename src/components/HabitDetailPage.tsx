import { useEffect, useState } from "react";
import {
  loadHabitDetail,
  loadHabitPage,
  saveHabitPage,
  addTopic,
  deleteTopic,
  type HabitDetail,
} from "../db";
import { formatMinutes } from "../heat";
import { dateDMY } from "./BadgeCard";
import { IconNote, IconPencil } from "./Icons";
import { NotePage, HabitColorPicker } from "./note/NotePage";

// Etkinlik detay sayfası: ad, kategoriler (konular), zaman istatistikleri
// (hafta/ay/yıl/tüm zamanlar) ve etkinlik sağlığı. "Notlar" butonu üzerinden
// etkinliğe bağlı serbest not sayfasına gidilir.
export function HabitDetailPage({
  habitId,
  name,
  userId,
  accentColor,
  onAccentColorChange,
  onRename,
  onClose,
}: {
  habitId: string;
  name: string;
  userId: string;
  accentColor: string | null;
  onAccentColorChange: (color: string | null) => void;
  onRename: (name: string) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<HabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    loadHabitDetail(habitId)
      .then((d) => {
        if (!cancel) setDetail(d);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [habitId]);

  async function refresh() {
    const d = await loadHabitDetail(habitId);
    setDetail(d);
  }

  async function submitTopic() {
    const n = newTopic.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      await addTopic(userId, habitId, n);
      setNewTopic("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeTopic(id: string) {
    await deleteTopic(id).catch(() => {});
    await refresh();
  }

  function startEditName() {
    setNameInput(name);
    setEditingName(true);
  }

  function submitName() {
    setEditingName(false);
    const n = nameInput.trim();
    if (n && n !== name) onRename(n);
  }

  if (showNotes) {
    return (
      <NotePage
        pageKey={`habit:${habitId}`}
        headerLabel={`${name} · Notlar`}
        userId={userId}
        load={() => loadHabitPage(habitId)}
        save={(title, content) => saveHabitPage(userId, habitId, title, content)}
        onClose={() => setShowNotes(false)}
      />
    );
  }

  const health = detail?.health ?? null;
  const tier =
    !health || health.windowDays === 0
      ? null
      : health.score >= 60
      ? { label: "Sağlıklı", color: "var(--lvl-5)" }
      : health.score >= 25
      ? { label: "Orta", color: "var(--lvl-3)" }
      : { label: "Düşük", color: "var(--danger)" };

  return (
    <div
      className="note-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="note-modal">
        <div className="note-topbar">
          <button className="ghost-btn small" onClick={onClose}>
            ← Kapat
          </button>
          <span className="note-day muted small">{name} · Etkinlik</span>
          <HabitColorPicker color={accentColor} onChange={onAccentColorChange} />
          <button
            className="ghost-btn accent small hp-notes-btn"
            onClick={() => setShowNotes(true)}
          >
            <IconNote size={14} /> Notlar
          </button>
        </div>

        <div className="note-scroll">
          <div className="note-doc hp-doc">
            {loading || !detail ? (
              <p className="muted small">Yükleniyor…</p>
            ) : (
              <>
                <div className="hp-title-row">
                  {editingName ? (
                    <input
                      className="hp-title-input"
                      value={nameInput}
                      autoFocus
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={submitName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitName();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingName(false);
                        }
                      }}
                    />
                  ) : (
                    <>
                      <h1 className="note-title hp-title">{name}</h1>
                      <button
                        type="button"
                        className="hp-title-edit-btn"
                        title="Adı düzenle"
                        onClick={startEditName}
                      >
                        <IconPencil size={16} />
                      </button>
                    </>
                  )}
                </div>
                <p className="muted small hp-created">
                  Oluşturulma: {dateDMY(detail.createdAt)}
                </p>

                <div className="hp-stats profile-stats">
                  <div className="stat-card">
                    <div className="stat-value">{formatMinutes(detail.stats.week)}</div>
                    <div className="muted small">Bu hafta</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{formatMinutes(detail.stats.month)}</div>
                    <div className="muted small">Bu ay</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{formatMinutes(detail.stats.year)}</div>
                    <div className="muted small">Bu yıl</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{formatMinutes(detail.stats.allTime)}</div>
                    <div className="muted small">Tüm zamanlar</div>
                  </div>
                </div>

                <section className="hp-section">
                  <h3 className="hp-section-title">Etkinlik sağlığı</h3>
                  {tier ? (
                    <div className="hp-health">
                      <div className="hp-health-head">
                        <span className="hp-health-label" style={{ color: tier.color }}>
                          {tier.label}
                        </span>
                        <span className="muted small">
                          Son {health!.windowDays} günün {health!.activeDays} gününde çalışıldı
                        </span>
                      </div>
                      <div className="hp-health-bar">
                        <div
                          className="hp-health-fill"
                          style={{ width: `${health!.score}%`, background: tier.color }}
                        />
                      </div>
                      <p className="muted small hp-health-note">
                        {health!.lastActiveDay
                          ? `Son çalışma: ${dateDMY(health!.lastActiveDay)}`
                          : "Henüz çalışma kaydı yok."}
                      </p>
                    </div>
                  ) : (
                    <p className="muted small">Henüz veri yok.</p>
                  )}
                </section>

                <section className="hp-section">
                  <h3 className="hp-section-title">Kategoriler</h3>
                  {detail.topics.length === 0 ? (
                    <p className="muted small">Henüz kategori yok.</p>
                  ) : (
                    <ul className="hp-topic-list">
                      {detail.topics.map((t) => (
                        <li key={t.id} className="hp-topic-card">
                          <div className="hp-topic-head">
                            <span className="hp-topic-name">{t.name}</span>
                            <button
                              className="goal-popup-del"
                              onClick={() => removeTopic(t.id)}
                              aria-label="Sil"
                            >
                              ×
                            </button>
                          </div>
                          <p className="muted small hp-topic-created">
                            Oluşturulma: {dateDMY(t.createdAt)}
                          </p>
                          <div className="hp-topic-stats">
                            <span>{formatMinutes(t.week)} <em>hafta</em></span>
                            <span>{formatMinutes(t.month)} <em>ay</em></span>
                            <span>{formatMinutes(t.year)} <em>yıl</em></span>
                            <span>{formatMinutes(t.allTime)} <em>toplam</em></span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="goal-popup-add hp-topic-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitTopic();
                    }}
                  >
                    <input
                      className="rtab-input"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="Yeni kategori…"
                    />
                    <button type="submit" className="rtab-add-btn" disabled={busy}>
                      +
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

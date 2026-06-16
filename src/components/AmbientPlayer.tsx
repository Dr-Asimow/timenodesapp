import { SOUNDS, type AmbientId } from "../ambient";

// Ortak ses butonları (hem sağ panel hem yüzen oynatıcıda kullanılır)
export function AmbientButtons({
  current,
  playing,
  onToggle,
}: {
  current: AmbientId | null;
  playing: boolean;
  onToggle: (id: AmbientId) => void;
}) {
  return (
    <div className="ambient-grid">
      {SOUNDS.map((s) => {
        const on = current === s.id && playing;
        return (
          <button
            key={s.id}
            className={`ambient-btn${on ? " on" : ""}`}
            onClick={() => onToggle(s.id)}
          >
            <span className="ambient-ic">{s.icon}</span>
            <span className="ambient-lbl">{s.label}</span>
            {on ? <span className="ambient-eq">♪</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// Sağ panel içindeki gömülü oynatıcı (hafta görünümü)
export function AmbientInline({
  current,
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  current: AmbientId | null;
  playing: boolean;
  volume: number;
  onToggle: (id: AmbientId) => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="side-card side-music">
      <div className="side-music-title">Sesler</div>
      <AmbientButtons current={current} playing={playing} onToggle={onToggle} />
      <div className="ambient-vol">
        <span className="muted small">🔉</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(parseInt(e.target.value, 10) / 100)}
        />
      </div>
    </div>
  );
}

// Diğer sayfalarda sağ-altta beliren yüzen oynatıcı
export function AmbientFloating({
  current,
  playing,
  collapsed,
  onToggle,
  onToggleCollapse,
}: {
  current: AmbientId | null;
  playing: boolean;
  collapsed: boolean;
  onToggle: (id: AmbientId) => void;
  onToggleCollapse: () => void;
}) {
  const activeLabel =
    current && playing
      ? SOUNDS.find((s) => s.id === current)?.label ?? "Sesler"
      : "Sesler";

  if (collapsed) {
    return (
      <button
        className="ambient-fab"
        onClick={onToggleCollapse}
        title={playing ? activeLabel : "Sesler"}
      >
        {playing ? "🔊" : "🎵"}
      </button>
    );
  }

  return (
    <aside className="ambient-floating">
      <div className="ambient-float-head">
        <span className="ambient-float-title">{activeLabel}</span>
        <button
          className="ambient-float-min"
          onClick={onToggleCollapse}
          title="Küçült"
        >
          —
        </button>
      </div>
      <AmbientButtons current={current} playing={playing} onToggle={onToggle} />
    </aside>
  );
}

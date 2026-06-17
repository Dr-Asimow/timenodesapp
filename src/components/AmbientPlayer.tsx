import { useState } from "react";
import { SOUNDS, type AmbientId } from "../ambient";
import type { YouTubeApi } from "../useYouTube";

// Ortak ambient ses butonları. compact=true daha küçük yerleşim.
export function AmbientButtons({
  current,
  playing,
  compact,
  onToggle,
}: {
  current: AmbientId | null;
  playing: boolean;
  compact?: boolean;
  onToggle: (id: AmbientId) => void;
}) {
  return (
    <div className={`ambient-grid${compact ? " compact" : ""}`}>
      {SOUNDS.map((s) => {
        const on = current === s.id && playing;
        return (
          <button
            key={s.id}
            className={`ambient-btn${on ? " on" : ""}`}
            onClick={() => onToggle(s.id)}
            title={s.label}
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

// YouTube kontrolleri (link kutusu + oynatıcı). Hem kart hem floating kullanır.
function YouTubeControls({ yt }: { yt: YouTubeApi }) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (yt.loadInput(input)) {
      setErr(false);
      setInput("");
    } else {
      setErr(true);
    }
  }

  return (
    <div className="yt-block">
      {yt.hasTarget ? (
        <div className="yt-now">
          <div className="yt-thumb">
            {yt.videoId ? (
              <img
                src={`https://img.youtube.com/vi/${yt.videoId}/default.jpg`}
                alt=""
              />
            ) : null}
          </div>
          <div className="yt-now-title" title={yt.title}>
            {yt.title || "Yükleniyor…"}
          </div>
          <div className="yt-controls">
            <button onClick={yt.prev} title="Önceki">⏮</button>
            <button className="yt-play" onClick={yt.toggle} title="Oynat/Duraklat">
              {yt.playing ? "❚❚" : "▶"}
            </button>
            <button onClick={yt.next} title="Sonraki">⏭</button>
          </div>
        </div>
      ) : null}
      <form className="yt-form" onSubmit={submit}>
        <input
          className={`yt-input${err ? " err" : ""}`}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (err) setErr(false);
          }}
          placeholder="YouTube linki yapıştır…"
        />
        <button className="yt-add" type="submit" title="Yükle">+</button>
      </form>
    </div>
  );
}

// Sağ paneldeki müzik kartı: üstte YouTube, altta kompakt ortam sesleri.
export function MusicCard({
  yt,
  current,
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  yt: YouTubeApi;
  current: AmbientId | null;
  playing: boolean;
  volume: number;
  onToggle: (id: AmbientId) => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="side-card side-music">
      <div className="side-music-title">Müzik</div>
      <YouTubeControls yt={yt} />
      <div className="ambient-mini">
        <div className="ambient-mini-head muted small">Ortam sesleri</div>
        <AmbientButtons
          current={current}
          playing={playing}
          compact
          onToggle={onToggle}
        />
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
    </div>
  );
}

// Diğer sayfalarda sağ-altta küçük kare; tıklayınca müzik + sesler açılır.
export function MusicFloating({
  yt,
  current,
  playing,
  collapsed,
  onToggle,
  onToggleCollapse,
}: {
  yt: YouTubeApi;
  current: AmbientId | null;
  playing: boolean;
  collapsed: boolean;
  onToggle: (id: AmbientId) => void;
  onToggleCollapse: () => void;
}) {
  const anyPlaying = yt.playing || playing;

  if (collapsed) {
    return (
      <button
        className="ambient-fab"
        onClick={onToggleCollapse}
        title="Müzik & sesler"
      >
        {anyPlaying ? "🔊" : "🎵"}
      </button>
    );
  }

  return (
    <aside className="ambient-floating">
      <div className="ambient-float-head">
        <span className="ambient-float-title">Müzik</span>
        <button
          className="ambient-float-min"
          onClick={onToggleCollapse}
          title="Küçült"
        >
          —
        </button>
      </div>
      <YouTubeControls yt={yt} />
      <AmbientButtons
        current={current}
        playing={playing}
        compact
        onToggle={onToggle}
      />
    </aside>
  );
}

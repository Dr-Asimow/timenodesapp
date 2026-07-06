import { useState } from "react";
import { SOUNDS, type AmbientId } from "../ambient";
import type { YouTubeApi } from "../useYouTube";
import type { MusicFavoritesApi } from "../useMusicFavorites";
import { MusicSearch } from "./MusicSearch";
import { MusicFavoritesPopup } from "./MusicFavorites";
import { Collapse } from "./Collapse";

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

// Tema uyumlu ses çubuğu (hem müzik hem ortam sesleri için ortak).
export function VolumeSlider({
  value,
  onChange,
  icon = "🔉",
}: {
  value: number;
  onChange: (v: number) => void;
  icon?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="vol-row">
      <span className="vol-ic">{icon}</span>
      <input
        className="vol-range"
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-2) ${pct}%, var(--panel-2) 100%)`,
        }}
      />
    </div>
  );
}

// Playlist şarkı listesi
function PlaylistView({ yt }: { yt: YouTubeApi }) {
  const [expanded, setExpanded] = useState(false);

  if (yt.playlistItems.length === 0) return null;

  return (
    <div className="pl-view">
      <button
        className="pl-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="pl-toggle-ic">{expanded ? "▾" : "▸"}</span>
        <span className="pl-toggle-lbl">
          Playlist ({yt.playlistItems.length} şarkı)
        </span>
      </button>
      <Collapse open={expanded}>
        <div className="pl-list">
          {yt.playlistItems.map((item, i) => {
            const active = i === yt.playlistIndex;
            return (
              <button
                key={`${item.videoId}-${i}`}
                className={`pl-item${active ? " active" : ""}`}
                onClick={() => yt.playAt(i)}
                title={item.title}
              >
                <span className="pl-item-no">{i + 1}</span>
                <span className="pl-item-title">{item.title}</span>
                {active && <span className="pl-item-eq">♪</span>}
              </button>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

// YouTube kontrolleri (link kutusu + oynatıcı). Hem kart hem floating kullanır.
// favs verilirse çalan şarkının yanında yıldız + Favoriler bölümü görünür.
function YouTubeControls({ yt, favs }: { yt: YouTubeApi; favs?: MusicFavoritesApi }) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);
  const [showFavs, setShowFavs] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (yt.loadInput(input)) {
      setErr(false);
      setInput("");
    } else {
      setErr(true);
    }
  }

  const hasPlaylist = yt.playlistItems.length > 0;

  return (
    <div className="yt-block">
      {/* Favori müzik kütüphanesi */}
      {favs ? (
        <button className="fav-open-btn" onClick={() => setShowFavs(true)}>
          <span className="fav-open-star">★</span> Favoriler
          {favs.favorites.length > 0 ? (
            <span className="fav-open-count">{favs.favorites.length}</span>
          ) : null}
        </button>
      ) : null}

      {/* Arama (API key varsa) */}
      {yt.hasApiKey && (
        <MusicSearch apiKey={yt.apiKey} onPlay={yt.playVideo} />
      )}

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
          {favs && yt.videoId ? (
            <button
              className={`yt-fav-star${favs.isFav(yt.videoId) ? " on" : ""}`}
              onClick={() => favs.toggleFav(yt.videoId, yt.title)}
              title={
                favs.isFav(yt.videoId)
                  ? "Favorilerden çıkar"
                  : "Favorilere ekle (sadece bu şarkı)"
              }
            >
              {favs.isFav(yt.videoId) ? "★" : "☆"}
            </button>
          ) : null}
          <div className="yt-controls">
            {hasPlaylist && (
              <button
                className={`yt-ctrl-btn${yt.shuffled ? " on" : ""}`}
                onClick={yt.toggleShuffle}
                title={yt.shuffled ? "Karışık: Açık" : "Karışık: Kapalı"}
              >
                🔀
              </button>
            )}
            <button onClick={yt.prev} title="Önceki">⏮</button>
            <button className="yt-play" onClick={yt.toggle} title="Oynat/Duraklat">
              {yt.playing ? "❚❚" : "▶"}
            </button>
            <button onClick={yt.next} title="Sonraki">⏭</button>
            {hasPlaylist && (
              <button
                className={`yt-ctrl-btn${yt.repeat === "all" ? " on" : ""}`}
                onClick={yt.toggleRepeat}
                title={yt.repeat === "all" ? "Tekrar: Açık" : "Tekrar: Kapalı"}
              >
                🔁
              </button>
            )}
          </div>
        </div>
      ) : null}

      {yt.hasTarget ? (
        <VolumeSlider value={yt.volume} onChange={yt.setVolume} icon="🎵" />
      ) : null}

      {/* Playlist şarkı listesi */}
      <PlaylistView yt={yt} />

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

      {favs && showFavs ? (
        <MusicFavoritesPopup
          yt={yt}
          favs={favs}
          onClose={() => setShowFavs(false)}
        />
      ) : null}
    </div>
  );
}

// Sağ paneldeki müzik kartı: tek satırlık başlıktan açılır/kapanır.
// Player App kökünde sabit olduğundan kart kapalıyken müzik çalmaya devam eder.
export function MusicCard({
  yt,
  favs,
  current,
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  yt: YouTubeApi;
  favs: MusicFavoritesApi;
  current: AmbientId | null;
  playing: boolean;
  volume: number;
  onToggle: (id: AmbientId) => void;
  onVolume: (v: number) => void;
}) {
  const [open, setOpen] = useState<boolean>(
    () => localStorage.getItem("tn.music-card-open") === "1"
  );
  const anyPlaying = yt.playing || playing;

  function toggleOpen() {
    setOpen((v) => {
      localStorage.setItem("tn.music-card-open", v ? "0" : "1");
      return !v;
    });
  }

  return (
    <div className="side-card side-music">
      <button
        type="button"
        className="side-music-head"
        onClick={toggleOpen}
        title={open ? "Müzik kartını kapat" : "Müzik kartını aç"}
      >
        <span className="side-music-head-title">🎵 Müzik</span>
        {!open && anyPlaying ? (
          <span className="side-music-now">
            ♪ {yt.playing ? yt.title || "çalıyor" : "ortam sesi"}
          </span>
        ) : null}
        <span className="side-music-caret">{open ? "▾" : "▸"}</span>
      </button>
      <Collapse open={open}>
        <div className="side-music-body">
          <YouTubeControls yt={yt} favs={favs} />
          <div className="ambient-mini">
            <div className="ambient-mini-head muted small">Ortam sesleri</div>
            <AmbientButtons
              current={current}
              playing={playing}
              compact
              onToggle={onToggle}
            />
            <VolumeSlider value={volume} onChange={onVolume} icon="🔉" />
          </div>
        </div>
      </Collapse>
    </div>
  );
}

// Diğer sayfalarda sağ-altta küçük kare; tıklayınca müzik + sesler açılır.
export function MusicFloating({
  yt,
  favs,
  current,
  playing,
  collapsed,
  onToggle,
  onToggleCollapse,
}: {
  yt: YouTubeApi;
  favs: MusicFavoritesApi;
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
      <YouTubeControls yt={yt} favs={favs} />
      <AmbientButtons
        current={current}
        playing={playing}
        compact
        onToggle={onToggle}
      />
    </aside>
  );
}

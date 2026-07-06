import { useState } from "react";
import { createPortal } from "react-dom";
import type { YouTubeApi } from "../useYouTube";
import type { MusicFavoritesApi } from "../useMusicFavorites";
import { parseYouTube } from "../useYouTube";
import { fetchVideoTitle } from "../youtubeApi";
import type { YTPlaylistItem } from "../youtubeApi";

// Favori müzikler popup'ı: listeden çal (kuyruk favorilerden devam eder),
// link yapıştırarak yeni favori ekle.
export function MusicFavoritesPopup({
  yt,
  favs,
  onClose,
}: {
  yt: YouTubeApi;
  favs: MusicFavoritesApi;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function addFromLink() {
    const parsed = parseYouTube(input);
    if (!parsed?.videoId) {
      setErr(
        parsed?.listId
          ? "Bu bir playlist linki — favorilere tek şarkı linki ekleyebilirsin."
          : "Link anlaşılamadı. YouTube video linki yapıştır."
      );
      return;
    }
    setAdding(true);
    setErr(null);
    const title = (await fetchVideoTitle(parsed.videoId)) ?? parsed.videoId;
    await favs.add(parsed.videoId, title);
    setAdding(false);
    setInput("");
  }

  // Tıklanan favoriyi çal; kuyruk favori listesinden devam eder
  function playFavorite(index: number) {
    const items: YTPlaylistItem[] = favs.favorites.map((f, i) => ({
      videoId: f.videoId,
      title: f.title,
      thumbnail: `https://img.youtube.com/vi/${f.videoId}/default.jpg`,
      position: i,
    }));
    yt.playList(items, index);
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fav-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">★ Favori Müzikler</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <form
          className="fav-add-row"
          onSubmit={(e) => { e.preventDefault(); void addFromLink(); }}
        >
          <input
            className={`fav-add-input${err ? " err" : ""}`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (err) setErr(null);
            }}
            placeholder="YouTube video linki yapıştır…"
            disabled={adding}
          />
          <button
            className="fav-add-btn"
            type="submit"
            disabled={adding || !input.trim()}
          >
            {adding ? "…" : "Favori ekle"}
          </button>
        </form>
        {err ? <p className="fav-err">{err}</p> : null}

        {favs.favorites.length === 0 ? (
          <p className="fav-empty muted">
            Henüz favori yok. Çalan şarkının yanındaki yıldıza tıkla ya da
            yukarıya bir link yapıştır.
          </p>
        ) : (
          <ul className="fav-list">
            {favs.favorites.map((f, i) => {
              const active = yt.videoId === f.videoId;
              return (
                <li key={f.id} className={`fav-item${active ? " active" : ""}`}>
                  <button
                    className="fav-item-main"
                    onClick={() => playFavorite(i)}
                    title="Çal — kuyruk favorilerden devam eder"
                  >
                    <img
                      className="fav-thumb"
                      src={`https://img.youtube.com/vi/${f.videoId}/default.jpg`}
                      alt=""
                      loading="lazy"
                    />
                    <span className="fav-title">{f.title}</span>
                    {active ? <span className="fav-eq">♪</span> : null}
                  </button>
                  <button
                    className="fav-del"
                    onClick={() => favs.remove(f.id)}
                    title="Favorilerden çıkar"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}

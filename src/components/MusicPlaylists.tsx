import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { YouTubeApi } from "../useYouTube";
import type { MusicPlaylistsApi } from "../useMusicPlaylists";
import { parseYouTube } from "../useYouTube";
import { fetchVideoTitle } from "../youtubeApi";
import type { YTPlaylistItem } from "../youtubeApi";

// Bir şarkının hangi listelerde olduğunu yöneten küçük açılır menü.
// Çalan şarkı yıldızında (bağlamsız) ve liste içinde (currentPlaylistId ile) kullanılır.
// Kırpılmaması için body'ye portal edilir, tetikleyen butona (anchorEl) sabitlenir.
export function SongListMenu({
  favs,
  videoId,
  title,
  currentPlaylistId,
  anchorEl,
  onClose,
}: {
  favs: MusicPlaylistsApi;
  videoId: string;
  title: string;
  currentPlaylistId?: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const inLists = new Set(favs.listsOfVideo(videoId));

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const W = 210;
    const r = anchorEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    const top = Math.min(r.bottom + 4, window.innerHeight - 8);
    setPos({ top, left });
  }, [anchorEl]);

  function toggle(pid: string, on: boolean) {
    if (on) {
      void favs.addToPlaylist(pid, videoId, title);
    } else {
      const it = favs.items.find(
        (x) => x.playlistId === pid && x.videoId === videoId
      );
      if (it) favs.removeItem(it.id);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    const pl = await favs.createPlaylist(n);
    if (pl) await favs.addToPlaylist(pl.id, videoId, title);
    setNewName("");
  }

  if (!pos) return null;

  return createPortal(
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div
        className="slm"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slm-title">Listeler</div>
        <div className="slm-lists">
          {favs.playlists.length === 0 ? (
            <p className="slm-empty muted small">Henüz liste yok.</p>
          ) : (
            favs.playlists.map((p) => {
              const on = inLists.has(p.id);
              return (
                <label key={p.id} className="slm-row">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                  />
                  <span className="slm-name">{p.name}</span>
                </label>
              );
            })
          )}
        </div>
        <form className="slm-new" onSubmit={createAndAdd}>
          <input
            className="slm-new-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni liste…"
          />
          <button className="slm-new-btn" type="submit" disabled={!newName.trim()}>
            +
          </button>
        </form>
        {currentPlaylistId ? (
          <button
            className="slm-remove"
            onClick={() => {
              const it = favs.items.find(
                (x) => x.playlistId === currentPlaylistId && x.videoId === videoId
              );
              if (it) favs.removeItem(it.id);
              onClose();
            }}
          >
            Bu listeden kaldır
          </button>
        ) : null}
      </div>
    </>,
    document.body
  );
}

// Müzik listeleri modalı: listeleri gör/oluştur/adlandır/sil, şarkıları
// listele/çal/taşı/sırala.
export function MusicPlaylistsPopup({
  yt,
  favs,
  onClose,
}: {
  yt: YouTubeApi;
  favs: MusicPlaylistsApi;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => favs.playlists[0]?.id ?? null
  );
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newList, setNewList] = useState("");
  const [renameVal, setRenameVal] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Popup açılınca tazele
  useEffect(() => {
    void favs.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seçili liste geçersizse ilk listeye düş
  useEffect(() => {
    if (!favs.playlists.some((p) => p.id === selectedId)) {
      setSelectedId(favs.playlists[0]?.id ?? null);
    }
  }, [favs.playlists, selectedId]);

  const selected = favs.playlists.find((p) => p.id === selectedId) ?? null;
  const songs = selectedId ? favs.itemsOf(selectedId) : [];

  // Seçili liste değişince yeniden adlandırma kutusunu senkronla
  useEffect(() => {
    setRenameVal(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  async function addFromLink() {
    if (!selectedId) return;
    const parsed = parseYouTube(input);
    if (!parsed?.videoId) {
      setErr(
        parsed?.listId
          ? "Bu bir playlist linki — listeye tek şarkı linki ekleyebilirsin."
          : "Link anlaşılamadı. YouTube video linki yapıştır."
      );
      return;
    }
    setAdding(true);
    setErr(null);
    const t = (await fetchVideoTitle(parsed.videoId)) ?? parsed.videoId;
    await favs.addToPlaylist(selectedId, parsed.videoId, t);
    setAdding(false);
    setInput("");
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    const pl = await favs.createPlaylist(newList);
    if (pl) setSelectedId(pl.id);
    setNewList("");
  }

  function playFrom(index: number) {
    const list: YTPlaylistItem[] = songs.map((s, i) => ({
      videoId: s.videoId,
      title: s.title,
      thumbnail: `https://img.youtube.com/vi/${s.videoId}/default.jpg`,
      position: i,
    }));
    yt.playList(list, index);
  }

  function onDrop(targetId: string) {
    if (!dragId || !selectedId || dragId === targetId) return;
    const ids = songs.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void favs.reorderItems(selectedId, ids);
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fav-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">🎵 Listelerim</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        {/* Liste sekmeleri */}
        <div className="mpl-tabs">
          {favs.playlists.map((p) => (
            <button
              key={p.id}
              className={`mpl-tab${p.id === selectedId ? " active" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              {p.name}
              <span className="mpl-tab-count">{favs.itemsOf(p.id).length}</span>
            </button>
          ))}
          <form className="mpl-newtab" onSubmit={createList}>
            <input
              className="mpl-newtab-input"
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              placeholder="Yeni liste…"
            />
            <button className="mpl-newtab-btn" type="submit" disabled={!newList.trim()}>
              +
            </button>
          </form>
        </div>

        {selected ? (
          <>
            {/* Seçili liste araç çubuğu: yeniden adlandır + sil */}
            <div className="mpl-toolbar">
              <input
                className="mpl-rename"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => {
                  if (renameVal.trim() && renameVal.trim() !== selected.name) {
                    favs.renamePlaylist(selected.id, renameVal);
                  } else {
                    setRenameVal(selected.name);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                title="Liste adını değiştir"
              />
              <button
                className="mpl-del-list"
                onClick={() => {
                  if (confirm(`"${selected.name}" listesi silinsin mi?`)) {
                    favs.deletePlaylist(selected.id);
                  }
                }}
                title="Listeyi sil"
              >
                Sil
              </button>
            </div>

            {/* Link ile ekleme */}
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
              <button className="fav-add-btn" type="submit" disabled={adding || !input.trim()}>
                {adding ? "…" : "Ekle"}
              </button>
            </form>
            {err ? <p className="fav-err">{err}</p> : null}

            {/* Şarkılar */}
            {songs.length === 0 ? (
              <p className="fav-empty muted">
                Bu liste boş. Yukarıya bir link yapıştır ya da çalan şarkının
                yıldızından bu listeye ekle.
              </p>
            ) : (
              <ul className="fav-list">
                {songs.map((s, i) => {
                  const active = yt.videoId === s.videoId;
                  return (
                    <li
                      key={s.id}
                      className={`fav-item${active ? " active" : ""}${
                        overId === s.id && dragId && dragId !== s.id ? " drag-over" : ""
                      }${dragId === s.id ? " dragging" : ""}`}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        if (overId !== s.id) setOverId(s.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDrop(s.id);
                        setDragId(null);
                        setOverId(null);
                      }}
                    >
                      <span
                        className="drag-handle fav-drag"
                        title="Sürükleyerek sırala"
                        draggable
                        onDragStart={(e) => {
                          setDragId(s.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => { setDragId(null); setOverId(null); }}
                      >
                        ⠿
                      </span>
                      <button
                        className="fav-item-main"
                        onClick={() => playFrom(i)}
                        title="Çal"
                      >
                        <img
                          className="fav-thumb"
                          src={`https://img.youtube.com/vi/${s.videoId}/default.jpg`}
                          alt=""
                          loading="lazy"
                        />
                        <span className="fav-title">{s.title}</span>
                        {active ? <span className="fav-eq">♪</span> : null}
                      </button>
                      <div className="fav-star-wrap">
                        <button
                          className="fav-star-btn on"
                          onClick={(e) => {
                            if (menuFor === s.id) {
                              setMenuFor(null);
                              setMenuAnchor(null);
                            } else {
                              setMenuFor(s.id);
                              setMenuAnchor(e.currentTarget);
                            }
                          }}
                          title="Listeler"
                        >
                          ★
                        </button>
                        {menuFor === s.id ? (
                          <SongListMenu
                            favs={favs}
                            videoId={s.videoId}
                            title={s.title}
                            currentPlaylistId={selected.id}
                            anchorEl={menuAnchor}
                            onClose={() => { setMenuFor(null); setMenuAnchor(null); }}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="fav-empty muted">
            Henüz liste yok. Yukarıdan yeni bir liste oluştur.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicPlaylist, MusicPlaylistItem } from "./types";
import {
  loadMusicPlaylists,
  loadMusicPlaylistItems,
  createMusicPlaylist,
  renameMusicPlaylist,
  deleteMusicPlaylist,
  addMusicPlaylistItem,
  removeMusicPlaylistItem,
  updateMusicItemPosition,
} from "./db";

// Çoklu müzik listesi kütüphanesi: Supabase'den listeleri + şarkıları yükler,
// liste/şarkı ekle-çıkar-sırala işlemlerini yapar. App kökünde bir kez çağrılır,
// prop olarak oynatıcı bileşenlerine iner.
export function useMusicPlaylists(userId: string | null) {
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [items, setItems] = useState<MusicPlaylistItem[]>([]);
  // Boş kullanıcıya bir kez varsayılan liste açmak için (tekrar tekrar açmasın)
  const seededRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [pls, its] = await Promise.all([
        loadMusicPlaylists(userId),
        loadMusicPlaylistItems(userId),
      ]);
      setPlaylists(pls);
      setItems(its);
      // Hiç listesi yoksa varsayılan "Favoriler" listesi oluştur (bir kez)
      if (pls.length === 0 && !seededRef.current) {
        seededRef.current = true;
        try {
          const pl = await createMusicPlaylist(userId, "Favoriler", 0);
          setPlaylists([pl]);
        } catch { /* yoksay */ }
      }
    } catch { /* yoksay */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPlaylists([]);
      setItems([]);
      seededRef.current = false;
      return;
    }
    let cancel = false;
    (async () => {
      for (let i = 0; i < 3 && !cancel; i++) {
        try {
          const [pls, its] = await Promise.all([
            loadMusicPlaylists(userId),
            loadMusicPlaylistItems(userId),
          ]);
          if (cancel) return;
          setPlaylists(pls);
          setItems(its);
          if (pls.length === 0 && !seededRef.current) {
            seededRef.current = true;
            try {
              const pl = await createMusicPlaylist(userId, "Favoriler", 0);
              if (!cancel) setPlaylists([pl]);
            } catch { /* yoksay */ }
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        }
      }
    })();
    return () => { cancel = true; };
  }, [userId]);

  // Belirli listenin şarkıları (sıraya göre)
  const itemsOf = useCallback(
    (playlistId: string): MusicPlaylistItem[] =>
      items
        .filter((it) => it.playlistId === playlistId)
        .sort((a, b) => a.position - b.position),
    [items]
  );

  // Bir videonun bulunduğu liste id'leri
  const listsOfVideo = useCallback(
    (videoId: string | null): string[] =>
      videoId ? items.filter((it) => it.videoId === videoId).map((it) => it.playlistId) : [],
    [items]
  );

  // En az bir listede mi? (yıldız dolu/boş için)
  const isFav = useCallback(
    (videoId: string | null): boolean =>
      !!videoId && items.some((it) => it.videoId === videoId),
    [items]
  );

  async function createPlaylist(name: string): Promise<MusicPlaylist | null> {
    if (!userId) return null;
    const n = name.trim();
    if (!n) return null;
    try {
      const pos = playlists.reduce((m, p) => Math.max(m, p.position), -1) + 1;
      const pl = await createMusicPlaylist(userId, n, pos);
      setPlaylists((cur) => [...cur, pl]);
      return pl;
    } catch { return null; }
  }

  async function renamePlaylist(id: string, name: string) {
    const n = name.trim();
    if (!n) return;
    setPlaylists((cur) => cur.map((p) => (p.id === id ? { ...p, name: n } : p)));
    renameMusicPlaylist(id, n).catch(() => {});
  }

  async function deletePlaylist(id: string) {
    setPlaylists((cur) => cur.filter((p) => p.id !== id));
    setItems((cur) => cur.filter((it) => it.playlistId !== id));
    deleteMusicPlaylist(id).catch(() => {});
  }

  // Şarkıyı listeye ekle (zaten varsa dokunma). Eklenen öğeyi döndürür.
  async function addToPlaylist(
    playlistId: string,
    videoId: string,
    title: string
  ): Promise<MusicPlaylistItem | null> {
    if (!userId || !videoId) return null;
    if (items.some((it) => it.playlistId === playlistId && it.videoId === videoId)) {
      return null;
    }
    try {
      const pos =
        items
          .filter((it) => it.playlistId === playlistId)
          .reduce((m, it) => Math.max(m, it.position), -1) + 1;
      const item = await addMusicPlaylistItem(userId, playlistId, videoId, title || videoId, pos);
      setItems((cur) =>
        cur.some((x) => x.id === item.id) ? cur : [...cur, item]
      );
      return item;
    } catch { return null; }
  }

  function removeItem(itemId: string) {
    setItems((cur) => cur.filter((it) => it.id !== itemId));
    removeMusicPlaylistItem(itemId).catch(() => {});
  }

  // Liste içindeki sırayı yeniden düzenle (verilen id sırasına göre)
  async function reorderItems(playlistId: string, orderedIds: string[]) {
    setItems((cur) =>
      cur.map((it) => {
        if (it.playlistId !== playlistId) return it;
        const idx = orderedIds.indexOf(it.id);
        return idx >= 0 ? { ...it, position: idx } : it;
      })
    );
    orderedIds.forEach((id, idx) => {
      updateMusicItemPosition(id, idx).catch(() => {});
    });
  }

  return {
    playlists,
    items,
    reload,
    itemsOf,
    listsOfVideo,
    isFav,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeItem,
    reorderItems,
  };
}

export type MusicPlaylistsApi = ReturnType<typeof useMusicPlaylists>;

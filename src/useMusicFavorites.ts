import { useEffect, useState } from "react";
import type { MusicFavorite } from "./types";
import {
  loadMusicFavorites,
  addMusicFavorite,
  deleteMusicFavorite,
} from "./db";

// Favori müzik kütüphanesi: Supabase'den yükler, ekleme/silme yapar.
// App kökünde bir kez çağrılır, prop olarak oynatıcı bileşenlerine iner.
export function useMusicFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<MusicFavorite[]>([]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    let cancel = false;
    loadMusicFavorites(userId)
      .then((f) => { if (!cancel) setFavorites(f); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [userId]);

  async function add(videoId: string, title: string) {
    if (!userId || !videoId) return;
    try {
      const f = await addMusicFavorite(userId, videoId, title || videoId);
      setFavorites((cur) => [f, ...cur.filter((x) => x.videoId !== f.videoId)]);
    } catch { /* yoksay */ }
  }

  function remove(id: string) {
    setFavorites((cur) => cur.filter((f) => f.id !== id));
    deleteMusicFavorite(id).catch(() => {});
  }

  function isFav(videoId: string | null): boolean {
    return !!videoId && favorites.some((f) => f.videoId === videoId);
  }

  // Çalan videoyu favorilere ekle/çıkar (yıldız butonu)
  function toggleFav(videoId: string | null, title: string) {
    if (!videoId) return;
    const existing = favorites.find((f) => f.videoId === videoId);
    if (existing) remove(existing.id);
    else void add(videoId, title);
  }

  return { favorites, add, remove, isFav, toggleFav };
}

export type MusicFavoritesApi = ReturnType<typeof useMusicFavorites>;

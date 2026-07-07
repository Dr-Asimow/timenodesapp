import { useCallback, useEffect, useState } from "react";
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

  // Listeyi tazele (popup açılınca da çağrılır — başarısız ilk yüklemeyi telafi eder)
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setFavorites(await loadMusicFavorites(userId));
    } catch { /* yoksay */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    let cancel = false;
    // İlk yükleme geçici bir hataya denk gelirse (ağ/token) artan arayla tekrar dene
    (async () => {
      for (let i = 0; i < 3 && !cancel; i++) {
        try {
          const f = await loadMusicFavorites(userId);
          if (!cancel) setFavorites(f);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        }
      }
    })();
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

  return { favorites, reload, add, remove, isFav, toggleFav };
}

export type MusicFavoritesApi = ReturnType<typeof useMusicFavorites>;

import { useEffect, useRef, useState, useCallback } from "react";
import { getPlaylistItems, type YTPlaylistItem } from "./youtubeApi";

// YouTube IFrame Player API — basit tipler
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const LS_KEY = "timenodes.music.last";
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

export type YTTarget = { videoId?: string; listId?: string };

// YouTube / YouTube Music linkinden video ve/veya playlist id çıkar
export function parseYouTube(input: string): YTTarget | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1);
      if (id) return { videoId: id };
    }
    const v = u.searchParams.get("v");
    const list = u.searchParams.get("list");
    if (v) return { videoId: v, listId: list ?? undefined };
    if (list) return { listId: list };
  } catch {
    // URL değil → ham video id (11 karakter) olabilir
    if (/^[\w-]{11}$/.test(s)) return { videoId: s };
  }
  return null;
}

// Fisher-Yates shuffle (orijinali değiştirmez)
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type RepeatMode = "off" | "all";

// YouTube oynatıcı motoru. iframe'i `holderRef`'e bağlar; bu div App kökünde
// SABİT mount edilmeli (taşınırsa/unmount olursa iframe yeniden yüklenir → ses
// kesilir). Kontroller (load/toggle/next/prev) ve durum her yerden kullanılır.
export function useYouTube() {
  const playerRef = useRef<any>(null);
  const targetRef = useRef<YTTarget | null>(null);
  const [target, setTarget] = useState<YTTarget | null>(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      return s ? (JSON.parse(s) as YTTarget) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState<string | null>(
    () => target?.videoId ?? null
  );
  const [volume, setVol] = useState<number>(() => {
    const s = localStorage.getItem("timenodes.music.vol");
    const n = s != null ? Number(s) : 1;
    return isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
  });
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  targetRef.current = target;

  // Playlist state
  const [playlistItems, setPlaylistItems] = useState<YTPlaylistItem[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const [shuffled, setShuffled] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const playOrderRef = useRef<number[]>([]);
  const playlistIndexRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>("off");
  playOrderRef.current = playOrder;
  playlistIndexRef.current = playlistIndex;
  repeatRef.current = repeat;
  const playlistItemsRef = useRef<YTPlaylistItem[]>([]);
  playlistItemsRef.current = playlistItems;

  // YouTube IFrame API script'ini bir kez yükle
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setReady(true);
      return;
    }
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setReady(true);
    };
    const id = setInterval(() => {
      if (window.YT && window.YT.Player) {
        setReady(true);
        clearInterval(id);
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Playlist bitti → sonraki şarkı veya repeat
  const handleVideoEnd = useCallback(() => {
    const order = playOrderRef.current;
    const idx = playlistIndexRef.current;
    if (order.length === 0) return;

    const posInOrder = order.indexOf(idx);
    if (posInOrder < order.length - 1) {
      const nextIdx = order[posInOrder + 1];
      setPlaylistIndex(nextIdx);
      const item = playlistItemsRef.current[nextIdx];
      if (item && playerRef.current) {
        playerRef.current.loadVideoById(item.videoId);
      }
    } else if (repeatRef.current === "all") {
      const firstIdx = order[0];
      setPlaylistIndex(firstIdx);
      const item = playlistItemsRef.current[firstIdx];
      if (item && playerRef.current) {
        playerRef.current.loadVideoById(item.videoId);
      }
    }
  }, []);

  // API hazır olunca player'ı oluştur (bir kez). iframe'i React'in DIŞINDA,
  // doğrudan body'ye eklenen gizli bir host'ta tutarız; böylece App yeniden
  // render olunca React iframe'i kaldırmaz → müzik kesilmez.
  useEffect(() => {
    if (!ready || playerRef.current) return;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(host);
    const mount = document.createElement("div");
    host.appendChild(mount);
    playerRef.current = new window.YT.Player(mount, {
      width: "100%",
      height: "168",
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
          try { playerRef.current?.setVolume?.(Math.round(volumeRef.current * 100)); } catch { /* yoksay */ }
          if (targetRef.current) load(targetRef.current);
        },
        onStateChange: (e: any) => {
          setPlaying(e.data === window.YT.PlayerState.PLAYING);
          if (e.data === window.YT.PlayerState.ENDED) {
            handleVideoEnd();
          }
          try {
            const d = playerRef.current?.getVideoData?.();
            if (d?.title) setTitle(d.title);
            if (d?.video_id) {
              setVideoId(d.video_id);
              // Playlist'te çalan videoyu bul ve index'i güncelle
              const items = playlistItemsRef.current;
              if (items.length > 0) {
                const foundIdx = items.findIndex(
                  (it) => it.videoId === d.video_id
                );
                if (foundIdx >= 0) setPlaylistIndex(foundIdx);
              }
            }
          } catch {
            /* yoksay */
          }
        },
      },
    });
    return () => {
      try { playerRef.current?.destroy?.(); } catch { /* yoksay */ }
      playerRef.current = null;
      host.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function load(t: YTTarget) {
    const p = playerRef.current;
    if (!p) return;
    if (t.listId) {
      p.loadPlaylist({ list: t.listId, listType: "playlist" });
      // API key varsa playlist detaylarını çek
      if (API_KEY) {
        getPlaylistItems(t.listId, API_KEY).then((items) => {
          setPlaylistItems(items);
          const order = items.map((_, i) => i);
          setPlayOrder(order);
          setPlaylistIndex(0);
          setShuffled(false);
        }).catch(() => {
          /* API hatası, playlist detaysız devam */
        });
      }
    } else if (t.videoId) {
      p.loadVideoById(t.videoId);
      setPlaylistItems([]);
      setPlayOrder([]);
      setPlaylistIndex(-1);
    }
  }

  // Link/giriş yükle. Geçerliyse true döner.
  function loadInput(input: string): boolean {
    const parsed = parseYouTube(input);
    if (!parsed) return false;
    setTarget(parsed);
    if (parsed.videoId) setVideoId(parsed.videoId);
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    load(parsed);
    return true;
  }

  // Tek video çal (arama sonucundan)
  function playVideo(vid: string) {
    const p = playerRef.current;
    if (!p) return;
    setTarget({ videoId: vid });
    setVideoId(vid);
    localStorage.setItem(LS_KEY, JSON.stringify({ videoId: vid }));
    p.loadVideoById(vid);
    setPlaylistItems([]);
    setPlayOrder([]);
    setPlaylistIndex(-1);
  }

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  };

  const next = () => {
    const order = playOrderRef.current;
    const idx = playlistIndexRef.current;
    if (order.length > 0) {
      const posInOrder = order.indexOf(idx);
      const nextPos = posInOrder < order.length - 1 ? posInOrder + 1 : 0;
      const nextIdx = order[nextPos];
      setPlaylistIndex(nextIdx);
      const item = playlistItemsRef.current[nextIdx];
      if (item && playerRef.current) {
        playerRef.current.loadVideoById(item.videoId);
      }
    } else {
      playerRef.current?.nextVideo?.();
    }
  };

  const prev = () => {
    const order = playOrderRef.current;
    const idx = playlistIndexRef.current;
    if (order.length > 0) {
      const posInOrder = order.indexOf(idx);
      const prevPos = posInOrder > 0 ? posInOrder - 1 : order.length - 1;
      const prevIdx = order[prevPos];
      setPlaylistIndex(prevIdx);
      const item = playlistItemsRef.current[prevIdx];
      if (item && playerRef.current) {
        playerRef.current.loadVideoById(item.videoId);
      }
    } else {
      playerRef.current?.previousVideo?.();
    }
  };

  // Playlist'te belirli şarkıyı çal
  const playAt = (index: number) => {
    const item = playlistItemsRef.current[index];
    if (!item || !playerRef.current) return;
    setPlaylistIndex(index);
    playerRef.current.loadVideoById(item.videoId);
  };

  const toggleShuffle = () => {
    const items = playlistItemsRef.current;
    if (items.length === 0) return;
    if (shuffled) {
      const order = items.map((_, i) => i);
      setPlayOrder(order);
      setShuffled(false);
    } else {
      const currentIdx = playlistIndexRef.current;
      const rest = items
        .map((_, i) => i)
        .filter((i) => i !== currentIdx);
      const shuffledRest = shuffleArray(rest);
      setPlayOrder(
        currentIdx >= 0 ? [currentIdx, ...shuffledRest] : shuffledRest
      );
      setShuffled(true);
    }
  };

  const toggleRepeat = () => {
    setRepeat((r) => (r === "off" ? "all" : "off"));
  };

  const setVolume = (v: number) => {
    const cl = Math.max(0, Math.min(1, v));
    setVol(cl);
    localStorage.setItem("timenodes.music.vol", String(cl));
    try { playerRef.current?.setVolume?.(Math.round(cl * 100)); } catch { /* yoksay */ }
  };

  return {
    hasTarget: target != null,
    playing,
    title,
    videoId,
    volume,
    loadInput,
    playVideo,
    toggle,
    next,
    prev,
    setVolume,
    // Playlist
    playlistItems,
    playlistIndex,
    shuffled,
    repeat,
    playAt,
    toggleShuffle,
    toggleRepeat,
    // API key varlığı
    hasApiKey: !!API_KEY,
    apiKey: API_KEY ?? "",
  };
}

export type YouTubeApi = ReturnType<typeof useYouTube>;

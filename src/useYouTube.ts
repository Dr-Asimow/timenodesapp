import { useEffect, useRef, useState } from "react";

// YouTube IFrame Player API — basit tipler
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const LS_KEY = "timenodes.music.last";

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
          try {
            const d = playerRef.current?.getVideoData?.();
            if (d?.title) setTitle(d.title);
            if (d?.video_id) setVideoId(d.video_id);
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
    } else if (t.videoId) {
      p.loadVideoById(t.videoId);
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

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  };
  const next = () => playerRef.current?.nextVideo?.();
  const prev = () => playerRef.current?.previousVideo?.();
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
    toggle,
    next,
    prev,
    setVolume,
  };
}

export type YouTubeApi = ReturnType<typeof useYouTube>;

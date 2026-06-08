import { useEffect, useRef, useState } from "react";

// YouTube IFrame Player API — basit tipler
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const LS_KEY = "timenodes.music.last";

type Target = { videoId?: string; listId?: string };

// YouTube / YouTube Music linkinden video ve/veya playlist id çıkar
function parseYouTube(input: string): Target | null {
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

export function MusicPlayer() {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const targetRef = useRef<Target | null>(null);
  const [target, setTarget] = useState<Target | null>(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      return s ? (JSON.parse(s) as Target) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState<string | null>(
    () => target?.videoId ?? null
  );
  const [err, setErr] = useState(false);
  // Açılışta müzik yoksa küçük (collapsed) başla
  const [collapsed, setCollapsed] = useState(() => !target);

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

  // API hazır olunca player'ı oluştur (bir kez)
  useEffect(() => {
    if (!ready || !holderRef.current || playerRef.current) return;
    playerRef.current = new window.YT.Player(holderRef.current, {
      width: "100%",
      height: "168",
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
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
  }, [ready]);

  function load(t: Target) {
    const p = playerRef.current;
    if (!p) return;
    if (t.listId) {
      p.loadPlaylist({ list: t.listId, listType: "playlist" });
    } else if (t.videoId) {
      p.loadVideoById(t.videoId);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseYouTube(input);
    if (!parsed) {
      setErr(true);
      return;
    }
    setErr(false);
    setTarget(parsed);
    if (parsed.videoId) setVideoId(parsed.videoId);
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    load(parsed);
    setInput("");
  }

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  };
  const next = () => playerRef.current?.nextVideo?.();
  const prev = () => playerRef.current?.previousVideo?.();

  return (
    <aside className={`music-player floating ${collapsed ? "collapsed" : ""}`}>
      <div className="music-head">
        <span className="music-ic">♪</span>
        <span className="music-title-lbl">
          {collapsed ? title || "Müzik" : "Müzik"}
        </span>
        {collapsed && target ? (
          <button
            className="music-mini-play"
            onClick={toggle}
            title="Oynat/Duraklat"
          >
            {playing ? "❚❚" : "▶"}
          </button>
        ) : null}
        <button
          className="music-min"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Aç" : "Küçült"}
        >
          {collapsed ? "▢" : "—"}
        </button>
      </div>

      {/* Gizli YT iframe — DAİMA mount (collapsed olsa da ses çalsın), off-screen */}
      <div className="music-yt-hidden" aria-hidden="true">
        <div ref={holderRef} />
      </div>

      {!collapsed ? (
        <>
          {target ? (
            <>
              <div className="music-row">
                <div className="music-thumb">
                  {videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt=""
                    />
                  ) : null}
                </div>
                <div className="music-now" title={title}>
                  {title || "Yükleniyor…"}
                </div>
              </div>
              <div className="music-controls">
                <button onClick={prev} title="Önceki">
                  ⏮
                </button>
                <button
                  className="music-play"
                  onClick={toggle}
                  title="Oynat/Duraklat"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
                <button onClick={next} title="Sonraki">
                  ⏭
                </button>
              </div>
            </>
          ) : (
            <div className="music-empty muted small">
              Aşağıya bir YouTube / YouTube Music linki yapıştır
            </div>
          )}

          <form className="music-form" onSubmit={submit}>
            <input
              className={`music-input ${err ? "err" : ""}`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (err) setErr(false);
              }}
              placeholder="YouTube linki / playlist…"
            />
            <button className="music-add" type="submit" title="Yükle">
              +
            </button>
          </form>
          {err ? (
            <span className="music-err muted small">
              Geçerli bir YouTube linki bulunamadı.
            </span>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}

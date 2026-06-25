import { useEffect, useRef, useState } from "react";
import { searchVideos, type YTSearchResult } from "../youtubeApi";

export function MusicSearch({
  apiKey,
  onPlay,
}: {
  apiKey: string;
  onPlay: (videoId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YTSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResult, setNoResult] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    setNoResult(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = val.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchVideos(q, apiKey);
        setResults(r);
        setNoResult(r.length === 0);
        setOpen(true);
      } catch {
        setResults([]);
        setNoResult(true);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function pick(videoId: string) {
    onPlay(videoId);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="ms-wrap" ref={wrapRef}>
      <div className="ms-input-row">
        <span className="ms-icon">🔍</span>
        <input
          className="ms-input"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Şarkı ara…"
        />
        {loading && <span className="ms-spin">⟳</span>}
      </div>
      {open && (
        <div className="ms-dropdown">
          {noResult ? (
            <div className="ms-empty">Sonuç bulunamadı</div>
          ) : (
            results.map((r) => (
              <button
                key={r.videoId}
                className="ms-item"
                onClick={() => pick(r.videoId)}
              >
                <img
                  className="ms-thumb"
                  src={r.thumbnail}
                  alt=""
                />
                <div className="ms-info">
                  <span className="ms-title">{r.title}</span>
                  <span className="ms-channel">{r.channelTitle}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

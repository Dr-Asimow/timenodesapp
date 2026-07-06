// YouTube Data API v3 — arama ve playlist içerik sorgulama

const BASE = "https://www.googleapis.com/youtube/v3";

export interface YTSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export interface YTPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
  position: number;
}

// --- Önbellek (sessionStorage, 5dk TTL) ---

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* sessionStorage dolu, yoksay */
  }
}

// Video başlığını oEmbed ile çek (API key gerektirmez). Bulunamazsa null.
export async function fetchVideoTitle(videoId: string): Promise<string | null> {
  try {
    const url = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
    const res = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.title === "string" ? json.title : null;
  } catch {
    return null;
  }
}

// --- API Fonksiyonları ---

export async function searchVideos(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<YTSearchResult[]> {
  const cacheKey = `yt.search.${query}.${maxResults}`;
  const cached = cacheGet<YTSearchResult[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    q: query,
    maxResults: String(maxResults),
    key: apiKey,
  });

  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`YouTube API: ${res.status}`);
  const json = await res.json();

  const results: YTSearchResult[] = (json.items ?? []).map((it: any) => ({
    videoId: it.id?.videoId ?? "",
    title: it.snippet?.title ?? "",
    thumbnail: it.snippet?.thumbnails?.default?.url ?? "",
    channelTitle: it.snippet?.channelTitle ?? "",
  }));

  cacheSet(cacheKey, results);
  return results;
}

export async function getPlaylistItems(
  playlistId: string,
  apiKey: string,
  maxResults = 50,
): Promise<YTPlaylistItem[]> {
  const cacheKey = `yt.pl.${playlistId}`;
  const cached = cacheGet<YTPlaylistItem[]>(cacheKey);
  if (cached) return cached;

  const all: YTPlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(maxResults - all.length, 50)),
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${BASE}/playlistItems?${params}`);
    if (!res.ok) throw new Error(`YouTube API: ${res.status}`);
    const json = await res.json();

    for (const it of json.items ?? []) {
      const vid = it.snippet?.resourceId?.videoId;
      if (!vid) continue;
      all.push({
        videoId: vid,
        title: it.snippet?.title ?? "",
        thumbnail: it.snippet?.thumbnails?.default?.url ?? "",
        position: it.snippet?.position ?? all.length,
      });
    }

    pageToken = json.nextPageToken;
  } while (pageToken && all.length < maxResults);

  cacheSet(cacheKey, all);
  return all;
}

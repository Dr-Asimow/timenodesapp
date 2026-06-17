// Ambient ses motoru — telifsiz gerçek kayıt loop'larını çalar (public/sounds).
// Ses bir HTMLAudioElement'te (JS nesnesi) yaşar; DOM'a bağlı değildir → sayfa
// değişse de (UI unmount olsa) ses kesilmez.
//
// Ses kaynakları (bkz. public/sounds/CREDITS.md):
//   wind  → CC0 (kamu malı)        birds → kamu malı
//   fire  → CC-BY 3.0              rain  → CC-BY-SA 3.0

export type AmbientId = "rain" | "fire" | "wind" | "birds";

export const SOUNDS: { id: AmbientId; label: string; icon: string }[] = [
  { id: "rain", label: "Yağmur", icon: "🌧️" },
  { id: "fire", label: "Şömine", icon: "🔥" },
  { id: "wind", label: "Rüzgâr", icon: "🌬️" },
  { id: "birds", label: "Kuşlar", icon: "🐦" },
];

let audio: HTMLAudioElement | null = null;
let volume = 0.6;

export function stopAmbient() {
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
}

export function playAmbient(id: AmbientId) {
  stopAmbient();
  audio = new Audio(`${import.meta.env.BASE_URL}sounds/${id}.ogg`);
  audio.loop = true;
  audio.volume = volume;
  audio.play().catch(() => {
    /* tarayıcı otomatik oynatmayı engellerse sessizce geç */
  });
}

export function setAmbientVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
}

export function getAmbientVolume() {
  return volume;
}

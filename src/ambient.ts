// Ambient ses motoru — Web Audio API ile sesleri matematiksel üretir.
// Dosya/internet gerektirmez, offline çalışır, telif sorunu yoktur.
// Ses AudioContext içinde (JS'te) yaşar; DOM'a bağlı değildir → sayfa
// değişse de (UI unmount olsa da) ses kesilmez.

export type AmbientId = "white" | "brown" | "campfire" | "fortress";

export const SOUNDS: { id: AmbientId; label: string; icon: string }[] = [
  { id: "white", label: "White noise", icon: "🌫️" },
  { id: "brown", label: "Brown noise", icon: "🟤" },
  { id: "campfire", label: "Şömine", icon: "🔥" },
  { id: "fortress", label: "Rüzgâr", icon: "🌬️" },
];

// --- Dahili durum (modül seviyesinde tekil) ---
let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let filter: BiquadFilterNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let master: GainNode | null = null;
let volume = 0.6;

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext || (window as unknown as any).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// İstenen tipte 2 saniyelik (loop'lanabilir) gürültü tamponu üretir
function makeNoiseBuffer(
  c: AudioContext,
  type: "white" | "brown" | "pink"
): AudioBuffer {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === "brown") {
    // Kahverengi gürültü: rastgele değerin sızıntılı toplamı (derin/yumuşak)
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    // Pembe gürültü (Paul Kellet yaklaşımı) — rüzgâr için temel
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

export function stopAmbient() {
  try { source?.stop(); } catch { /* zaten durmuş */ }
  try { lfo?.stop(); } catch { /* yok */ }
  source?.disconnect();
  filter?.disconnect();
  lfo?.disconnect();
  lfoGain?.disconnect();
  master?.disconnect();
  source = null;
  filter = null;
  lfo = null;
  lfoGain = null;
  master = null;
}

export function playAmbient(id: AmbientId) {
  const c = ensureCtx();
  stopAmbient();

  master = c.createGain();
  master.gain.value = volume;

  source = c.createBufferSource();
  source.loop = true;

  if (id === "white") {
    source.buffer = makeNoiseBuffer(c, "white");
    source.connect(master);
  } else if (id === "brown") {
    source.buffer = makeNoiseBuffer(c, "brown");
    source.connect(master);
  } else if (id === "campfire") {
    // Şömine: alçak geçiren kahverengi gürültü + yavaş alev titremesi
    source.buffer = makeNoiseBuffer(c, "brown");
    filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    source.connect(filter);
    filter.connect(master);
    lfo = c.createOscillator();
    lfo.frequency.value = 0.4; // alev titremesi hızı
    lfoGain = c.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain); // ses seviyesini hafifçe modüle et
    lfo.start();
  } else {
    // Rüzgâr: bant geçiren pembe gürültü + yavaş frekans süpürme (uğultu)
    source.buffer = makeNoiseBuffer(c, "pink");
    filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    source.connect(filter);
    filter.connect(master);
    lfo = c.createOscillator();
    lfo.frequency.value = 0.1; // rüzgârın yavaş gelip gitmesi
    lfoGain = c.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency); // bant merkezini süpür
    lfo.start();
  }

  master.connect(c.destination);
  source.start();
}

export function setAmbientVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

export function getAmbientVolume() {
  return volume;
}

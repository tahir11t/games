// Synthesized SFX + a small step sequencer playing original tracks in Arabic
// maqam flavours (no audio assets, so nothing to license).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxOn = true;
let musicOn = true;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.75 : 0;
    // light echo on the music for a sense of space
    const delay = ctx.createDelay(); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    musicBus.connect(master); musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSound(on: boolean) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; }
export function setMusicOn(on: boolean) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.75 : 0; if (!on) stopMusic(); }

const last: Record<string, number> = {};

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, when = 0, bus = sfxBus) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t0 = c.currentTime + when;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, freq = 800, when = 0, bus = sfxBus, type: BiquadFilterType = 'lowpass') {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = c.createGain();
  const t0 = c.currentTime + when;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(bus!);
  s.start(t0, Math.random() * 0.5, dur + 0.05);
}

export function sfx(name: 'click' | 'hit' | 'swing' | 'arrow' | 'throw' | 'boom' | 'collapse' | 'volley' | 'win' | 'lose' | 'coin' | 'rank') {
  if (!sfxOn) return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < (name === 'hit' ? 60 : 30)) return;
  last[name] = now;
  try {
    switch (name) {
      case 'click': tone(660, 0.06, 'triangle', 0.15); break;
      case 'coin': tone(988, 0.08, 'square', 0.06); tone(1318, 0.12, 'square', 0.06, 0, 0.07); break;
      case 'rank': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, 0, i * 0.06)); break;
      case 'hit': noise(0.08, 0.25, 1800); tone(140, 0.08, 'square', 0.08, -60); break;
      case 'swing': noise(0.1, 0.12, 3000); break;
      case 'arrow': noise(0.12, 0.08, 4000); tone(900, 0.1, 'sine', 0.03, -400); break;
      case 'throw': tone(120, 0.25, 'sawtooth', 0.08, -50); break;
      case 'boom': noise(0.5, 0.5, 400); tone(70, 0.4, 'sine', 0.4, -40); break;
      case 'collapse': noise(1.4, 0.6, 300); tone(55, 1.2, 'sine', 0.5, -25); break;
      case 'volley': [0, 0.08, 0.16, 0.24].forEach((w) => noise(0.15, 0.12, 4500, w)); tone(220, 0.4, 'sawtooth', 0.12, 220); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 0, i * 0.12)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, 0, i * 0.16)); break;
    }
  } catch { /* audio unavailable */ }
}

// ---------------- Music ----------------
// Modern, original tracks synthesized live (no audio files): punchy drums,
// 808s, side-chained supersaw chords, plucks and strings. Notes are scheduled
// on the audio clock with a look-ahead so timing stays tight.
type Deg = number | null;
type ChordInst = 'supersaw' | 'rhodes' | 'strings' | 'pad';
type LeadInst = 'pluck' | 'bell' | 'saw' | 'brass';
type BassStyle = 'offbeat' | 'root8' | '808' | 'arp';
interface Drums { kick: string; snare: string; hat: string; open?: string; clap?: string; }
interface Track { id: string; bpm: number; root: number; scale: number[]; chords: number[][]; chordInst: ChordInst; lead: LeadInst; bass: BassStyle; drums: Drums; melodyA: Deg[]; melodyB: Deg[]; order: string[]; swing?: number; crackle?: boolean; strings16?: boolean }

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG_DOM = [0, 1, 4, 5, 7, 8, 10]; // the "Arabian" colour, used in a modern way
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const _ = null;

export const TRACKS: Track[] = [
  { id: 'rise', bpm: 92, root: 73.42, scale: MINOR, chordInst: 'strings', lead: 'brass', bass: 'root8', strings16: true,
    chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], order: ['intro', 'A', 'B', 'break', 'A', 'B'],
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.' },
    melodyA: [7, _, _, _, 9, _, 10, _, 11, _, _, _, 9, _, _, _, 12, _, _, _, 11, _, 10, _, 9, _, _, _, _, _, _, _],
    melodyB: [14, _, _, _, 12, _, 11, _, 12, _, _, _, 9, _, 10, _, 11, _, _, _, 10, _, 9, _, 7, _, _, _, _, _, _, _] },
  { id: 'neon', bpm: 124, root: 110, scale: PHRYG_DOM, chordInst: 'supersaw', lead: 'pluck', bass: 'offbeat',
    chords: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [4, 6, 1]], order: ['intro', 'A', 'B', 'A', 'break', 'B'],
    drums: { kick: 'x...x...x...x...', snare: '................', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..x...x...x...x.' },
    melodyA: [7, 8, 11, 8, 7, _, 4, 5, 7, _, 8, 7, 5, 4, 2, _, 7, 8, 11, 12, 11, 8, 7, _, 5, 4, 5, 7, 4, _, _, _],
    melodyB: [14, _, 12, 11, 12, _, 11, 8, 11, _, 8, 7, 8, _, 5, 7, 7, 8, 7, 5, 4, _, 5, 4, 1, 2, 4, 5, 0, _, _, _] },
  { id: 'trap', bpm: 140, root: 87.31, scale: MINOR, chordInst: 'pad', lead: 'bell', bass: '808',
    chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], order: ['intro', 'A', 'B', 'A', 'B'],
    drums: { kick: 'x......x..x.....', snare: '........x.......', hat: 'xxx.x.xxx.x.xxxx', open: '..............x.' },
    melodyA: [7, _, 10, _, 9, _, 7, _, 5, _, 7, _, 3, _, _, _, 7, _, 10, _, 12, _, 10, 9, 7, _, _, _, _, _, _, _],
    melodyB: [12, _, 10, _, 12, 14, 12, _, 10, _, 9, _, 7, _, _, _, 5, _, 7, _, 9, _, 7, 5, 3, _, 2, _, 0, _, _, _] },
  { id: 'lofi', bpm: 78, root: 130.81, scale: DORIAN, chordInst: 'rhodes', lead: 'bell', bass: 'root8', swing: 0.28, crackle: true,
    chords: [[0, 2, 4, 6], [3, 5, 0, 2], [1, 3, 5, 0], [4, 6, 1, 3]], order: ['A', 'B', 'A', 'intro'],
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    melodyA: [_, _, 9, _, 11, _, 9, 7, _, _, _, _, 6, _, 7, _, _, _, 11, _, 12, _, 11, 9, 7, _, _, _, _, _, _, _],
    melodyB: [_, _, 14, _, 13, _, 11, _, 9, _, _, _, 11, _, 9, 7, _, _, 9, _, 8, _, 7, _, 4, _, _, _, _, _, _, _] },
  { id: 'synthwave', bpm: 108, root: 98, scale: MINOR, chordInst: 'pad', lead: 'saw', bass: 'arp',
    chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], order: ['intro', 'A', 'B', 'break', 'A', 'B'],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    melodyA: [7, _, _, 9, 10, _, 9, _, 7, _, _, _, 5, _, 4, _, 7, _, _, 9, 10, _, 12, _, 11, _, _, _, _, _, _, _],
    melodyB: [12, _, 11, _, 10, _, 9, _, 10, _, 9, _, 7, _, _, _, 9, _, 10, _, 11, _, 12, _, 14, _, _, _, _, _, _, _] },
  { id: 'anthem', bpm: 128, root: 116.54, scale: MAJOR, chordInst: 'supersaw', lead: 'saw', bass: 'offbeat',
    chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], order: ['intro', 'A', 'B', 'A', 'break', 'B'],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..x...x...x...x.' },
    melodyA: [7, _, 9, _, 11, _, 9, 7, 8, _, 9, _, 11, _, _, _, 11, _, 12, _, 14, _, 12, 11, 9, _, 11, _, 7, _, _, _],
    melodyB: [14, _, _, 12, 14, _, 15, _, 14, _, 12, _, 11, _, _, _, 12, _, 11, _, 9, _, 11, _, 7, _, _, _, _, _, _, _] },
];

function note(track: Track, deg: number, octave = 0) {
  const n = track.scale.length;
  const o = Math.floor(deg / n) + octave;
  const semis = track.scale[((deg % n) + n) % n] + o * 12;
  return track.root * Math.pow(2, semis / 12);
}

let reverb: ConvolverNode | null = null;
let duck: GainNode | null = null; // side-chained bus (chords + bass pump with the kick)
let satCurve: Float32Array | null = null;
function buses() {
  const c = ac();
  if (!reverb) {
    reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.4);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.22;
    reverb.connect(wet).connect(master!);
    duck = c.createGain(); duck.gain.value = 1; duck.connect(musicBus!);
    satCurve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; satCurve[i] = Math.tanh(x * 2.5); }
  }
  return { out: musicBus!, rev: reverb!, duck: duck! };
}
function osc(type: OscillatorType, freq: number, at: number, end: number) { const o = ac().createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, at); o.start(at); o.stop(end); return o; }
function gainEnv(at: number, a: number, peak: number, hold: number, r: number) {
  const g = ac().createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + a); g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + r); return g;
}

function kick(at: number) {
  const { out, duck: d } = buses();
  const o = osc('sine', 160, at, at + 0.4); o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  const g = gainEnv(at, 0.002, 0.9, 0.02, 0.3); o.connect(g).connect(out);
  noise(0.012, 0.25, 3000, Math.max(0, at - ac().currentTime), musicBus, 'highpass'); // click
  // pump the side-chained bus
  d.gain.cancelScheduledValues(at); d.gain.setValueAtTime(0.35, at); d.gain.linearRampToValueAtTime(1, at + 0.22);
}
function snare(at: number) {
  const { out, rev } = buses(); const w = Math.max(0, at - ac().currentTime);
  noise(0.18, 0.32, 1800, w, musicBus, 'bandpass'); noise(0.1, 0.18, 6000, w, musicBus, 'highpass');
  const o = osc('triangle', 190, at, at + 0.12); o.frequency.exponentialRampToValueAtTime(120, at + 0.1); const g = gainEnv(at, 0.001, 0.25, 0, 0.1); o.connect(g); g.connect(out); g.connect(rev);
}
function clap(at: number) { const w = Math.max(0, at - ac().currentTime); for (const dt of [0, 0.012, 0.024]) noise(0.09, 0.2, 1400, w + dt, musicBus, 'bandpass'); }
function hat(at: number, open: boolean) { noise(open ? 0.22 : 0.035, open ? 0.08 : 0.07, 8500, Math.max(0, at - ac().currentTime), musicBus, 'highpass'); }

function chord(inst: ChordInst, freqs: number[], dur: number, at: number) {
  const c = ac(); const { duck: d, rev } = buses();
  const f = c.createBiquadFilter(); f.type = 'lowpass';
  const g = c.createGain();
  if (inst === 'supersaw') {
    f.frequency.setValueAtTime(2600, at); f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.045, at + 0.02); g.gain.setValueAtTime(0.04, at + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.2);
    for (const fr of freqs) for (const det of [-0.012, -0.005, 0, 0.005, 0.012]) { const o = osc('sawtooth', fr * (1 + det), at, at + dur + 0.3); o.connect(f); }
  } else if (inst === 'rhodes') {
    f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.06, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.6);
    for (const fr of freqs) { // FM electric piano
      const car = osc('sine', fr, at, at + dur + 0.7); const mod = osc('sine', fr * 2, at, at + dur + 0.7); const mg = c.createGain();
      mg.gain.setValueAtTime(fr * 1.2, at); mg.gain.exponentialRampToValueAtTime(fr * 0.05, at + 0.6); mod.connect(mg).connect(car.frequency); car.connect(f);
    }
  } else if (inst === 'strings') {
    f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.035, at + dur * 0.3); g.gain.setValueAtTime(0.035, at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.5);
    for (const fr of freqs) for (const det of [-0.006, 0.006]) { const o = osc('sawtooth', fr * (1 + det), at, at + dur + 0.6); const lfo = osc('sine', 5, at, at + dur + 0.6); const lg = c.createGain(); lg.gain.value = fr * 0.004; lfo.connect(lg).connect(o.frequency); o.connect(f); }
  } else { // pad
    f.frequency.setValueAtTime(500, at); f.frequency.linearRampToValueAtTime(1400, at + dur * 0.5); f.frequency.linearRampToValueAtTime(700, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.03, at + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.6);
    for (const fr of freqs) for (const det of [-0.008, 0.008]) { const o = osc(det < 0 ? 'sawtooth' : 'square', fr * (1 + det), at, at + dur + 0.7); o.connect(f); }
  }
  f.connect(g); g.connect(d); g.connect(rev);
}

function lead(inst: LeadInst, freq: number, dur: number, at: number) {
  const c = ac(); const { out, rev } = buses();
  const f = c.createBiquadFilter(); f.type = 'lowpass';
  let g: GainNode;
  if (inst === 'pluck') {
    f.frequency.setValueAtTime(5000, at); f.frequency.exponentialRampToValueAtTime(600, at + 0.25); f.Q.value = 5;
    g = gainEnv(at, 0.002, 0.07, 0, Math.min(0.5, dur + 0.2));
    osc('sawtooth', freq, at, at + 0.8).connect(f); osc('square', freq * 2.003, at, at + 0.8).connect(f);
  } else if (inst === 'bell') {
    f.frequency.value = 6000;
    g = gainEnv(at, 0.002, 0.08, 0, Math.min(1.4, dur + 0.8));
    const car = osc('sine', freq, at, at + 1.8), mod = osc('sine', freq * 3.5, at, at + 1.8), mg = c.createGain();
    mg.gain.setValueAtTime(freq * 2, at); mg.gain.exponentialRampToValueAtTime(freq * 0.1, at + 1); mod.connect(mg).connect(car.frequency); car.connect(f);
  } else if (inst === 'brass') {
    f.frequency.setValueAtTime(500, at); f.frequency.linearRampToValueAtTime(2200, at + 0.08); f.frequency.linearRampToValueAtTime(1200, at + dur);
    g = gainEnv(at, 0.03, 0.06, Math.max(0, dur - 0.1), 0.15);
    for (const det of [-0.004, 0.004]) osc('sawtooth', freq * (1 + det), at, at + dur + 0.3).connect(f);
  } else { // saw lead with vibrato
    f.frequency.value = 3200;
    g = gainEnv(at, 0.01, 0.05, Math.max(0, dur - 0.05), 0.18);
    for (const det of [-0.006, 0.006]) { const o = osc('sawtooth', freq * (1 + det), at, at + dur + 0.3); const lfo = osc('sine', 5.5, at, at + dur + 0.3); const lg = c.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(freq * 0.008, at + 0.2); lfo.connect(lg).connect(o.frequency); o.connect(f); }
  }
  f.connect(g); g.connect(out); g.connect(rev);
}

function bassNote(style: BassStyle, freq: number, dur: number, at: number, glideTo?: number) {
  const c = ac(); const { duck: d } = buses();
  if (style === '808') {
    const o = osc('sine', freq, at, at + dur + 0.2);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur * 0.5);
    const sh = c.createWaveShaper(); sh.curve = satCurve;
    const g = gainEnv(at, 0.005, 0.32, dur * 0.6, dur * 0.5);
    o.connect(sh).connect(g).connect(musicBus!);
  } else {
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(style === 'arp' ? 1400 : 900, at); f.frequency.exponentialRampToValueAtTime(260, at + dur);
    const g = gainEnv(at, 0.004, 0.16, dur * 0.5, dur * 0.4);
    osc('sawtooth', freq, at, at + dur + 0.1).connect(f); osc('sine', freq * 0.5, at, at + dur + 0.1).connect(f);
    f.connect(g).connect(d);
  }
}

function riser(at: number, len: number) {
  const c = ac(); const s0 = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate); const dd = buf.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
  s0.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(8000, at + len);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.12, at + len);
  s0.connect(f).connect(g).connect(musicBus!); s0.start(at);
}
function impact(at: number) {
  const o = osc('sine', 90, at, at + 1.2); o.frequency.exponentialRampToValueAtTime(30, at + 1);
  const g = gainEnv(at, 0.003, 0.5, 0.05, 1); o.connect(g).connect(musicBus!); g.connect(buses().rev);
  noise(0.6, 0.18, 900, Math.max(0, at - ac().currentTime), musicBus);
}

let current: string | null = null;
let schedTimer: number | undefined;
let rotateTimer: number | undefined;
let rotateMin = 0;
export function currentTrack() { return current; }

/** 'auto' picks by context: chill menu, energetic battles, epic bosses, moody regions. */
export function autoTrack(context: 'menu' | 'battle' | 'boss', region?: string) {
  if (context === 'menu') return 'lofi';
  if (context === 'boss') return 'rise';
  if (region === 'shadow' || region === 'tombs' || region === 'graveyard') return 'trap';
  if (region === 'forest' || region === 'tundra') return 'synthwave';
  if (region === 'mountains') return 'anthem';
  return 'neon';
}

/** Switch to the next track every N minutes (0 = off). */
export function setRotation(minutes: number) {
  rotateMin = minutes;
  clearTimeout(rotateTimer);
  if (current && minutes > 0) armRotation();
}
function armRotation() {
  clearTimeout(rotateTimer);
  if (rotateMin <= 0) return;
  rotateTimer = window.setTimeout(() => {
    const i = TRACKS.findIndex((t) => t.id === current);
    playTrack(TRACKS[(i + 1) % TRACKS.length].id, true);
  }, rotateMin * 60000);
}

export function playTrack(id: string, force = false) {
  const track = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
  if (!force && current === track.id && schedTimer) return;
  stopMusic();
  if (!musicOn) return;
  const c = ac();
  buses();
  current = track.id;
  armRotation();
  const step = 60 / track.bpm / 4;
  let i = 0;
  let next = c.currentTime + 0.1;
  const tick = () => {
    if (!musicOn) return;
    try {
      while (next < c.currentTime + 0.16) {
        const bar = Math.floor(i / 16);
        const sec = track.order[Math.floor(bar / 4) % track.order.length];
        const barIn = bar % 4, s16 = i % 16;
        const at = next + (track.swing && s16 % 2 === 1 ? step * track.swing : 0);
        const full = sec === 'A' || sec === 'B';
        const D = track.drums;
        if (full || sec === 'break' && barIn === 3) {
          if (D.kick[s16] === 'x' && (full || s16 < 8)) kick(at);
          if (D.snare[s16] === 'x') snare(at);
          if (D.clap?.[s16] === 'x') clap(at);
          if (D.hat[s16] === 'x') hat(at, false);
          if (D.open?.[s16] === 'x') hat(at, true);
          if (track.bass === '808' && s16 % 2 === 1 && D.hat[s16] === 'x' && Math.random() < 0.3) { hat(at + step / 2, false); } // hat rolls
        } else if (sec === 'intro' && s16 % 4 === 0 && bar % 2 === 1) hat(at, false);
        if (track.crackle && s16 % 4 === 0) noise(0.05, 0.015, 3000, Math.max(0, at - c.currentTime), musicBus, 'bandpass');
        const prog = track.chords[barIn];
        if (s16 === 0) {
          chord(track.chordInst, prog.map((d2) => note(track, d2, 1)), step * 16, at);
          if (bar % 4 === 0 && sec === 'A') impact(at);
          if (sec === 'break' && barIn === 2) riser(at, step * 32);
        }
        if (track.strings16 && full) { const d2 = prog[(s16 >> 1) % prog.length]; if (s16 % 2 === 0) lead('pluck', note(track, d2, 1), step * 1.5, at); }
        // bass
        if (full || sec === 'break') {
          const r = note(track, prog[0], -1);
          if (track.bass === 'offbeat' && s16 % 4 === 2) bassNote('offbeat', r, step * 1.6, at);
          else if (track.bass === 'root8' && s16 % 2 === 0) bassNote('root8', r, step * 1.8, at);
          else if (track.bass === 'arp' && s16 % 2 === 0) bassNote('arp', note(track, prog[(s16 >> 1) % prog.length], -1), step * 1.8, at);
          else if (track.bass === '808' && D.kick[s16] === 'x') bassNote('808', r, step * 6, at, s16 === 10 ? r * 1.5 : undefined);
        }
        // melody (8th notes, held across rests)
        if (s16 % 2 === 0 && (full || sec === 'intro' && bar % 2 === 1)) {
          const mel = sec === 'B' ? track.melodyB : track.melodyA;
          const k = (barIn * 8 + s16 / 2) % mel.length;
          const m = mel[k];
          if (m !== null && m !== undefined) {
            let hold = 1; while (hold < 6 && mel[(k + hold) % mel.length] === null) hold++;
            lead(track.lead, note(track, m, 1), step * 2 * hold * 0.9, at);
          }
        }
        next += step;
        i++;
      }
    } catch { /* ignore */ }
  };
  tick();
  schedTimer = window.setInterval(tick, 30);
}

export function startMusic(context: 'menu' | 'battle' | 'boss', choice = 'auto', region?: string) {
  if (rotateMin > 0 && current && schedTimer) return;
  playTrack(choice === 'auto' ? autoTrack(context, region) : choice);
}
export function stopMusic() { clearInterval(schedTimer); schedTimer = undefined; clearTimeout(rotateTimer); current = null; }
export function unlockAudio() { try { ac(); } catch { /* ignore */ } }

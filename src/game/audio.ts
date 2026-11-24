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
// A small look-ahead sequencer: notes are scheduled on the audio clock (not
// setInterval timing), so rhythm stays steady even when the game is busy.
type Voice = 'oud' | 'ney' | 'qanun' | 'horn';
type Deg = number | null;
interface Section { melody: Deg[]; chords: number[]; drums: string; counter?: Deg[] }
interface Track { id: string; bpm: number; root: number; scale: number[]; lead: Voice; counterVoice?: Voice; pad: boolean; sections: Record<string, Section>; order: string[] }

const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const BAYATI = [0, 1.5, 3, 5, 7, 8, 10];
const RAST = [0, 2, 3.5, 5, 7, 9, 10.5];
const NAHAWAND = [0, 2, 3, 5, 7, 8, 11];
const KURD = [0, 1, 3, 5, 7, 8, 10];
const AJAM = [0, 2, 4, 5, 7, 9, 11];
const _ = null;

export const TRACKS: Track[] = [
  { id: 'caravan', bpm: 100, root: 146.83, scale: HIJAZ, lead: 'oud', counterVoice: 'ney', pad: true, order: ['A', 'A', 'B', 'A', 'C', 'B'],
    sections: {
      A: { melody: [4, 5, 4, 3, 2, _, 1, 0, 1, 2, 3, _, 4, _, _, _, 4, 5, 6, 5, 4, 3, 2, _, 3, 2, 1, _, 0, _, _, _], chords: [0, 3, 4, 0], drums: 'D..TT.D.T..TD.T.' },
      B: { melody: [7, _, 6, 5, 4, 5, 4, _, 3, 4, 5, _, 6, 5, 4, _, 7, 8, 7, 6, 5, 4, 3, _, 2, 1, 2, 3, 1, 0, _, _], chords: [4, 3, 1, 0], drums: 'D..TT.D.T..TD.TT', counter: [_, _, _, _, 11, _, _, _, _, _, _, _, 9, _, _, _, _, _, _, _, 10, _, _, _, _, _, _, _, 7, _, _, _] },
      C: { melody: [0, _, _, _, _, _, 0, _, 4, _, _, _, 3, _, 1, _, 0, _, _, _, _, _, _, _, 4, 3, 2, 1, 0, _, _, _], chords: [0, 0, 4, 0], drums: 'D.TTD.T.DDT.D.TT' },
    } },
  { id: 'oasis', bpm: 72, root: 196, scale: BAYATI, lead: 'ney', counterVoice: 'qanun', pad: true, order: ['A', 'B', 'A', 'C'],
    sections: {
      A: { melody: [0, _, 1, 2, 3, _, _, _, 2, 1, 2, _, _, _, _, _, 4, 3, 2, 1, 0, _, 1, _, 0, _, _, _, _, _, _, _], chords: [0, 3, 2, 0], drums: 'D.......T...T...' },
      B: { melody: [4, _, 5, 4, 3, _, 4, _, 5, _, _, _, 7, _, 6, 5, 4, _, 3, _, 2, 3, 4, _, 3, _, _, _, _, _, _, _], chords: [3, 4, 5, 3], drums: 'D.......T.T.T...', counter: [7, _, _, _, 9, _, _, _, 8, _, _, _, 11, _, _, _, 9, _, _, _, 8, _, _, _, 7, _, _, _, _, _, _, _] },
      C: { melody: [2, _, _, _, 1, _, _, _, 0, _, _, _, _, _, _, _, 4, _, _, _, 3, _, 2, _, 1, _, _, _, 0, _, _, _], chords: [0, 1, 4, 0], drums: 'D.......D...T...' },
    } },
  { id: 'drums', bpm: 132, root: 110, scale: KURD, lead: 'horn', counterVoice: 'oud', pad: false, order: ['A', 'B', 'A', 'C'],
    sections: {
      A: { melody: [0, _, 0, _, 3, _, 2, _, 0, _, 0, 1, 2, _, _, _, 4, _, 4, _, 3, _, 2, 1, 0, _, _, _, _, _, _, _], chords: [0, 0, 3, 0], drums: 'D.TDD.T.D.TDDKTK' },
      B: { melody: [4, _, 5, _, 7, _, 5, 4, 3, _, 4, _, 5, _, _, _, 7, 6, 5, 4, 3, 2, 1, _, 0, _, 1, _, 0, _, _, _], chords: [3, 4, 5, 0], drums: 'D.TDD.TKD.TDDKTK', counter: [0, 0, 3, _, 0, 0, 4, _, 0, 0, 3, _, 5, 4, 3, _, 0, 0, 3, _, 0, 0, 4, _, 3, 2, 1, _, 0, _, _, _] },
      C: { melody: [_, _, _, _, _, _, _, _, 0, _, _, _, 0, _, _, _, _, _, _, _, _, _, _, _, 4, _, 3, _, 2, _, 1, _], chords: [0, 0, 0, 0], drums: 'DDTDDKTDDDTDDKTT' },
    } },
  { id: 'djinn', bpm: 90, root: 130.81, scale: NAHAWAND, lead: 'qanun', counterVoice: 'ney', pad: true, order: ['A', 'B', 'A', 'B', 'C'],
    sections: {
      A: { melody: [0, 2, 4, 7, 6, 4, 2, 4, 5, 4, 2, 1, 2, _, _, _, 0, 2, 4, 6, 7, 6, 4, 3, 2, 3, 1, 0, _, _, _, _], chords: [0, 5, 3, 4], drums: 'D...T..TD...T.T.' },
      B: { melody: [7, 9, 11, 9, 7, 6, 4, 6, 7, 6, 4, 3, 4, _, _, _, 2, 4, 6, 4, 2, 1, 0, 1, 2, 1, 0, _, _, _, _, _], chords: [5, 3, 4, 0], drums: 'D...T..TD..TT.T.', counter: [7, _, _, _, _, _, _, _, 8, _, _, _, _, _, _, _, 6, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _] },
      C: { melody: [0, _, _, _, 4, _, _, _, 3, _, _, _, 2, _, _, _, 0, _, _, _, 6, _, _, _, 4, _, 3, _, 0, _, _, _], chords: [0, 0, 5, 4], drums: 'D.......T.......' },
    } },
  { id: 'dabke', bpm: 138, root: 174.61, scale: RAST, lead: 'oud', counterVoice: 'horn', pad: false, order: ['A', 'A', 'B', 'C'],
    sections: {
      A: { melody: [0, 2, 4, 2, 4, 5, 4, 2, 3, 2, 1, 2, 0, _, 0, _, 4, 5, 7, 5, 4, 2, 3, 4, 2, 1, 0, 1, 0, _, _, _], chords: [0, 4, 3, 0], drums: 'D.KTD.KTD.KTDKKT' },
      B: { melody: [7, _, 7, 8, 9, 8, 7, 5, 4, 5, 7, _, 5, 4, 2, _, 4, 5, 4, 2, 0, 2, 4, _, 3, 2, 1, 2, 0, _, _, _], chords: [4, 4, 3, 0], drums: 'D.KTD.KTD.KTDKKT', counter: [0, _, 4, _, 0, _, 4, _, 3, _, 4, _, 0, _, 4, _, 0, _, 4, _, 0, _, 4, _, 3, _, 4, _, 0, _, _, _] },
      C: { melody: [0, _, _, _, 0, _, _, _, 4, _, 4, _, 4, _, _, _, 3, 3, 3, _, 2, 2, 2, _, 1, 2, 3, 4, 0, _, _, _], chords: [0, 0, 4, 0], drums: 'DKKTDKKTDKKTDKTT' },
    } },
  { id: 'forest', bpm: 96, root: 220, scale: AJAM, lead: 'qanun', counterVoice: 'ney', pad: true, order: ['A', 'B', 'A', 'C'],
    sections: {
      A: { melody: [0, 2, 4, 7, 4, 2, 4, _, 5, 4, 2, 4, 1, _, _, _, 0, 2, 4, 7, 9, 7, 4, _, 5, 4, 3, 1, 0, _, _, _], chords: [0, 5, 3, 4], drums: 'D.......T...T.T.' },
      B: { melody: [7, _, 9, 7, 6, _, 4, _, 5, _, 7, 5, 4, _, _, _, 3, _, 4, 5, 6, 5, 4, _, 2, 3, 4, 1, 2, _, _, _], chords: [3, 4, 5, 1], drums: 'D.....T.T...T.T.', counter: [7, _, _, _, 11, _, _, _, 10, _, _, _, 9, _, _, _, 8, _, _, _, 9, _, _, _, 8, _, _, _, 7, _, _, _] },
      C: { melody: [4, _, _, _, 2, _, _, _, 0, _, _, _, _, _, _, _, 5, _, _, _, 4, _, 2, _, 4, _, _, _, 0, _, _, _], chords: [0, 3, 4, 0], drums: 'D...............' },
    } },
];

function note(track: Track, deg: number, octave = 0) {
  const n = track.scale.length;
  const o = Math.floor(deg / n) + octave;
  const semis = track.scale[((deg % n) + n) % n] + o * 12;
  return track.root * Math.pow(2, semis / 12);
}

let reverb: ConvolverNode | null = null;
function musicOut() {
  const c = ac();
  if (!reverb) {
    // generated impulse response: a short, warm hall
    reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.2);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.28;
    reverb.connect(wet).connect(master!);
  }
  return musicBus!;
}
function send(node: AudioNode) { node.connect(musicOut()); node.connect(reverb!); }

function env(g: GainNode, at: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
}

function play(v: Voice | 'pad' | 'bass', freq: number, dur: number, vol: number, at: number) {
  const c = ac();
  const g = c.createGain();
  if (v === 'oud') {
    // plucked: two detuned saws through a closing low-pass, plus a pick click
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = freq; o2.frequency.value = freq * 1.005;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(3200, at); f.frequency.exponentialRampToValueAtTime(380, at + Math.min(0.9, dur));
    env(g, at, 0.004, vol, Math.min(1.2, dur * 1.3));
    o1.connect(f); o2.connect(f); f.connect(g); send(g);
    o1.start(at); o2.start(at); o1.stop(at + dur * 1.4 + 0.1); o2.stop(at + dur * 1.4 + 0.1);
    noise(0.015, vol * 0.5, 4000, Math.max(0, at - c.currentTime), musicBus, 'highpass');
  } else if (v === 'qanun') {
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = freq; o2.frequency.value = freq * 2;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    env(g, at, 0.003, vol, Math.min(1.4, dur * 1.6));
    o1.connect(g); o2.connect(g2).connect(g); send(g);
    o1.start(at); o2.start(at); o1.stop(at + dur * 1.7 + 0.1); o2.stop(at + dur * 1.7 + 0.1);
  } else if (v === 'ney') {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.2; const lg = c.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(freq * 0.012, at + 0.25); lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.09); g.gain.setValueAtTime(vol * 0.9, at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.15);
    o.connect(g); send(g); o.start(at); lfo.start(at); o.stop(at + dur + 0.2); lfo.stop(at + dur + 0.2);
    noise(dur * 0.9, vol * 0.06, freq * 3, Math.max(0, at - c.currentTime), musicBus, 'bandpass');
  } else if (v === 'horn') {
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = freq; o2.frequency.value = freq * 0.5;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(600, at); f.frequency.linearRampToValueAtTime(1600, at + 0.08);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.05); g.gain.setValueAtTime(vol * 0.8, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1);
    o1.connect(f); o2.connect(f); f.connect(g); send(g); o1.start(at); o2.start(at); o1.stop(at + dur + 0.15); o2.stop(at + dur + 0.15);
  } else if (v === 'pad') {
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.8, at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.4);
    for (const d of [0.996, 1, 1.004]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * d; o.connect(f); o.start(at); o.stop(at + dur + 0.5); }
    f.connect(g); send(g);
  } else { // bass
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 0.5;
    env(g, at, 0.01, vol, dur);
    o.connect(g); o2.connect(g); g.connect(musicOut()); o.start(at); o2.start(at); o.stop(at + dur + 0.1); o2.stop(at + dur + 0.1);
  }
}

function drum(kind: string, at: number) {
  const c = ac();
  const when = Math.max(0, at - c.currentTime);
  if (kind === 'D') { // darbuka "dum": pitch-dropping body + thud
    const o = c.createOscillator(); o.type = 'sine'; const g = c.createGain();
    o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(58, at + 0.18);
    env(g, at, 0.003, 0.42, 0.28); o.connect(g).connect(musicOut()); o.start(at); o.stop(at + 0.35);
    noise(0.06, 0.08, 400, when, musicBus);
  } else if (kind === 'T') { // "tek": bright rim
    noise(0.05, 0.16, 6000, when, musicBus, 'highpass');
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1100; const g = c.createGain(); env(g, at, 0.001, 0.03, 0.03); o.connect(g).connect(musicOut()); o.start(at); o.stop(at + 0.05);
  } else if (kind === 'K') { // "ka" / clap
    noise(0.09, 0.13, 1600, when, musicBus, 'bandpass');
  }
}

let current: string | null = null;
let schedTimer: number | undefined;
let rotateTimer: number | undefined;
let rotateMin = 0;
export function currentTrack() { return current; }

/** 'auto' picks by context: calm menu, battle, boss fights, regions. */
export function autoTrack(context: 'menu' | 'battle' | 'boss', region?: string) {
  if (context === 'menu') return 'oasis';
  if (context === 'boss') return 'drums';
  if (region === 'shadow' || region === 'tombs' || region === 'graveyard') return 'djinn';
  if (region === 'forest' || region === 'tundra') return 'forest';
  if (region === 'mountains') return 'dabke';
  return 'caravan';
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
  current = track.id;
  armRotation();
  const step = 60 / track.bpm / 4; // 16th note
  let i = 0;
  let next = c.currentTime + 0.08;
  // section/bar bookkeeping: each section is 4 bars of 16 sixteenths
  const tick = () => {
    if (!musicOn) return;
    try {
      while (next < c.currentTime + 0.15) {
        const bar = Math.floor(i / 16);
        const secName = track.order[Math.floor(bar / 4) % track.order.length];
        const sec = track.sections[secName];
        const s16 = i % 16, barInSec = bar % 4;
        const d = sec.drums[s16];
        if (d && d !== '.') drum(d, next);
        if (s16 % 2 === 1 && track.bpm >= 120) noise(0.02, 0.03, 9000, Math.max(0, next - c.currentTime), musicBus, 'highpass'); // riq shimmer
        if (i % 2 === 0) {
          const k = ((barInSec * 16 + s16) / 2) % sec.melody.length;
          const m = sec.melody[k];
          if (m !== null && m !== undefined) {
            let hold = 1; while (hold < 4 && sec.melody[(k + hold) % sec.melody.length] === null) hold++;
            play(track.lead, note(track, m, 1), step * 2 * hold, track.lead === 'ney' ? 0.075 : track.lead === 'horn' ? 0.05 : 0.07, next);
          }
          const cm = sec.counter?.[k];
          if (cm !== null && cm !== undefined && track.counterVoice) play(track.counterVoice, note(track, cm, 0), step * 6, 0.035, next);
        }
        if (s16 === 0) {
          const root = sec.chords[barInSec];
          if (track.pad) [0, 2, 4].forEach((o) => play('pad', note(track, root + o, 0), step * 15, 0.018, next));
          play('bass', note(track, root, -1), step * 3, 0.13, next);
        } else if (s16 === 8 || (track.bpm >= 120 && s16 % 4 === 0)) {
          play('bass', note(track, sec.chords[barInSec] + (s16 === 8 ? 4 : 0), -1), step * 2.5, 0.1, next);
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
  // With rotation on, keep whatever is playing (the timer moves to the next track).
  if (rotateMin > 0 && current && schedTimer) return;
  playTrack(choice === 'auto' ? autoTrack(context, region) : choice);
}
export function stopMusic() { clearInterval(schedTimer); schedTimer = undefined; clearTimeout(rotateTimer); current = null; }
export function unlockAudio() { try { ac(); } catch { /* ignore */ } }

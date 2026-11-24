// Synthesized SFX + a small step sequencer playing original tracks in Arabic
// maqam flavours (no audio assets, so nothing to license).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxOn = true;
let musicOn = true;
let seqTimer: number | undefined;

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
type Voice = 'oud' | 'ney' | 'qanun' | 'horn';
interface Track {
  id: string;
  bpm: number;
  root: number; // Hz
  scale: number[]; // semitones from root (maqam approximation, 12-TET)
  lead: Voice;
  melody: (number | null)[]; // scale degrees per 8th note (null = rest), 7+ wraps an octave
  bass: (number | null)[]; // per quarter note
  drums: string; // per 16th: D=dum T=tek K=ka(clap) .=rest
  chord?: boolean; // qanun arpeggio layer
}

const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const BAYATI = [0, 1.5, 3, 5, 7, 8, 10];
const RAST = [0, 2, 3.5, 5, 7, 9, 10.5];
const NAHAWAND = [0, 2, 3, 5, 7, 8, 11];
const KURD = [0, 1, 3, 5, 7, 8, 10];

export const TRACKS: Track[] = [
  { id: 'caravan', bpm: 104, root: 146.83, scale: HIJAZ, lead: 'oud',
    melody: [4, 5, 4, 3, 2, 3, 1, 0, null, 0, 1, 2, 3, 4, 3, null, 4, 6, 7, 6, 5, 4, 3, 2, 3, 4, 3, 2, 1, 0, null, null],
    bass: [0, null, 0, 4, 0, null, 3, 4], drums: 'D..TD.T.D..TD.T.' },
  { id: 'oasis', bpm: 76, root: 196, scale: BAYATI, lead: 'ney',
    melody: [0, null, 1, 2, 3, null, 2, 1, 2, null, null, null, 4, 3, 2, 1, 0, null, 1, 0, null, null, null, null, 2, 3, 4, 3, 2, null, 1, null],
    bass: [0, null, null, null, 3, null, null, null], drums: 'D.......T...T...' , chord: true },
  { id: 'drums', bpm: 128, root: 110, scale: KURD, lead: 'horn',
    melody: [0, null, 0, null, 3, null, 2, null, 0, null, 0, 1, 2, null, null, null, 4, null, 4, null, 3, null, 2, 1, 0, null, null, null, null, null, null, null],
    bass: [0, 0, 3, 0, 0, 0, 4, 3], drums: 'D.TDD.T.D.TDDKTK' },
  { id: 'djinn', bpm: 92, root: 130.81, scale: NAHAWAND, lead: 'qanun',
    melody: [0, 2, 4, 7, 6, 4, 2, 4, 5, 4, 2, 1, 2, null, null, null, 0, 2, 4, 6, 7, 6, 4, 3, 2, 3, 1, 0, null, null, null, null],
    bass: [0, null, 5, null, 3, null, 4, null], drums: 'D...T..TD...T.T.' },
  { id: 'dabke', bpm: 138, root: 174.61, scale: RAST, lead: 'oud',
    melody: [0, 2, 4, 2, 4, 5, 4, 2, 3, 2, 1, 2, 0, null, 0, null, 4, 5, 7, 5, 4, 2, 3, 4, 2, 1, 0, 1, 0, null, null, null],
    bass: [0, 4, 0, 4, 3, 4, 0, null], drums: 'D.KTD.KTD.KTDKKT' },
];

function note(track: Track, deg: number, octave = 0) {
  const n = track.scale.length;
  const o = Math.floor(deg / n) + octave;
  const semis = track.scale[((deg % n) + n) % n] + o * 12;
  return track.root * Math.pow(2, semis / 12);
}

function voice(v: Voice, freq: number, dur: number, vol: number, when: number) {
  const c = ac();
  const t0 = c.currentTime + when;
  if (v === 'oud' || v === 'qanun') {
    // plucked string: bright attack, fast decay through a closing filter
    const o = c.createOscillator(); o.type = v === 'oud' ? 'sawtooth' : 'triangle'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.004;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(v === 'oud' ? 2600 : 4200, t0); f.frequency.exponentialRampToValueAtTime(400, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f); o2.connect(f); f.connect(g).connect(musicBus!);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  } else if (v === 'ney') {
    // breathy flute: sine + vibrato + a little noise
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * 2;
    const lfo = c.createOscillator(); lfo.frequency.value = 5; const lg = c.createGain(); lg.gain.value = freq * 0.012; lfo.connect(lg).connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.08); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(musicBus!); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
    noise(dur * 0.8, vol * 0.08, freq * 4, when, musicBus, 'bandpass');
  } else {
    // horn: square through a soft filter
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f).connect(g).connect(musicBus!); o.start(t0); o.stop(t0 + dur + 0.05);
  }
}

let current: string | null = null;
export function currentTrack() { return current; }

/** 'auto' picks by context: calm menu, battle, boss fights, dark regions. */
export function autoTrack(context: 'menu' | 'battle' | 'boss', region?: string) {
  if (context === 'menu') return 'oasis';
  if (context === 'boss') return 'drums';
  if (region === 'shadow' || region === 'tombs') return 'djinn';
  if (region === 'mountains') return 'dabke';
  return 'caravan';
}

export function playTrack(id: string) {
  const track = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
  if (current === track.id && seqTimer) return;
  stopMusic();
  if (!musicOn) return;
  current = track.id;
  const step = 60 / track.bpm / 4; // 16th note
  let i = 0;
  const tick = () => {
    if (!musicOn) return;
    try {
      const s16 = i % 16;
      const d = track.drums[s16];
      if (d === 'D') { tone(85, 0.22, 'sine', 0.38, -35, 0, musicBus); noise(0.05, 0.08, 300, 0, musicBus); }
      else if (d === 'T') noise(0.05, 0.14, 5200, 0, musicBus, 'highpass');
      else if (d === 'K') noise(0.08, 0.12, 1500, 0, musicBus, 'bandpass');
      if (i % 2 === 0) {
        const m = track.melody[(i / 2) % track.melody.length];
        if (m !== null) voice(track.lead, note(track, m, track.lead === 'horn' ? 1 : 1), step * (track.lead === 'ney' ? 5 : 2.6), track.lead === 'ney' ? 0.07 : 0.06, 0);
      }
      if (i % 4 === 0) {
        const b = track.bass[(i / 4) % track.bass.length];
        if (b !== null) tone(note(track, b, -1), step * 3.5, 'triangle', 0.11, 0, 0, musicBus);
        if (track.chord && (i / 4) % 2 === 0) [0, 2, 4].forEach((k, j) => voice('qanun', note(track, (track.bass[(i / 4) % track.bass.length] ?? 0) + k, 1), 0.6, 0.025, j * 0.05));
      }
    } catch { /* ignore */ }
    i++;
  };
  seqTimer = window.setInterval(tick, step * 1000);
}

export function startMusic(context: 'menu' | 'battle' | 'boss', choice = 'auto', region?: string) {
  playTrack(choice === 'auto' ? autoTrack(context, region) : choice);
}
export function stopMusic() { clearInterval(seqTimer); seqTimer = undefined; current = null; }
export function unlockAudio() { try { ac(); } catch { /* ignore */ } }

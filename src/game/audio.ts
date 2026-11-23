// Tiny synthesized SFX + an oriental-flavoured drum/melody loop (no asset licensing needed).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let musicTimer: number | undefined;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSound(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
  if (!on) stopMusic();
}

const last: Record<string, number> = {};

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, when = 0) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t0 = c.currentTime + when;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master!);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, freq = 800, when = 0) {
  const c = ac();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master!);
  s.start(c.currentTime + when);
}

export function sfx(name: 'click' | 'hit' | 'swing' | 'arrow' | 'throw' | 'boom' | 'collapse' | 'volley' | 'win' | 'lose' | 'coin') {
  if (!enabled) return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < (name === 'hit' ? 60 : 30)) return;
  last[name] = now;
  try {
    switch (name) {
      case 'click': tone(660, 0.06, 'triangle', 0.15); break;
      case 'coin': tone(988, 0.08, 'square', 0.06); tone(1318, 0.12, 'square', 0.06, 0, 0.07); break;
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

// Hijaz-like scale for the battle loop.
const SCALE = [293.66, 311.13, 369.99, 392, 440, 466.16, 523.25, 587.33];
export function startMusic(kind: 'menu' | 'battle' | 'boss') {
  stopMusic();
  if (!enabled) return;
  const bpm = kind === 'menu' ? 84 : kind === 'boss' ? 132 : 112;
  const beat = 60 / bpm;
  let step = 0;
  const melody = kind === 'menu' ? [0, 2, 3, 4, 3, 2, 1, 0] : [4, 5, 4, 3, 2, 3, 1, 0, 4, 6, 7, 6, 5, 4, 3, 2];
  const play = () => {
    if (!enabled) return;
    try {
      // doumbek: dum on 1, tek on 3/4
      const s = step % 8;
      if (s === 0 || s === 5) tone(90, 0.18, 'sine', 0.35, -40);
      if (s === 2 || s === 3 || s === 6) noise(0.05, 0.12, 5000);
      if (step % 2 === 0) {
        const n = melody[(step / 2) % melody.length];
        tone(SCALE[n] * (kind === 'menu' ? 1 : 2), beat * 1.6, 'triangle', 0.045);
      }
    } catch { /* ignore */ }
    step++;
  };
  musicTimer = window.setInterval(play, (beat * 1000) / 2);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = undefined; }
export function unlockAudio() { try { ac(); } catch { /* ignore */ } }

import { Battle, W, H, GROUND, CASTLE_X, MINE_X, type Unit } from './battle';
import type { RegionId } from '../data/levels';
import { drawArt, shade as shadeHex } from './art';
import { UNITS } from '../data/units';

const INK = '#16120e';
const TEAM = ['#e0a82e', '#9e1f1f'];

interface Theme { sky: [string, string, string]; far: string; mid: string; ground: [string, string]; grass?: string; sun: string; haze: string; night?: boolean }
const THEMES: Record<RegionId, Theme> = {
  oasis: { sky: ['#4fb3ea', '#9fd8f5', '#fdf1cf'], far: '#e3c07f', mid: '#86b85a', ground: ['#f2d79c', '#e2bd78'], grass: '#7fb34f', sun: '#fff6c8', haze: 'rgba(255,240,200,.25)' },
  dunes: { sky: ['#e8723c', '#f6a35e', '#ffe0a8'], far: '#c8643c', mid: '#b5532f', ground: ['#e6a768', '#cf8a4c'], sun: '#ffe9b0', haze: 'rgba(255,190,120,.25)' },
  mountains: { sky: ['#6fb6e2', '#b6dcf0', '#f2f4ea'], far: '#9a9488', mid: '#76a05a', ground: ['#c9b893', '#ad9a75'], grass: '#6f9a4e', sun: '#fffbe0', haze: 'rgba(230,240,250,.3)' },
  shadow: { sky: ['#0d1230', '#2a2658', '#5a4b7d'], far: '#262447', mid: '#34305c', ground: ['#948cab', '#7a7294'], sun: '#f3ecd0', haze: 'rgba(80,70,140,.2)', night: true },
  tombs: { sky: ['#3a2a4a', '#8a5a5a', '#e0a070'], far: '#7a5a48', mid: '#5c4436', ground: ['#c4a27a', '#a8865e'], sun: '#ffcf8a', haze: 'rgba(255,170,110,.18)' },
};

export class Renderer {
  cam = 0;
  scale = 1;
  viewW = 960;
  follow = true;
  private stars: { x: number; y: number; r: number }[] = [];
  private clouds: { x: number; y: number; s: number; v: number }[] = [];
  private t0 = performance.now();

  constructor(private canvas: HTMLCanvasElement, private ctx = canvas.getContext('2d')!) {
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * 260, r: Math.random() * 1.6 + 0.3 });
    for (let i = 0; i < 7; i++) this.clouds.push({ x: Math.random() * W, y: 30 + Math.random() * 120, s: 0.6 + Math.random() * 0.9, v: 4 + Math.random() * 8 });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = this.canvas.height / H;
    this.viewW = this.canvas.width / this.scale;
  }

  clampCam() { this.cam = Math.max(0, Math.min(W - this.viewW, this.cam)); }

  autoCam(b: Battle, dt: number) {
    if (!this.follow) return;
    let target: number;
    if (b.controlled) target = b.controlled.x - this.viewW * 0.4;
    else {
      const army = b.playerArmy.filter((u) => u.def.id !== 'miner');
      const front = army.length ? Math.max(...army.map((u) => u.x)) : CASTLE_X[0];
      target = front - this.viewW * 0.6;
    }
    this.cam += (target - this.cam) * Math.min(1, dt * 2.2);
    this.clampCam();
  }

  draw(b: Battle) {
    const c = this.ctx;
    const th = THEMES[b.level.region];
    const time = (performance.now() - this.t0) / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const sk = c.createLinearGradient(0, 0, 0, this.canvas.height * 0.75);
    sk.addColorStop(0, th.sky[0]); sk.addColorStop(0.55, th.sky[1]); sk.addColorStop(1, th.sky[2]);
    c.fillStyle = sk;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shx = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 14 : 0;
    const shy = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 8 : 0;
    c.setTransform(this.scale, 0, 0, this.scale, shx * this.scale, shy * this.scale);

    this.drawBackdrop(b.level.region, th, time);

    c.save();
    c.translate(-this.cam, 0);
    // ground with soft gradient, pebbles and tufts
    const gg = c.createLinearGradient(0, GROUND - 24, 0, H);
    gg.addColorStop(0, th.ground[0]); gg.addColorStop(1, th.ground[1]);
    c.fillStyle = gg;
    c.fillRect(-50, GROUND - 24, W + 100, H - GROUND + 40);
    c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(-50, GROUND - 24, W + 100, 4);
    for (let x = 0; x < W; x += 47) {
      const k = (x * 7919) % 97;
      c.fillStyle = `rgba(90,60,30,${0.12 + (k % 5) * 0.03})`;
      c.beginPath(); c.ellipse(x + (k % 30), GROUND + 20 + (k % 70), 3 + (k % 4), 2, 0, 0, 7); c.fill();
      if (th.grass && k % 3 === 0) { c.strokeStyle = th.grass; c.lineWidth = 2; const gx = x + (k % 40), gy2 = GROUND - 14 + (k % 12); c.beginPath(); c.moveTo(gx, gy2); c.lineTo(gx - 4, gy2 - 9); c.moveTo(gx, gy2); c.lineTo(gx + 1, gy2 - 12); c.moveTo(gx, gy2); c.lineTo(gx + 5, gy2 - 8); c.stroke(); }
    }
    if (b.level.region === 'tombs') this.tombProps();

    this.drawMine(MINE_X[0]);
    this.drawMine(MINE_X[1]);
    this.drawCastle(0, b.castleHp[0] / b.castleMax[0], b.level.region, false, b, time);
    this.drawCastle(1, isFinite(b.castleHp[1]) ? b.castleHp[1] / b.castleMax[1] : 1, b.level.region, !isFinite(b.castleHp[1]), b, time);

    // formation marker (a small banner on the ground)
    const markX = b.mode === 'defend' ? CASTLE_X[0] + 220 : b.mode === 'hold' ? W / 2 - 80 : -1;
    if (markX > 0) {
      c.strokeStyle = 'rgba(60,40,20,.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(markX, GROUND + 14); c.lineTo(markX, GROUND - 46); c.stroke();
      c.fillStyle = 'rgba(224,168,46,.85)'; c.beginPath(); c.moveTo(markX, GROUND - 46); c.lineTo(markX + 22 + Math.sin(time * 4) * 3, GROUND - 40); c.lineTo(markX, GROUND - 32); c.closePath(); c.fill();
    }

    const sorted = [...b.units].sort((a, z) => (a.def.flying ? 1 : 0) - (z.def.flying ? 1 : 0) || a.lane - z.lane);
    for (const u of sorted) this.drawUnit(u, b);

    for (const p of b.projectiles) {
      if (p.t < 0) continue;
      c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
      if (p.kind === 'arrow' || p.kind === 'bolt') {
        const L = p.kind === 'bolt' ? 14 : 18;
        c.strokeStyle = '#5a3a22'; c.lineWidth = p.kind === 'bolt' ? 3 : 2; c.beginPath(); c.moveTo(-L * 0.6, 0); c.lineTo(L * 0.45, 0); c.stroke();
        c.fillStyle = '#cfd6dc'; c.beginPath(); c.moveTo(L * 0.6, 0); c.lineTo(L * 0.3, -3.5); c.lineTo(L * 0.3, 3.5); c.fill();
        c.fillStyle = p.side === 0 ? '#f2c14e' : '#c0392b'; c.beginPath(); c.moveTo(-L * 0.6, 0); c.lineTo(-L * 0.75, -3.5); c.lineTo(-L * 0.45, 0); c.lineTo(-L * 0.75, 3.5); c.fill();
      }
      else if (p.kind === 'rock') { const g = c.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#a89a85'); g.addColorStop(1, '#5e5244'); c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.stroke(); }
      else if (p.kind === 'fire') { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,120,30,.8)'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.fillStyle = 'rgba(255,230,120,.9)'; c.beginPath(); c.arc(2, 0, 4, 0, 7); c.fill(); c.fillStyle = 'rgba(255,90,20,.4)'; c.beginPath(); c.moveTo(-4, -6); c.lineTo(-22, 0); c.lineTo(-4, 6); c.fill(); }
      else if (p.kind === 'meteor') { c.shadowColor = '#ff7a2d'; c.shadowBlur = 24; c.fillStyle = '#ff9a3d'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(4, 0, 10, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,160,60,.5)'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(-60, 0); c.lineTo(-10, 12); c.fill(); }
      else { c.fillStyle = '#c77dff'; c.shadowColor = '#c77dff'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); c.shadowBlur = 0; }
      c.restore();
    }
    for (const p of b.particles) { c.globalAlpha = Math.max(0, p.life) * 0.9; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size / 2, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    for (const t of b.texts) { c.font = `900 ${t.size ?? 18}px system-ui, sans-serif`; c.globalAlpha = Math.min(1, t.life * 2); c.fillStyle = INK; c.fillText(t.text, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.text, t.x, t.y); }
    c.globalAlpha = 1;
    c.restore();

    // atmosphere: haze, storm, night tint, ability flash, vignette
    const hz = c.createLinearGradient(0, GROUND - 160, 0, GROUND);
    hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, th.haze);
    c.fillStyle = hz; c.fillRect(0, GROUND - 160, this.viewW, 160);
    if (b.storm > 0) {
      c.fillStyle = `rgba(214,140,80,${0.08 + b.storm * 0.22})`;
      c.fillRect(0, 0, this.viewW, H);
      c.strokeStyle = `rgba(255,220,170,${0.25 * b.storm})`; c.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) { const sx = ((i * 137 + time * 380) % (this.viewW + 100)) - 50, sy = (i * 53) % H; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 30, sy + 4); c.stroke(); }
    }
    if (th.night) { c.fillStyle = 'rgba(20,16,50,.16)'; c.fillRect(0, 0, this.viewW, H); }
    if (b.abilityFx > 0) { c.fillStyle = `rgba(255,220,120,${b.abilityFx * 0.15})`; c.fillRect(0, 0, this.viewW, H); }
    if (b.buff > 0) { c.fillStyle = `rgba(255,120,40,${0.05 + Math.sin(time * 8) * 0.02})`; c.fillRect(0, 0, this.viewW, H); }
    const vg = c.createRadialGradient(this.viewW / 2, H * 0.55, H * 0.45, this.viewW / 2, H * 0.55, Math.max(this.viewW, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,.28)');
    c.fillStyle = vg; c.fillRect(0, 0, this.viewW, H);
  }

  private drawBackdrop(region: RegionId, th: Theme, time: number) {
    const c = this.ctx;
    const vw = this.viewW;
    // sun / moon with glow
    const sx = vw * 0.8, sy = th.night ? 90 : region === 'tombs' ? 150 : 80;
    const glow = c.createRadialGradient(sx, sy, 10, sx, sy, 140);
    glow.addColorStop(0, th.night ? 'rgba(243,236,208,.35)' : 'rgba(255,250,220,.6)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.fillRect(sx - 140, sy - 140, 280, 280);
    if (th.night) {
      c.fillStyle = '#fff';
      for (const s of this.stars) { const x = ((s.x - this.cam * 0.05) % W + W) % W; if (x < vw) { c.globalAlpha = 0.5 + 0.4 * Math.sin(time * 2 + s.x); c.beginPath(); c.arc(x, s.y, s.r, 0, 7); c.fill(); } }
      c.globalAlpha = 1;
    }
    c.fillStyle = th.sun; c.beginPath(); c.arc(sx, sy, th.night ? 32 : 34, 0, 7); c.fill();
    if (th.night) { c.fillStyle = th.sky[1]; c.beginPath(); c.arc(sx + 12, sy - 6, 28, 0, 7); c.fill(); }
    // drifting clouds
    if (!th.night) {
      for (const cl of this.clouds) {
        const x = (((cl.x + time * cl.v - this.cam * 0.08) % (W + 300)) + W + 300) % (W + 300) - 150;
        if (x < -150 || x > vw + 150) continue;
        c.fillStyle = region === 'dunes' || region === 'tombs' ? 'rgba(255,220,190,.55)' : 'rgba(255,255,255,.75)';
        for (const [dx, dy, r] of [[0, 0, 22], [22, -8, 26], [46, 0, 20], [24, 6, 22]]) { c.beginPath(); c.arc(x + dx * cl.s, cl.y + dy * cl.s, r * cl.s, 0, 7); c.fill(); }
      }
    }
    // far layer
    const fg = c.createLinearGradient(0, GROUND - 300, 0, GROUND);
    fg.addColorStop(0, shadeHex(th.far, 0.12)); fg.addColorStop(1, shadeHex(th.far, -0.1));
    c.fillStyle = fg;
    const o1 = -this.cam * 0.15;
    const far = new Path2D();
    c.beginPath(); c.moveTo(0, GROUND); far.moveTo(0, GROUND);
    for (let x = -200; x <= vw + 200; x += 30) {
      const wx = x - o1;
      let y: number;
      if (region === 'mountains') y = GROUND - 170 - Math.abs(Math.sin(wx * 0.004)) * 120 - Math.sin(wx * 0.013) * 25;
      else if (region === 'shadow') y = GROUND - 120 - (Math.floor(wx / 80) % 3 === 0 ? 90 : Math.floor(wx / 80) % 2 ? 40 : 65);
      else if (region === 'tombs') { const m = ((wx % 520) + 520) % 520; y = m < 260 ? GROUND - 60 - (130 - Math.abs(m - 130)) * 1.1 : GROUND - 70 - Math.sin(wx * 0.01) * 10; }
      else y = GROUND - 110 - Math.sin(wx * 0.005) * 40 - Math.sin(wx * 0.011) * 15;
      c.lineTo(x, y); far.lineTo(x, y);
    }
    c.lineTo(vw + 200, GROUND); c.closePath(); c.fill(); far.lineTo(vw + 200, GROUND); far.closePath();
    if (region === 'mountains') { // snow on the peaks: the ridge clipped above a snow line
      c.save(); c.clip(far);
      const sg = c.createLinearGradient(0, GROUND - 300, 0, GROUND - 235);
      sg.addColorStop(0, 'rgba(255,255,255,.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg; c.fillRect(0, GROUND - 320, vw, 90);
      c.restore();
    }
    if (region === 'shadow') {
      c.fillStyle = 'rgba(255,210,120,.55)';
      for (let x = 0; x < vw; x += 37) { const wx = Math.floor(x - o1); if ((wx * 31) % 7 < 2) c.fillRect(x, GROUND - 100 - ((wx * 13) % 50), 5, 7); }
    }
    // mid layer
    const mg = c.createLinearGradient(0, GROUND - 70, 0, GROUND);
    mg.addColorStop(0, shadeHex(th.mid, 0.12)); mg.addColorStop(1, shadeHex(th.mid, -0.12));
    c.fillStyle = mg;
    const o2 = -this.cam * 0.45;
    c.beginPath(); c.moveTo(0, GROUND);
    for (let x = -100; x <= vw + 100; x += 24) c.lineTo(x, GROUND - 40 - Math.sin((x - o2) * 0.008) * 22);
    c.lineTo(vw + 100, GROUND); c.closePath(); c.fill();
    if (region === 'oasis' || region === 'mountains') {
      for (let i = 0; i < 14; i++) {
        const x = ((i * 260 + o2) % (W * 0.6) + W * 0.6) % (W * 0.6) - 100;
        if (x > -60 && x < vw + 60) this.palm(x, GROUND - 40, time + i);
      }
    }
    if (region === 'dunes' || region === 'tombs') {
      // a caravan of camels on the horizon
      c.fillStyle = 'rgba(60,30,20,.35)';
      const cx = ((time * 6 - this.cam * 0.3) % (vw + 400) + vw + 400) % (vw + 400) - 200;
      for (let i = 0; i < 4; i++) { const x = cx + i * 26; c.beginPath(); c.ellipse(x, GROUND - 66, 8, 4, 0, 0, 7); c.fill(); c.fillRect(x - 6, GROUND - 64, 2, 7); c.fillRect(x + 4, GROUND - 64, 2, 7); c.fillRect(x + 6, GROUND - 74, 2, 8); }
    }
  }

  private palm(x: number, y: number, t: number) {
    const c = this.ctx;
    c.strokeStyle = '#6d4c2a'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 50, x + 4, y - 95); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2;
    for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x + 2, y - 15 - k * 14); c.lineTo(x + 8, y - 18 - k * 14); c.stroke(); }
    const sway = Math.sin(t * 1.3) * 4;
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI + (a / 6) * Math.PI;
      c.strokeStyle = a % 2 ? '#3f7d3a' : '#4f9446'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x + 4, y - 95);
      c.quadraticCurveTo(x + 4 + Math.cos(ang) * 30 + sway, y - 115 + Math.sin(ang) * 10, x + 4 + Math.cos(ang) * 48 + sway, y - 84);
      c.stroke();
    }
    c.fillStyle = '#7a4a20'; c.beginPath(); c.arc(x + 2, y - 92, 3, 0, 7); c.arc(x + 7, y - 91, 3, 0, 7); c.fill();
  }

  private tombProps() {
    const c = this.ctx;
    for (let x = 520; x < W - 500; x += 330) {
      const k = (x * 31) % 7;
      c.fillStyle = '#a88a64'; c.strokeStyle = 'rgba(40,25,10,.6)'; c.lineWidth = 2;
      if (k % 2) { c.fillRect(x, GROUND - 70, 20, 70); c.strokeRect(x, GROUND - 70, 20, 70); c.fillRect(x - 5, GROUND - 76, 30, 8); }
      else { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x, GROUND - 26); c.lineTo(x + 30, GROUND - 26); c.lineTo(x + 40, GROUND); c.closePath(); c.fill(); c.stroke(); }
      // torch
      c.fillStyle = '#5a3a22'; c.fillRect(x + 50, GROUND - 46, 4, 46);
      c.fillStyle = 'rgba(255,170,60,.9)'; c.beginPath(); c.arc(x + 52, GROUND - 50, 6 + Math.random() * 2, 0, 7); c.fill();
    }
  }

  private drawMine(x: number) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, GROUND - 60, 0, GROUND);
    g.addColorStop(0, '#a48a68'); g.addColorStop(1, '#6e5a42');
    c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x - 56, GROUND); c.lineTo(x - 34, GROUND - 40); c.lineTo(x - 6, GROUND - 58); c.lineTo(x + 24, GROUND - 46); c.lineTo(x + 40, GROUND - 26); c.lineTo(x + 58, GROUND); c.closePath(); c.fill(); c.stroke();
    // cave entrance with timber frame
    c.fillStyle = '#2a1d12'; c.beginPath(); c.moveTo(x - 18, GROUND); c.lineTo(x - 18, GROUND - 22); c.quadraticCurveTo(x - 2, GROUND - 36, x + 14, GROUND - 22); c.lineTo(x + 14, GROUND); c.closePath(); c.fill();
    c.strokeStyle = '#7a4f28'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 20, GROUND); c.lineTo(x - 20, GROUND - 24); c.lineTo(x + 16, GROUND - 24); c.lineTo(x + 16, GROUND); c.stroke();
    // gold veins sparkle
    const t = performance.now() / 400;
    for (const [i, dx, dy] of [[0, -34, -16], [1, 2, -42], [2, 28, -18], [3, -42, -6], [4, 40, -8]]) {
      const s = 4 + Math.sin(t + i * 1.7) * 1.5;
      c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(x + dx, GROUND + dy - s); c.lineTo(x + dx + s, GROUND + dy); c.lineTo(x + dx, GROUND + dy + s); c.lineTo(x + dx - s, GROUND + dy); c.fill();
    }
    // mine cart
    c.fillStyle = '#6b4423'; c.fillRect(x + 22, GROUND - 14, 20, 10); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(x + 22, GROUND - 14, 20, 10);
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x + 32, GROUND - 14, 6, Math.PI, 0); c.fill();
    c.fillStyle = '#333'; c.beginPath(); c.arc(x + 26, GROUND - 3, 3, 0, 7); c.arc(x + 38, GROUND - 3, 3, 0, 7); c.fill();
  }

  private drawCastle(side: 0 | 1, pct: number, region: RegionId, invulnerable: boolean, b: Battle, time: number) {
    const c = this.ctx;
    const x = CASTLE_X[side];
    const f = side === 0 ? 1 : -1;
    const wall = region === 'shadow' ? '#6c6480' : region === 'mountains' ? '#a39882' : region === 'tombs' ? '#b39468' : '#cf9f63';
    const dark = shadeHex(wall, -0.35);
    const sink = (1 - pct) * 30;
    c.save();
    c.translate(x, sink);
    c.lineWidth = 2.5; c.strokeStyle = INK;
    const block = (bx: number, by: number, bw: number, bh: number) => {
      const g = c.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, shadeHex(wall, f > 0 ? 0.12 : -0.12)); g.addColorStop(1, shadeHex(wall, f > 0 ? -0.12 : 0.12));
      c.fillStyle = g; c.fillRect(bx, by, bw, bh); c.strokeRect(bx, by, bw, bh);
      // mud-brick courses
      c.strokeStyle = 'rgba(60,35,15,.18)'; c.lineWidth = 1;
      for (let yy = by + 14; yy < by + bh; yy += 14) { c.beginPath(); c.moveTo(bx + 2, yy); c.lineTo(bx + bw - 2, yy); c.stroke(); for (let xx = bx + ((yy / 14) % 2 ? 10 : 22); xx < bx + bw; xx += 26) { c.beginPath(); c.moveTo(xx, yy - 14); c.lineTo(xx, yy); c.stroke(); } }
      c.strokeStyle = INK; c.lineWidth = 2.5;
    };
    block(-90, GROUND - 150, 180, 150);
    block(-f * 90 - 30, GROUND - 210, 60, 210);
    for (let i = -90; i < 90; i += 30) block(i, GROUND - 168, 18, 18);
    for (let i = 0; i < 3; i++) block(-f * 90 - 30 + i * 22, GROUND - 226, 14, 16);
    // gate with wooden doors
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(f * 20 - 26, GROUND); c.lineTo(f * 20 - 26, GROUND - 60); c.arc(f * 20, GROUND - 60, 26, Math.PI, 0); c.lineTo(f * 20 + 26, GROUND); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#7a4f28'; c.fillRect(f * 20 - 22, GROUND - 58, 44, 58);
    c.strokeStyle = '#4a2f18'; c.lineWidth = 2; for (let k = -16; k <= 16; k += 8) { c.beginPath(); c.moveTo(f * 20 + k, GROUND - 58); c.lineTo(f * 20 + k, GROUND); c.stroke(); }
    c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(f * 20 + 6, GROUND - 28, 2.5, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 2.5;
    // windows with warm light
    c.fillStyle = region === 'shadow' ? '#ffd27a' : INK;
    c.beginPath(); c.roundRect(-f * 90 - 6, GROUND - 186, 12, 22, [6, 6, 0, 0]); c.fill();
    c.beginPath(); c.roundRect(-40, GROUND - 120, 10, 16, [5, 5, 0, 0]); c.fill(); c.beginPath(); c.roundRect(40, GROUND - 120, 10, 16, [5, 5, 0, 0]); c.fill();
    // pennant
    c.beginPath(); c.moveTo(-f * 90, GROUND - 226); c.lineTo(-f * 90, GROUND - 296); c.stroke();
    c.fillStyle = TEAM[side];
    const wave = Math.sin(time * 5 + side) * 4;
    c.beginPath(); c.moveTo(-f * 90, GROUND - 296); c.quadraticCurveTo(-f * 90 + f * 24, GROUND - 292 + wave, -f * 90 + f * 48, GROUND - 284 + wave); c.lineTo(-f * 90, GROUND - 270); c.closePath(); c.fill(); c.stroke();
    // tower archer
    const hasTower = side === 0 || (b.level.towerDmg ?? 0) > 0;
    if (hasTower && pct > 0) {
      const a: Unit = { uid: 999 + side, def: UNITS.archer, side, x: -f * 90, lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 0, moving: false, attacking: b.towerShot[side], chargeReady: false, calm: 0, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0 };
      c.save(); c.translate(-f * 90, GROUND - 226); c.scale(0.62, 0.62); c.translate(f * 90, -(GROUND - 226) - 8);
      const atk = b.towerShot[side] > 0 ? Math.sin((1 - b.towerShot[side] / 0.3) * Math.PI) : 0;
      drawArt({ c, u: a, x: -f * 90, gy: GROUND - 226, f, t: time, swing: 0, atk, side, region, flash: false });
      c.restore();
    }
    // cracks and rubble
    if (pct < 0.7) { c.strokeStyle = 'rgba(30,20,10,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-40, GROUND - 150); c.lineTo(-25, GROUND - 110); c.lineTo(-40, GROUND - 80); c.stroke(); }
    if (pct < 0.4) { c.beginPath(); c.moveTo(50, GROUND - 150); c.lineTo(35, GROUND - 100); c.lineTo(55, GROUND - 60); c.stroke(); c.fillStyle = 'rgba(60,40,20,.5)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-70 + k * 35, GROUND - 4, 6, 0, 7); c.fill(); } }
    if (pct < 0.25) { c.fillStyle = 'rgba(80,80,80,.35)'; c.beginPath(); c.arc(-20 + Math.sin(time) * 6, GROUND - 190 - (time * 20) % 40, 14, 0, 7); c.fill(); }
    c.restore();
    // hp bar
    const bw = 150;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect(x - bw / 2 - 3, GROUND - 320, bw + 6, 16, 5); c.fill();
    c.fillStyle = invulnerable ? '#a46cff' : pct > 0.5 ? '#5cc85c' : pct > 0.25 ? '#e8b730' : '#e0453a';
    c.beginPath(); c.roundRect(x - bw / 2, GROUND - 317, bw * Math.max(0, pct), 10, 4); c.fill();
  }

  drawUnit(u: Unit, b: Battle) {
    const c = this.ctx;
    const f = u.side === 0 ? 1 : -1;
    const gy = b.unitY ? b.unitY(u) : GROUND + u.lane;
    const groundY = GROUND + u.lane;
    c.save();
    // soft ground shadow (flying units too, so you can read their position)
    c.fillStyle = 'rgba(60,35,10,.22)';
    const sw = Math.min(70, u.def.height * 0.45) * (u.def.flying ? 0.7 : 1);
    c.beginPath(); c.ellipse(u.x, groundY + 2, sw, sw * 0.18, 0, 0, 7); c.fill();
    if (u === b.controlled) {
      c.strokeStyle = 'rgba(255,224,102,.85)'; c.lineWidth = 3; c.beginPath(); c.ellipse(u.x, groundY + 2, 26, 7, 0, 0, 7); c.stroke();
      c.fillStyle = '#ffe066';
      const my = gy - u.def.height - 30 + Math.sin(performance.now() / 150) * 4;
      c.beginPath(); c.moveTo(u.x, my + 12); c.lineTo(u.x - 9, my); c.lineTo(u.x + 9, my); c.closePath(); c.fill();
    }
    if (u.dead) {
      c.globalAlpha = Math.max(0, 1 - u.dead / 1.2);
      c.translate(u.x, groundY); c.rotate(-f * Math.min(1.5, u.dead * 4)); c.translate(-u.x, -groundY);
    }
    if (u.hitFlash > 0) c.filter = 'brightness(1.8)';
    const swing = u.moving ? Math.sin(u.anim) * 0.55 : 0;
    const atk = u.attacking > 0 ? Math.sin((1 - u.attacking / 0.3) * Math.PI) : 0;
    drawArt({ c, u, x: u.x, gy, f, t: performance.now() / 1000, swing, atk, side: u.side, region: b.level.region, flash: u.hitFlash > 0 });
    c.filter = 'none';
    if (u.healFx > 0) {
      c.fillStyle = `rgba(125,255,154,${u.healFx})`; c.font = 'bold 16px system-ui'; c.textAlign = 'center';
      c.fillText('+', u.x - 8, gy - u.def.height - 6 - (1 - u.healFx) * 14); c.fillText('+', u.x + 9, gy - u.def.height - (1 - u.healFx) * 20);
    }
    c.restore();
    this.hpBar(u, gy);
  }

  /** Renders a unit portrait for HUD buttons (reuses the in-game drawing code). */
  static icon(def: Unit['def'], size = 96, side: 0 | 1 = 0): string {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d')!;
    const h = def.flying ? def.height + 40 : def.height;
    const wide = ['camel', 'cavalry', 'lion', 'hyena', 'scorpking', 'worm', 'catapult', 'boss', 'elephant', 'cobra', 'cobraqueen'].includes(def.id) ? 1.5 : 1;
    const s = size / (Math.max(h * 1.25, 60 * wide) + 12);
    ctx.setTransform(s, 0, 0, s, size / 2 - 60 * s, size - (GROUND + 6) * s);
    const u: Unit = { uid: 0, def, side, x: 60 - (['camel', 'cavalry', 'elephant'].includes(def.id) ? 10 : 0), lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 1.2, moving: false, attacking: 0, chargeReady: false, calm: 0, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0 };
    const y = def.flying ? GROUND - 30 : GROUND;
    drawArt({ c: ctx, u, x: u.x, gy: y, f: side === 0 ? 1 : -1, t: 0, swing: 0, atk: 0, side, region: 'oasis', flash: false });
    return cv.toDataURL();
  }

  private hpBar(u: Unit, gy: number) {
    const c = this.ctx;
    if (u.rank && !u.dead) { c.fillStyle = '#ffe066'; c.font = '900 12px system-ui'; c.textAlign = 'center'; c.fillText('★'.repeat(u.rank), u.x, gy - u.def.height - 20); }
    if (u.dead || u.hp >= u.maxHp) return;
    const w = u.def.boss ? 100 : 32;
    const y = gy - u.def.height - 14;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 7);
    c.fillStyle = u.side === 0 ? '#5cc85c' : '#e0453a'; c.fillRect(u.x - w / 2, y, (w * Math.max(0, u.hp)) / u.maxHp, 5);
  }
}

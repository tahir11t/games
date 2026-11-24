import { Battle, W, H, GROUND, CASTLE_X, MINE_X, type Unit } from './battle';
import type { RegionId } from '../data/levels';
import { drawArt, glowDot, isLowQuality, shade as shadeHex } from './art';
import { UNITS, type EnemyId } from '../data/units';

const INK = '#16120e';
let TEAM = ['#e0a82e', '#9e1f1f'];

interface Theme { sky: [string, string, string]; far: string; mid: string; ground: [string, string]; grass?: string; sun: string; haze: string; night?: boolean }
const THEMES: Record<RegionId, Theme> = {
  oasis: { sky: ['#4fb3ea', '#9fd8f5', '#fdf1cf'], far: '#e3c07f', mid: '#86b85a', ground: ['#f2d79c', '#e2bd78'], grass: '#7fb34f', sun: '#fff6c8', haze: 'rgba(255,240,200,.25)' },
  dunes: { sky: ['#e8723c', '#f6a35e', '#ffe0a8'], far: '#c8643c', mid: '#b5532f', ground: ['#e6a768', '#cf8a4c'], sun: '#ffe9b0', haze: 'rgba(255,190,120,.25)' },
  mountains: { sky: ['#6fb6e2', '#b6dcf0', '#f2f4ea'], far: '#9a9488', mid: '#76a05a', ground: ['#c9b893', '#ad9a75'], grass: '#6f9a4e', sun: '#fffbe0', haze: 'rgba(230,240,250,.3)' },
  shadow: { sky: ['#0d1230', '#2a2658', '#5a4b7d'], far: '#262447', mid: '#34305c', ground: ['#948cab', '#7a7294'], sun: '#f3ecd0', haze: 'rgba(80,70,140,.2)', night: true },
  tombs: { sky: ['#3a2a4a', '#8a5a5a', '#e0a070'], far: '#7a5a48', mid: '#5c4436', ground: ['#c4a27a', '#a8865e'], sun: '#ffcf8a', haze: 'rgba(255,170,110,.18)' },
  forest: { sky: ['#3f9fd8', '#a8dcf0', '#e8f6e0'], far: '#5f9a5a', mid: '#3f7a3e', ground: ['#8fb862', '#6f9a48'], grass: '#4f8f3a', sun: '#fffbe0', haze: 'rgba(200,240,200,.25)' },
  graveyard: { sky: ['#1e2a2a', '#3f4f4a', '#7a8a78'], far: '#2f3a36', mid: '#3a4640', ground: ['#6a6f58', '#4f5442'], grass: '#4a5a3a', sun: '#d8e8c8', haze: 'rgba(160,190,160,.3)', night: true },
  tundra: { sky: ['#7fb2d8', '#c8e2f2', '#f4fbff'], far: '#c9d8e6', mid: '#a8bfd2', ground: ['#eef4f8', '#d2dee8'], sun: '#ffffff', haze: 'rgba(230,240,255,.35)' },
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
      const army = b.playerArmy.filter((u) => !u.def.miner);
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
    const low = isLowQuality();
    TEAM = ['#e0a82e', b.level.enemyColor ?? '#9e1f1f'];
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
      if (!low && th.grass && k % 3 === 0) { c.strokeStyle = th.grass; c.lineWidth = 2; const gx = x + (k % 40), gy2 = GROUND - 14 + (k % 12); c.beginPath(); c.moveTo(gx, gy2); c.lineTo(gx - 4, gy2 - 9); c.moveTo(gx, gy2); c.lineTo(gx + 1, gy2 - 12); c.moveTo(gx, gy2); c.lineTo(gx + 5, gy2 - 8); c.stroke(); }
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

    this.lastControlled = b.controlled;
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
      else if (p.kind === 'meteor') { glowDot(c, 0, 0, 16, '#ff9a3d', '#ffe0a0'); c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(4, 0, 10, 0, 7); c.fill(); c.fillStyle = 'rgba(255,160,60,.5)'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(-60, 0); c.lineTo(-10, 12); c.fill(); }
      else glowDot(c, 0, 0, 6, '#c77dff', '#f3e0ff');
      c.restore();
    }
    for (const bo of b.bolts) { // chain lightning
      c.strokeStyle = `rgba(190,230,255,${Math.min(1, bo.life * 5)})`; c.lineWidth = 3; c.beginPath(); c.moveTo(bo.x1, bo.y1);
      for (let k = 1; k < 6; k++) { const t2 = k / 6; c.lineTo(bo.x1 + (bo.x2 - bo.x1) * t2 + (Math.random() - 0.5) * 14, bo.y1 + (bo.y2 - bo.y1) * t2 + (Math.random() - 0.5) * 14); }
      c.lineTo(bo.x2, bo.y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
    }
    for (const p of b.particles) { c.globalAlpha = Math.max(0, p.life) * 0.9; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size / 2, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    for (const t of b.texts) { c.font = `900 ${t.size ?? 18}px system-ui, sans-serif`; c.globalAlpha = Math.min(1, t.life * 2); c.fillStyle = INK; c.fillText(t.text, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.text, t.x, t.y); }
    c.globalAlpha = 1;
    c.restore();

    // atmosphere: haze, storm, night tint, ability flash, vignette
    if (!low) {
    const hz = c.createLinearGradient(0, GROUND - 160, 0, GROUND);
    hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, th.haze);
    c.fillStyle = hz; c.fillRect(0, GROUND - 160, this.viewW, 160);
    }
    if (b.storm > 0) {
      c.fillStyle = `rgba(214,140,80,${0.08 + b.storm * 0.22})`;
      c.fillRect(0, 0, this.viewW, H);
      c.strokeStyle = `rgba(255,220,170,${0.25 * b.storm})`; c.lineWidth = 1.5;
      if (!low) for (let i = 0; i < 30; i++) { const sx = ((i * 137 + time * 380) % (this.viewW + 100)) - 50, sy = (i * 53) % H; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 30, sy + 4); c.stroke(); }
    }
    if (!low) this.weather(b.level.region, time);
    if (th.night) { c.fillStyle = 'rgba(20,16,50,.16)'; c.fillRect(0, 0, this.viewW, H); }
    if (b.abilityFx > 0) { c.fillStyle = `rgba(255,220,120,${b.abilityFx * 0.15})`; c.fillRect(0, 0, this.viewW, H); }
    if (b.buff > 0) { c.fillStyle = `rgba(255,120,40,${0.05 + Math.sin(time * 8) * 0.02})`; c.fillRect(0, 0, this.viewW, H); }
    if (low) return;
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
    if (!th.night && !isLowQuality()) {
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
    if (region === 'forest' || region === 'tundra' || region === 'graveyard') {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 190 + o2) % (W * 0.6) + W * 0.6) % (W * 0.6) - 100;
        if (x < -80 || x > vw + 80) continue;
        if (region === 'graveyard') this.deadTree(x, GROUND - 40, i);
        else this.pine(x, GROUND - 38, i, region === 'tundra');
      }
    }
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

  private pine(x: number, y: number, i: number, snow: boolean) {
    const c = this.ctx;
    const s = 0.8 + ((i * 37) % 10) / 20;
    c.fillStyle = '#5a3a22'; c.fillRect(x - 3 * s, y - 12 * s, 6 * s, 14 * s);
    for (let k = 0; k < 3; k++) {
      const w = (34 - k * 8) * s, top = y - (14 + k * 22) * s;
      c.fillStyle = k % 2 ? '#2f6a3a' : '#357a42';
      c.beginPath(); c.moveTo(x - w, top + 6); c.lineTo(x, top - 30 * s); c.lineTo(x + w, top + 6); c.closePath(); c.fill();
      if (snow) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - w * 0.5, top - 8 * s); c.lineTo(x, top - 30 * s); c.lineTo(x + w * 0.5, top - 8 * s); c.closePath(); c.fill(); }
    }
  }

  private deadTree(x: number, y: number, i: number) {
    const c = this.ctx;
    c.strokeStyle = '#2a2420'; c.lineCap = 'round';
    c.lineWidth = 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - 70); c.stroke();
    c.lineWidth = 3;
    for (const [dx, dy, ex, ey] of [[2, -40, -22, -62], [3, -55, 24, -80], [4, -66, -10, -92]]) { c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + ex, y + ey); c.stroke(); }
    if (i % 2) { // tombstone
      c.fillStyle = '#8a8f86'; c.strokeStyle = '#3a3a36'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + 30, y + 30); c.lineTo(x + 30, y + 8); c.arc(x + 40, y + 8, 10, Math.PI, 0); c.lineTo(x + 50, y + 30); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 40, y + 6); c.lineTo(x + 40, y + 20); c.moveTo(x + 35, y + 11); c.lineTo(x + 45, y + 11); c.stroke();
    }
  }

  private weather(region: RegionId, time: number) {
    const c = this.ctx;
    const vw = this.viewW;
    if (region === 'tundra') {
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 60; i++) { const x = ((i * 97 + Math.sin(time + i) * 20 - this.cam * 0.6) % vw + vw) % vw, y = ((i * 61 + time * (30 + (i % 5) * 8)) % H); c.beginPath(); c.arc(x, y, 1.5 + (i % 3) * 0.6, 0, 7); c.fill(); }
    } else if (region === 'forest') {
      for (let i = 0; i < 16; i++) { const x = ((i * 151 + Math.sin(time * 0.8 + i) * 40 - this.cam * 0.6) % vw + vw) % vw, y = ((i * 83 + time * (20 + (i % 4) * 6)) % H); c.fillStyle = i % 3 ? '#d98b2b' : '#8fbf3a'; c.save(); c.translate(x, y); c.rotate(time * 2 + i); c.beginPath(); c.ellipse(0, 0, 4, 2, 0, 0, 7); c.fill(); c.restore(); }
    } else if (region === 'graveyard') {
      c.fillStyle = 'rgba(190,210,190,.12)';
      for (let i = 0; i < 6; i++) { const x = ((i * 260 + time * 12 - this.cam * 0.3) % (vw + 300) + vw + 300) % (vw + 300) - 150; c.beginPath(); c.ellipse(x, GROUND - 20 + (i % 3) * 14, 140, 18, 0, 0, 7); c.fill(); }
    }
  }

  /** Civilization forts: same footprint (archer posts, gate) but a style of their own. */
  private factionFort(style: string, side: 0 | 1, f: number, G: number, wTop: number, tx0: number, tw: number, tTop: number, time: number, low: boolean) {
    const c = this.ctx;
    const team = TEAM[side];
    const stroke = (lw = 2.5, col = 'rgba(20,12,6,.8)') => { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };
    const grad = (a: string, b2: string, y0: number, y1: number) => { if (low) return a; const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b2); return g; };
    if (style === 'elves') {
      // a giant living tree with wooden platforms
      c.fillStyle = grad('#8a5f36', '#5a3a1e', tTop, G); c.beginPath();
      c.moveTo(-f * 140, G); c.quadraticCurveTo(-f * 120, G - 60, tx0 + tw * 0.2, G - 120); c.lineTo(tx0 + tw * 0.25, tTop + 10); c.lineTo(tx0 + tw * 0.8, tTop + 10); c.quadraticCurveTo(tx0 + tw * 0.9, G - 100, f * 30, G - 60); c.quadraticCurveTo(f * 90, G - 20, f * 110, G); c.closePath(); c.fill(); stroke();
      c.strokeStyle = 'rgba(40,20,5,.4)'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(tx0 + 14 + k * 12, tTop + 30); c.quadraticCurveTo(tx0 + 10 + k * 14, G - 90, tx0 - f * 20 + k * 16, G - 10); c.stroke(); }
      for (const [dx, dy, r] of [[0, -40, 70], [-60, -10, 50], [60, -10, 50], [-20, -80, 46], [40, -70, 44]] as [number, number, number][]) {
        c.fillStyle = low ? '#3f8f3a' : (() => { const g = c.createRadialGradient(tx0 + tw / 2 + dx - 15, tTop + dy - 15, 5, tx0 + tw / 2 + dx, tTop + dy, r); g.addColorStop(0, '#6fc25a'); g.addColorStop(1, '#2f7a32'); return g; })();
        c.beginPath(); c.arc(tx0 + tw / 2 + dx, tTop + dy + Math.sin(time + dx) * 2, r, 0, 7); c.fill(); stroke(2, 'rgba(20,50,20,.6)');
      }
      for (const [y, w] of [[wTop, 200], [tTop - 6, tw + 30]] as [number, number][]) { const x0 = y === wTop ? -100 : tx0 - 15; c.fillStyle = '#9a6a3a'; c.fillRect(x0, y - 4, w, 10); c.strokeStyle = 'rgba(40,20,5,.7)'; c.lineWidth = 2; c.strokeRect(x0, y - 4, w, 10); for (let k = x0 + 6; k < x0 + w; k += 18) { c.beginPath(); c.moveTo(k, y + 6); c.lineTo(k - 6, y + 34); c.stroke(); } }
      c.fillStyle = '#2a1a0c'; c.beginPath(); c.ellipse(f * 18, G - 30, 26, 32, 0, Math.PI, 0); c.lineTo(f * 18 + 26, G); c.lineTo(f * 18 - 26, G); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,240,160,.5)'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(-80 + k * 32 + Math.sin(time * 2 + k) * 6, wTop - 30 + Math.cos(time * 1.7 + k) * 10, 2.5, 0, 7); c.fill(); }
    } else if (style === 'ghosts') {
      // dark gothic keep with spires and violet light
      c.fillStyle = grad('#3a3450', '#221e30', wTop, G); c.fillRect(-100, wTop, 200, G - wTop); c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 2.5; c.strokeRect(-100, wTop, 200, G - wTop);
      c.fillStyle = grad('#423a5c', '#221e30', tTop, G); c.fillRect(tx0, tTop, tw, G - tTop); c.strokeRect(tx0, tTop, tw, G - tTop);
      for (const [x0, w, y] of [[tx0 - 6, tw + 12, tTop], [-100, 40, wTop], [60, 40, wTop]] as [number, number, number][]) { c.fillStyle = '#2a2440'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w / 2, y - (w > 50 ? 90 : 50)); c.lineTo(x0 + w, y); c.closePath(); c.fill(); stroke(); }
      c.fillStyle = 'rgba(180,140,255,.9)'; for (const [wx, wy] of [[tx0 + tw / 2, tTop + 50], [tx0 + tw / 2, tTop + 120], [-60, wTop + 40], [50, wTop + 40]]) { c.beginPath(); c.moveTo(wx - 6, wy + 16); c.lineTo(wx - 6, wy); c.lineTo(wx, wy - 8); c.lineTo(wx + 6, wy); c.lineTo(wx + 6, wy + 16); c.closePath(); c.fill(); }
      c.fillStyle = '#120e1c'; c.beginPath(); c.moveTo(f * 18 - 26, G); c.lineTo(f * 18 - 26, G - 50); c.lineTo(f * 18, G - 84); c.lineTo(f * 18 + 26, G - 50); c.lineTo(f * 18 + 26, G); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,90,200,.6)'; c.lineWidth = 2; for (let k = -18; k <= 18; k += 9) { c.beginPath(); c.moveTo(f * 18 + k, G); c.lineTo(f * 18 + k, G - 60); c.stroke(); }
      if (!low) for (let k = 0; k < 3; k++) { const wx = Math.sin(time * 0.8 + k * 2) * 80, wy = wTop - 40 - k * 30 + Math.cos(time + k) * 8; c.fillStyle = 'rgba(200,220,255,.35)'; c.beginPath(); c.arc(wx, wy, 9, 0, 7); c.fill(); }
    } else if (style === 'zombies') {
      // rotting palisade with skulls and a green cauldron
      for (let k = -100; k < 100; k += 16) { const hgt = 120 + ((k * 13) % 30); c.fillStyle = k % 32 ? '#5a4a34' : '#4a3c2a'; c.beginPath(); c.moveTo(k, G); c.lineTo(k, G - hgt); c.lineTo(k + 8, G - hgt - 14); c.lineTo(k + 16, G - hgt); c.lineTo(k + 16, G); c.closePath(); c.fill(); stroke(1.5); }
      for (let k = tx0; k < tx0 + tw; k += 15) { const hgt = 220 + ((k * 7) % 20); c.fillStyle = '#4a3c2a'; c.beginPath(); c.moveTo(k, G); c.lineTo(k, G - hgt); c.lineTo(k + 7, G - hgt - 14); c.lineTo(k + 15, G - hgt); c.lineTo(k + 15, G); c.closePath(); c.fill(); stroke(1.5); }
      c.fillStyle = '#5a4a34'; c.fillRect(tx0 - 8, tTop - 6, tw + 16, 10); c.fillRect(-104, wTop - 4, 208, 9);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 4; c.beginPath(); c.moveTo(-100, G - 40); c.lineTo(100, G - 50); c.moveTo(-100, G - 90); c.lineTo(100, G - 84); c.stroke();
      for (const [sx, sy] of [[-70, G - 60], [-20, G - 108], [40, G - 66], [80, G - 112]]) { c.fillStyle = '#ece6d6'; c.beginPath(); c.arc(sx, sy, 8, 0, 7); c.fill(); c.fillStyle = '#1b1b1b'; c.fillRect(sx - 4, sy - 2, 3, 3); c.fillRect(sx + 1, sy - 2, 3, 3); }
      c.fillStyle = '#1a140c'; c.fillRect(f * 18 - 24, G - 70, 48, 70);
      c.fillStyle = '#2a2a2a'; c.beginPath(); c.ellipse(f * 70, G - 12, 22, 14, 0, 0, 7); c.fill();
      c.fillStyle = '#7dff5c'; c.beginPath(); c.ellipse(f * 70, G - 22, 18, 5, 0, 0, 7); c.fill();
      if (!low) for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(125,255,92,.35)'; c.beginPath(); c.arc(f * 70 + Math.sin(time * 2 + k) * 6, G - 30 - ((time * 20 + k * 15) % 45), 5, 0, 7); c.fill(); }
    } else if (style === 'dwarves') {
      // stone hall carved into the mountain, iron gate, chimney smoke
      c.fillStyle = grad('#8a8478', '#5e5a52', tTop - 60, G); c.beginPath(); c.moveTo(-f * 150, G); c.lineTo(-f * 140, tTop + 20); c.lineTo(tx0 + tw / 2, tTop - 60); c.lineTo(f * 40, wTop - 40); c.lineTo(f * 120, wTop + 30); c.lineTo(f * 125, G); c.closePath(); c.fill(); stroke();
      c.fillStyle = grad('#a8a294', '#7a756a', wTop, G); c.fillRect(-90, wTop + 10, 180, G - wTop - 10); c.strokeStyle = 'rgba(30,25,20,.7)'; c.lineWidth = 2.5; c.strokeRect(-90, wTop + 10, 180, G - wTop - 10);
      c.strokeStyle = 'rgba(40,35,30,.35)'; c.lineWidth = 1.5; for (let y = wTop + 30; y < G; y += 22) { c.beginPath(); c.moveTo(-90, y); c.lineTo(90, y); c.stroke(); }
      c.fillStyle = '#3a3f46'; c.beginPath(); c.moveTo(f * 18 - 30, G); c.lineTo(f * 18 - 30, G - 70); c.lineTo(f * 18 + 30, G - 70); c.lineTo(f * 18 + 30, G); c.closePath(); c.fill(); stroke();
      c.strokeStyle = '#c9a24a'; c.lineWidth = 3; for (const y of [G - 20, G - 50]) { c.beginPath(); c.moveTo(f * 18 - 30, y); c.lineTo(f * 18 + 30, y); c.stroke(); }
      c.save(); c.translate(f * 18, G - 86); c.rotate(time * 0.6); c.fillStyle = '#c9a24a'; for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.fillRect(-3, -16, 6, 7); } c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill(); c.restore();
      c.fillStyle = '#5e5a52'; c.fillRect(tx0 + tw * 0.6, tTop - 30, 14, 40);
      if (!low) for (let k = 0; k < 3; k++) { const t2 = (time * 18 + k * 20) % 60; c.fillStyle = `rgba(90,90,90,${0.4 - t2 / 180})`; c.beginPath(); c.arc(tx0 + tw * 0.6 + 7 + Math.sin(time + k) * 5, tTop - 40 - t2, 8 + t2 * 0.2, 0, 7); c.fill(); }
      c.fillStyle = '#ffb347'; for (const wx of [-60, 56]) c.fillRect(wx - 5, wTop + 40, 10, 14);
      c.fillStyle = '#7a756a'; c.fillRect(tx0 - 6, tTop - 6, tw + 12, 10); c.fillRect(-96, wTop + 4, 192, 10);
    } else {
      // giants: ice fortress with icicles and boulders
      c.fillStyle = grad('#d8eefc', '#9ec4e0', wTop, G); c.fillRect(-100, wTop, 200, G - wTop); c.strokeStyle = 'rgba(40,80,120,.6)'; c.lineWidth = 2.5; c.strokeRect(-100, wTop, 200, G - wTop);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; for (let y = wTop + 20; y < G; y += 26) { c.beginPath(); c.moveTo(-100, y); c.lineTo(100, y); c.stroke(); for (let x2 = -100 + ((y / 26) % 2) * 25; x2 < 100; x2 += 50) { c.beginPath(); c.moveTo(x2, y - 26); c.lineTo(x2, y); c.stroke(); } }
      c.fillStyle = grad('#e4f4ff', '#a8cce6', tTop, G); c.beginPath(); c.moveTo(tx0 - 4, G); c.lineTo(tx0 + 6, tTop); c.lineTo(tx0 + tw - 6, tTop); c.lineTo(tx0 + tw + 4, G); c.closePath(); c.fill(); c.strokeStyle = 'rgba(40,80,120,.6)'; c.stroke();
      c.fillStyle = 'rgba(230,248,255,.95)'; for (let k = -98; k < 100; k += 14) { const L = 8 + ((k * 31) % 14); c.beginPath(); c.moveTo(k, wTop); c.lineTo(k + 5, wTop + L); c.lineTo(k + 10, wTop); c.closePath(); c.fill(); }
      for (let k = tx0; k < tx0 + tw; k += 12) { const L = 6 + ((k * 17) % 12); c.beginPath(); c.moveTo(k, tTop + 4); c.lineTo(k + 4, tTop + 4 + L); c.lineTo(k + 8, tTop + 4); c.closePath(); c.fill(); }
      c.fillStyle = '#1e3a5a'; c.beginPath(); c.moveTo(f * 18 - 28, G); c.lineTo(f * 18 - 28, G - 56); c.quadraticCurveTo(f * 18, G - 90, f * 18 + 28, G - 56); c.lineTo(f * 18 + 28, G); c.closePath(); c.fill();
      for (const [bx, r] of [[-f * 120, 26], [f * 105, 20], [f * 80, 14]] as [number, number][]) { c.fillStyle = low ? '#8d8578' : (() => { const g = c.createRadialGradient(bx - r * 0.3, G - r - r * 0.3, 2, bx, G - r, r); g.addColorStop(0, '#b0a898'); g.addColorStop(1, '#6e665a'); return g; })(); c.beginPath(); c.arc(bx, G - r + 4, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(30,25,20,.6)'; c.lineWidth = 2; c.stroke(); }
      c.fillStyle = '#c8e2f2'; c.fillRect(tx0 - 6, tTop - 6, tw + 12, 10); c.fillRect(-104, wTop - 6, 208, 10);
    }
    // team banner hanging on the wall
    c.fillStyle = team; c.beginPath(); c.moveTo(f * 55 - 11, wTop + 8); c.lineTo(f * 55 + 11, wTop + 8); c.lineTo(f * 55 + 11, wTop + 60); c.lineTo(f * 55, wTop + 50); c.lineTo(f * 55 - 11, wTop + 60); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.5; c.stroke();
    // flag on the tower
    c.strokeStyle = '#2a1a0c'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx0 + tw / 2, tTop - 20); c.lineTo(tx0 + tw / 2, tTop - 82); c.stroke();
    const wv = Math.sin(time * 5 + side) * 4;
    c.fillStyle = team; c.beginPath(); c.moveTo(tx0 + tw / 2, tTop - 82); c.quadraticCurveTo(tx0 + tw / 2 + f * 22, tTop - 80 + wv, tx0 + tw / 2 + f * 44, tTop - 72 + wv); c.lineTo(tx0 + tw / 2, tTop - 58); c.closePath(); c.fill();
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
    const low = isLowQuality();
    const wall = region === 'shadow' ? '#7a7290' : region === 'mountains' ? '#b5a588' : region === 'tombs' ? '#bf9d6e' : region === 'forest' ? '#a88a62' : region === 'graveyard' ? '#7d7f74' : region === 'tundra' ? '#b8c4cc' : '#d4a46a';
    const light = shadeHex(wall, 0.18), dark = shadeHex(wall, -0.3), deep = shadeHex(wall, -0.55);
    const sink = (1 - pct) * 26;
    const G = GROUND;
    c.save();
    c.translate(x, sink);
    c.lineJoin = 'round';
    // soft contact shadow
    c.fillStyle = 'rgba(40,25,10,.25)'; c.beginPath(); c.ellipse(0, G + 4, 130, 12, 0, 0, 7); c.fill();

    const mudFill = (x0: number, x1: number, y0: number, y1: number) => {
      if (low) return wall;
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, f > 0 ? light : dark); g.addColorStop(0.55, wall); g.addColorStop(1, f > 0 ? dark : light);
      void y0; void y1;
      return g;
    };
    const plaster = (x0: number, y0: number, w: number, h: number) => {
      if (low) return;
      for (let i = 0; i < w * h / 600; i++) {
        const k = (i * 7919 + x0 * 31) % 997;
        c.fillStyle = k % 2 ? 'rgba(255,240,210,.12)' : 'rgba(80,50,20,.1)';
        c.fillRect(x0 + (k % w), y0 + ((k * 13) % h), 3 + (k % 4), 2);
      }
    };
    const beams = (x0: number, x1: number, y: number) => { // protruding wooden beam ends
      for (let bx = x0 + 10; bx < x1 - 6; bx += 22) {
        c.fillStyle = '#6b4423'; c.fillRect(bx, y, 7, 5);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(bx, y + 5, 7, 4);
      }
    };
    const merlons = (x0: number, x1: number, y: number, size: number, broken: number) => { // stepped Arabian battlements
      for (let mx = x0, i = 0; mx < x1 - size * 0.6; mx += size * 1.35, i++) {
        if (broken && ((i * 37) % 10) / 10 < broken) continue;
        c.fillStyle = wall; c.strokeStyle = deep; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(mx, y); c.lineTo(mx, y - size * 0.45); c.lineTo(mx + size * 0.2, y - size * 0.45); c.lineTo(mx + size * 0.2, y - size * 0.8); c.lineTo(mx + size * 0.5, y - size * 1.1);
        c.lineTo(mx + size * 0.8, y - size * 0.8); c.lineTo(mx + size * 0.8, y - size * 0.45); c.lineTo(mx + size, y - size * 0.45); c.lineTo(mx + size, y); c.closePath(); c.fill(); c.stroke();
      }
    };

    const style = side === 0 ? this.playerArmy : (b.level.faction ?? 'desert');
    const wx0 = -100, wx1 = 100, wTop = G - 140;
    const tw = 76, tx0 = -f * 82 - tw / 2, tTop = G - 230;
    if (style !== 'desert') this.factionFort(style, side, f, G, wTop, tx0, tw, tTop, time, low);
    else {
    // ---- main wall (slightly tapered) ----
    c.beginPath(); c.moveTo(wx0 - 6, G); c.lineTo(wx0, wTop); c.lineTo(wx1, wTop); c.lineTo(wx1 + 6, G); c.closePath();
    c.fillStyle = mudFill(wx0, wx1, wTop, G); c.fill(); c.strokeStyle = deep; c.lineWidth = 2.5; c.stroke();
    plaster(wx0, wTop, 200, 140);
    beams(wx0, wx1, wTop + 18);
    beams(wx0, wx1, wTop + 70);
    // stone foundation
    for (let sx = wx0 - 6, i = 0; sx < wx1 + 6; sx += 24, i++) {
      c.fillStyle = i % 2 ? '#9a9286' : '#a89f92'; c.strokeStyle = 'rgba(40,30,20,.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(sx, G - 20, 23, 20, 3); c.fill(); c.stroke();
    }
    merlons(wx0, wx1, wTop, 20, pct < 0.5 ? (0.5 - pct) * 1.6 : 0);
    // hanging team banner
    const bx = f * 55;
    c.fillStyle = TEAM[side];
    const sway = Math.sin(time * 2 + side) * 2;
    c.beginPath(); c.moveTo(bx - 12, wTop + 8); c.lineTo(bx + 12, wTop + 8); c.lineTo(bx + 12 + sway, wTop + 70); c.lineTo(bx + sway, wTop + 60); c.lineTo(bx - 12 + sway, wTop + 70); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(255,240,200,.85)'; c.beginPath(); c.arc(bx + sway * 0.5, wTop + 34, 6, 0, 7); c.fill();
    c.fillStyle = TEAM[side]; c.beginPath(); c.arc(bx + sway * 0.5 + 2, wTop + 32, 4.5, 0, 7); c.fill(); // crescent-like emblem
    c.fillStyle = '#6b4423'; c.fillRect(bx - 15, wTop + 5, 30, 4);

    // ---- gate: stone pointed arch with studded doors ----
    const gx = f * 18, gw = 30, gh = 78;
    c.fillStyle = '#9a9286'; c.strokeStyle = 'rgba(40,30,20,.6)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(gx - gw - 8, G); c.lineTo(gx - gw - 8, G - gh + 18); c.quadraticCurveTo(gx - gw - 8, G - gh - 18, gx, G - gh - 30); c.quadraticCurveTo(gx + gw + 8, G - gh - 18, gx + gw + 8, G - gh + 18); c.lineTo(gx + gw + 8, G); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a1a10';
    c.beginPath(); c.moveTo(gx - gw, G); c.lineTo(gx - gw, G - gh + 18); c.quadraticCurveTo(gx - gw, G - gh - 10, gx, G - gh - 20); c.quadraticCurveTo(gx + gw, G - gh - 10, gx + gw, G - gh + 18); c.lineTo(gx + gw, G); c.closePath(); c.fill();
    const dg = low ? '#7a4a24' : (() => { const g = c.createLinearGradient(gx - gw, 0, gx + gw, 0); g.addColorStop(0, '#5e381a'); g.addColorStop(0.5, '#8a5428'); g.addColorStop(1, '#5e381a'); return g; })();
    c.fillStyle = dg; c.beginPath(); c.moveTo(gx - gw + 3, G); c.lineTo(gx - gw + 3, G - gh + 18); c.quadraticCurveTo(gx - gw + 3, G - gh - 6, gx, G - gh - 16); c.quadraticCurveTo(gx + gw - 3, G - gh - 6, gx + gw - 3, G - gh + 18); c.lineTo(gx + gw - 3, G); c.closePath(); c.fill();
    c.strokeStyle = '#3a2210'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx, G); c.lineTo(gx, G - gh - 14); c.stroke();
    c.fillStyle = '#3a3a3a'; for (const yy of [G - 18, G - 48]) c.fillRect(gx - gw + 3, yy, gw * 2 - 6, 4); // iron bands
    c.fillStyle = '#d0b060'; for (let sy = G - gh + 22; sy < G - 6; sy += 12) for (const sxx of [-18, -8, 8, 18]) { c.beginPath(); c.arc(gx + sxx, sy, 1.6, 0, 7); c.fill(); }
    c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(gx - 6, G - 34, 3, 0, 7); c.arc(gx + 6, G - 34, 3, 0, 7); c.fill();
    // torches with flickering light
    for (const tx of [gx - gw - 18, gx + gw + 18]) {
      const fl = 0.8 + Math.sin(time * 13 + tx) * 0.12 + Math.sin(time * 7.3) * 0.08;
      if (!low) { const lg = c.createRadialGradient(tx, G - 72, 2, tx, G - 72, 40 * fl); lg.addColorStop(0, 'rgba(255,190,90,.45)'); lg.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = lg; c.fillRect(tx - 45, G - 117, 90, 90); }
      c.fillStyle = '#4a2f18'; c.fillRect(tx - 2, G - 70, 4, 18);
      c.fillStyle = '#ff9a2d'; c.beginPath(); c.ellipse(tx, G - 76, 4 * fl, 8 * fl, 0, 0, 7); c.fill();
      c.fillStyle = '#ffe08a'; c.beginPath(); c.ellipse(tx, G - 74, 2, 4 * fl, 0, 0, 7); c.fill();
    }
    // small arched windows
    for (const wxp of [-60, 62]) { c.fillStyle = side === 0 && region === 'shadow' ? '#ffd27a' : '#2a1a10'; c.beginPath(); c.moveTo(wxp - 6, wTop + 58); c.lineTo(wxp - 6, wTop + 46); c.quadraticCurveTo(wxp, wTop + 36, wxp + 6, wTop + 46); c.lineTo(wxp + 6, wTop + 58); c.closePath(); c.fill(); }

    // ---- tower (tapered) at the back ----
    c.beginPath(); c.moveTo(tx0 - 4, G); c.lineTo(tx0 + 4, tTop); c.lineTo(tx0 + tw - 4, tTop); c.lineTo(tx0 + tw + 4, G); c.closePath();
    c.fillStyle = mudFill(tx0, tx0 + tw, tTop, G); c.fill(); c.strokeStyle = deep; c.lineWidth = 2.5; c.stroke();
    plaster(tx0, tTop, tw, 230);
    beams(tx0, tx0 + tw, tTop + 26); beams(tx0, tx0 + tw, tTop + 110);
    for (const yy of [tTop + 50, tTop + 140]) { c.fillStyle = '#1e140c'; c.fillRect(tx0 + tw / 2 - 3, yy, 6, 20); } // arrow slits
    // wooden balcony
    c.fillStyle = '#7a4f28'; c.strokeStyle = '#3a2210'; c.lineWidth = 1.5;
    const bxx = tx0 + (f > 0 ? tw - 8 : -22);
    c.fillRect(bxx, tTop + 72, 30, 26); c.strokeRect(bxx, tTop + 72, 30, 26);
    c.strokeStyle = 'rgba(40,20,5,.7)'; for (let k = 4; k < 30; k += 6) { c.beginPath(); c.moveTo(bxx + k, tTop + 74); c.lineTo(bxx + k, tTop + 96); c.stroke(); }
    // tower top platform
    c.fillStyle = dark; c.fillRect(tx0 - 4, tTop - 6, tw + 8, 8);
    merlons(tx0 - 4, tx0 + tw + 4, tTop - 6, 16, pct < 0.35 ? (0.35 - pct) * 2 : 0);
    // flag pole
    c.strokeStyle = '#3a2210'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx0 + tw / 2, tTop - 20); c.lineTo(tx0 + tw / 2, tTop - 82); c.stroke();
    c.fillStyle = TEAM[side];
    const wv = Math.sin(time * 5 + side) * 4;
    c.beginPath(); c.moveTo(tx0 + tw / 2, tTop - 82); c.quadraticCurveTo(tx0 + tw / 2 + f * 22, tTop - 80 + wv, tx0 + tw / 2 + f * 44, tTop - 72 + wv); c.lineTo(tx0 + tw / 2, tTop - 58); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.5; c.stroke();

    }
    // ---- fort archers: tower top + wall posts for extra ones ----
    if (pct > 0) {
      const posts: [number, number][] = [[tx0 + tw / 2, tTop - 6], [f * -20, wTop], [f * 70, wTop]];
      const atk = b.towerShot[side] > 0 ? Math.sin((1 - b.towerShot[side] / 0.3) * Math.PI) : 0;
      for (let k = 0; k < b.towerArchers[side]; k++) {
        const [ax, ay] = posts[k];
        const towerDef = UNITS[({ elves: 'elfarcher', ghosts: 'banshee', zombies: 'skelarcher', dwarves: 'axethrower' } as Record<string, EnemyId>)[style] ?? 'archer'];
        const a: Unit = { uid: 990 + side * 3 + k, def: towerDef, side, x: ax, lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: k, moving: false, attacking: 0, chargeReady: false, calm: 0, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0, summonCd: 0, stun: 0, stompCd: 0, tier: side === 0 ? Math.min(4, b.perks.passives.towers + 1) : 1 };
        c.save(); c.translate(ax, ay); c.scale(0.8, 0.8); c.translate(-ax, -ay - 4);
        drawArt({ c, u: a, x: ax, gy: ay, f, t: time + k, swing: 0, atk, side, region, flash: false, tier: a.tier });
        c.restore();
        // wall cover in front of the archer's legs
        c.fillStyle = wall; c.fillRect(ax - 12, ay - 14, 24, 14); c.strokeStyle = deep; c.lineWidth = 1.5; c.strokeRect(ax - 12, ay - 14, 24, 14);
      }
    }

    // ---- damage: cracks, holes, fire and smoke ----
    c.strokeStyle = 'rgba(40,20,5,.75)'; c.lineWidth = 2;
    if (pct < 0.75) { c.beginPath(); c.moveTo(-40, wTop); c.lineTo(-30, wTop + 40); c.lineTo(-44, wTop + 70); c.lineTo(-36, wTop + 100); c.stroke(); }
    if (pct < 0.55) { c.beginPath(); c.moveTo(70, wTop + 10); c.lineTo(58, wTop + 60); c.lineTo(72, wTop + 96); c.stroke(); c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(-70, wTop + 30, 12, 9, 0.3, 0, 7); c.fill(); }
    if (pct < 0.35) {
      c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(40, wTop + 100, 16, 11, -0.2, 0, 7); c.fill();
      c.fillStyle = 'rgba(70,45,25,.6)'; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(-90 + k * 30 + (k % 2) * 8, G - 4, 5 + (k % 3) * 2, 0, 7); c.fill(); }
    }
    if (pct < 0.3) {
      for (let k = 0; k < 3; k++) {
        const fxp = -50 + k * 45, fyp = wTop - 4, fl = Math.sin(time * 10 + k * 2) * 3;
        c.fillStyle = 'rgba(255,120,30,.85)'; c.beginPath(); c.moveTo(fxp - 9, fyp); c.quadraticCurveTo(fxp - 4, fyp - 20 - fl, fxp, fyp - 30 - fl); c.quadraticCurveTo(fxp + 6, fyp - 18, fxp + 9, fyp); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,220,100,.9)'; c.beginPath(); c.ellipse(fxp, fyp - 7, 3.5, 7, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(70,65,60,.35)'; c.beginPath(); c.arc(fxp + Math.sin(time + k) * 8, fyp - 40 - ((time * 25 + k * 30) % 60), 12 + ((time * 25 + k * 30) % 60) * 0.2, 0, 7); c.fill();
      }
    }
    c.restore();
    // hp bar
    const bw = 160;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect(x - bw / 2 - 3, G - 340, bw + 6, 16, 5); c.fill();
    c.fillStyle = invulnerable ? '#a46cff' : pct > 0.5 ? '#5cc85c' : pct > 0.25 ? '#e8b730' : '#e0453a';
    c.beginPath(); c.roundRect(x - bw / 2, G - 337, bw * Math.max(0, pct), 10, 4); c.fill();
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
    // team ring at the feet (sides stay readable even in mirror matches)
    if (!u.dead) { c.strokeStyle = TEAM[u.side]; c.globalAlpha = 0.55; c.lineWidth = 2; c.beginPath(); c.ellipse(u.x, groundY + 2, Math.min(26, sw * 0.8), Math.min(6, sw * 0.16), 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
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
    const swing = u.moving ? Math.sin(u.anim) * 0.55 : 0;
    const atk = u.attacking > 0 ? Math.sin((1 - u.attacking / 0.3) * Math.PI) : 0;
    // a new tier (every 5 upgrade levels) also makes the unit a little bigger
    const grow = 1 + (u.tier ?? 0) * 0.035;
    if (grow !== 1) { c.translate(u.x, groundY); c.scale(grow, grow); c.translate(-u.x, -groundY); }
    drawArt({ c, u, x: u.x, gy, f, t: performance.now() / 1000, swing, atk, side: u.side, region: b.level.region, flash: u.hitFlash > 0, tier: u.tier });
    // hit flash: a quick white impact burst (canvas filters stall mobile GPUs)
    if (u.hitFlash > 0) { c.globalAlpha = Math.min(1, u.hitFlash * 6) * 0.7; c.fillStyle = '#fff'; c.beginPath(); c.arc(u.x, gy - u.def.height * 0.55, Math.min(18, u.def.height * 0.2), 0, 7); c.fill(); c.globalAlpha = 1; }
    if (u.healFx > 0) {
      c.fillStyle = `rgba(125,255,154,${u.healFx})`; c.font = 'bold 16px system-ui'; c.textAlign = 'center';
      c.fillText('+', u.x - 8, gy - u.def.height - 6 - (1 - u.healFx) * 14); c.fillText('+', u.x + 9, gy - u.def.height - (1 - u.healFx) * 20);
    }
    c.restore();
    this.hpBar(u, gy);
  }

  /** Renders a unit portrait for HUD buttons (reuses the in-game drawing code). */
  static icon(def: Unit['def'], size = 96, side: 0 | 1 = 0, tier = 0): string {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d')!;
    const h = def.flying ? def.height + 40 : def.height;
    const wide = ['camel', 'cavalry', 'lion', 'hyena', 'scorpking', 'worm', 'catapult', 'boss', 'elephant', 'cobra', 'cobraqueen'].includes(def.id) ? 1.5 : 1;
    const s = size / (Math.max(h * 1.25, 60 * wide) + 12);
    ctx.setTransform(s, 0, 0, s, size / 2 - 60 * s, size - (GROUND + 6) * s);
    const u: Unit = { uid: 0, def, side, x: 60 - (['camel', 'cavalry', 'elephant'].includes(def.id) ? 10 : 0), lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 1.2, moving: false, attacking: 0, chargeReady: false, calm: 0, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0, summonCd: 0, stun: 0, stompCd: 0, tier };
    const y = def.flying ? GROUND - 30 : GROUND;
    drawArt({ c: ctx, u, x: u.x, gy: y, f: side === 0 ? 1 : -1, t: 1, swing: 0, atk: 0, side, region: 'oasis', flash: false, tier });
    return cv.toDataURL();
  }

  showHp = true;
  playerArmy = 'desert';
  lastControlled: Unit | null = null;
  private hpBar(u: Unit, gy: number) {
    const c = this.ctx;
    if (this.showHp && !u.dead && (!u.def.miner || u.hp < u.maxHp)) {
      // always-on health readout: small bar + number
      const w = u.def.boss ? 100 : 34;
      const y = gy - u.def.height * (1 + (u.tier ?? 0) * 0.035) - 14;
      const pct = Math.max(0, u.hp) / u.maxHp;
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 6);
      c.fillStyle = u.side === 0 ? (pct > 0.35 ? '#5cc85c' : '#e8b730') : '#e0453a'; c.fillRect(u.x - w / 2, y, w * pct, 4);
      c.font = '800 10px system-ui, sans-serif'; c.textAlign = 'center';
      // number when hurt (and always for bosses / the unit you control) to keep crowds readable
      if (u.hp < u.maxHp - 0.5 || u.def.boss || u === this.lastControlled) {
        const txt = String(Math.ceil(Math.max(0, u.hp)));
        c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(txt, u.x + 0.8, y - 2.2);
        c.fillStyle = '#fff'; c.fillText(txt, u.x, y - 3);
      }
      if (u.rank) { c.fillStyle = '#ffe066'; c.font = '900 11px system-ui'; c.fillText('★'.repeat(u.rank), u.x, y - 14); }
      return;
    }
    if (u.rank && !u.dead) { c.fillStyle = '#ffe066'; c.font = '900 12px system-ui'; c.textAlign = 'center'; c.fillText('★'.repeat(u.rank), u.x, gy - u.def.height - 20); }
    if (u.dead || u.hp >= u.maxHp) return;
    const w = u.def.boss ? 100 : 32;
    const y = gy - u.def.height - 14;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 7);
    c.fillStyle = u.side === 0 ? '#5cc85c' : '#e0453a'; c.fillRect(u.x - w / 2, y, (w * Math.max(0, u.hp)) / u.maxHp, 5);
  }
}

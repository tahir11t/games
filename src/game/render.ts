import { Battle, W, H, GROUND, CASTLE_X, MINE_X, type Unit } from './battle';
import type { RegionId } from '../data/levels';
import { drawArt } from './art';

const INK = '#16120e';
const TEAM = ['#e0a82e', '#9e1f1f'];

interface Theme { sky: [string, string]; far: string; mid: string; ground: string; ground2: string; }
const THEMES: Record<RegionId, Theme> = {
  oasis: { sky: ['#5fbff0', '#d8f1ff'], far: '#e3c07f', mid: '#8fbf5a', ground: '#f0d394', ground2: '#9cc864' },
  dunes: { sky: ['#f08a4b', '#ffd79a'], far: '#c8643c', mid: '#b5532f', ground: '#dc9a5e', ground2: '#c47f45' },
  mountains: { sky: ['#7ec4e8', '#eef6f0'], far: '#9a9488', mid: '#7aa05a', ground: '#bfae8e', ground2: '#a79574' },
  shadow: { sky: ['#141a38', '#4a3f6b'], far: '#2a2748', mid: '#3a3560', ground: '#8f87a6', ground2: '#7a7294' },
};

export class Renderer {
  cam = 0;
  scale = 1;
  viewW = 960;
  follow = true;
  private stars: { x: number; y: number; r: number }[] = [];

  constructor(private canvas: HTMLCanvasElement, private ctx = canvas.getContext('2d')!) {
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * 260, r: Math.random() * 1.6 + 0.3 });
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
    c.setTransform(1, 0, 0, 1, 0, 0);
    const sk = c.createLinearGradient(0, 0, 0, this.canvas.height);
    sk.addColorStop(0, th.sky[0]); sk.addColorStop(1, th.sky[1]);
    c.fillStyle = sk;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shx = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 14 : 0;
    const shy = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 8 : 0;
    c.setTransform(this.scale, 0, 0, this.scale, shx * this.scale, shy * this.scale);

    this.drawBackdrop(b.level.region, th);

    c.save();
    c.translate(-this.cam, 0);
    // ground
    c.fillStyle = th.ground;
    c.fillRect(-50, GROUND - 24, W + 100, H - GROUND + 40);
    c.fillStyle = th.ground2;
    for (let x = 0; x < W; x += 90) c.fillRect(x + ((x * 7) % 40), GROUND + 28 + ((x * 13) % 30), 34, 4);

    this.drawMine(MINE_X[0]);
    this.drawMine(MINE_X[1]);
    this.drawCastle(0, b.castleHp[0] / b.castleMax[0], b.level.region);
    this.drawCastle(1, isFinite(b.castleHp[1]) ? b.castleHp[1] / b.castleMax[1] : 1, b.level.region, !isFinite(b.castleHp[1]));

    // formation marker
    const markX = b.mode === 'defend' ? CASTLE_X[0] + 220 : b.mode === 'hold' ? W / 2 - 80 : -1;
    if (markX > 0) {
      c.strokeStyle = 'rgba(224,168,46,.55)'; c.lineWidth = 3; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(markX, GROUND - 120); c.lineTo(markX, GROUND + 20); c.stroke(); c.setLineDash([]);
    }

    const sorted = [...b.units].sort((a, z) => a.lane - z.lane);
    for (const u of sorted) this.drawUnit(u, b);

    for (const p of b.projectiles) {
      c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
      if (p.kind === 'arrow') { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = INK; c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3); c.lineTo(5, 3); c.fill(); }
      else if (p.kind === 'rock') { c.fillStyle = '#7a6a55'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.stroke(); }
      else if (p.kind === 'fire') { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,140,40,.9)'; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill(); c.fillStyle = 'rgba(255,220,90,.9)'; c.beginPath(); c.arc(2, 0, 4, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; }
      else if (p.kind === 'meteor') { c.shadowColor = '#ff7a2d'; c.shadowBlur = 24; c.fillStyle = '#ff9a3d'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(4, 0, 10, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,160,60,.5)'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(-60, 0); c.lineTo(-10, 12); c.fill(); }
      else { c.fillStyle = '#c77dff'; c.shadowColor = '#c77dff'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); c.shadowBlur = 0; }
      c.restore();
    }
    for (const p of b.particles) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    c.globalAlpha = 1;
    c.font = 'bold 18px system-ui, sans-serif'; c.textAlign = 'center';
    for (const t of b.texts) { c.globalAlpha = Math.min(1, t.life * 2); c.fillStyle = INK; c.fillText(t.text, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.text, t.x, t.y); }
    c.globalAlpha = 1;
    c.restore();

    if (b.storm > 0) {
      c.fillStyle = `rgba(214,140,80,${0.08 + b.storm * 0.22})`;
      c.fillRect(0, 0, this.viewW, H);
    }
    if (b.level.region === 'shadow') {
      c.fillStyle = 'rgba(20,16,50,.18)'; c.fillRect(0, 0, this.viewW, H);
    }
    if (b.abilityFx > 0) { c.fillStyle = `rgba(255,220,120,${b.abilityFx * 0.15})`; c.fillRect(0, 0, this.viewW, H); }
  }

  private drawBackdrop(region: RegionId, th: Theme) {
    const c = this.ctx;
    const vw = this.viewW;
    if (region === 'shadow') {
      c.fillStyle = '#fff';
      for (const s of this.stars) { const x = ((s.x - this.cam * 0.05) % W + W) % W; if (x < vw) { c.globalAlpha = 0.7; c.beginPath(); c.arc(x, s.y, s.r, 0, 7); c.fill(); } }
      c.globalAlpha = 1;
      c.fillStyle = '#f3ecd0'; c.beginPath(); c.arc(vw * 0.78, 90, 34, 0, 7); c.fill();
    } else {
      c.fillStyle = 'rgba(255,245,210,.9)'; c.beginPath(); c.arc(vw * 0.8, 80, 30, 0, 7); c.fill();
    }
    // far layer
    c.fillStyle = th.far;
    const o1 = -this.cam * 0.15;
    c.beginPath(); c.moveTo(0, GROUND);
    for (let x = -200; x <= vw + 200; x += 40) {
      const wx = x - o1;
      let y: number;
      if (region === 'mountains') y = GROUND - 170 - Math.abs(Math.sin(wx * 0.004)) * 120 - Math.sin(wx * 0.013) * 25;
      else if (region === 'shadow') y = GROUND - 120 - (Math.floor(wx / 80) % 3 === 0 ? 90 : Math.floor(wx / 80) % 2 ? 40 : 65);
      else y = GROUND - 110 - Math.sin(wx * 0.005) * 40 - Math.sin(wx * 0.011) * 15;
      c.lineTo(x, y);
    }
    c.lineTo(vw + 200, GROUND); c.closePath(); c.fill();
    if (region === 'shadow') { // lit windows
      c.fillStyle = 'rgba(255,210,120,.5)';
      for (let x = 0; x < vw; x += 37) { const wx = Math.floor(x - o1); if ((wx * 31) % 7 < 2) c.fillRect(x, GROUND - 100 - ((wx * 13) % 50), 5, 7); }
    }
    // mid layer
    c.fillStyle = th.mid;
    const o2 = -this.cam * 0.45;
    c.beginPath(); c.moveTo(0, GROUND);
    for (let x = -100; x <= vw + 100; x += 30) c.lineTo(x, GROUND - 40 - Math.sin((x - o2) * 0.008) * 22);
    c.lineTo(vw + 100, GROUND); c.closePath(); c.fill();
    if (region === 'oasis') {
      for (let i = 0; i < 14; i++) {
        const x = ((i * 260 + o2) % (W * 0.6) + W * 0.6) % (W * 0.6) - 100;
        if (x > -60 && x < vw + 60) this.palm(x, GROUND - 40);
      }
    }
  }

  private palm(x: number, y: number) {
    const c = this.ctx;
    c.strokeStyle = '#6d4c2a'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 50, x + 4, y - 95); c.stroke();
    c.strokeStyle = '#3f7d3a'; c.lineWidth = 5;
    for (let a = 0; a < 6; a++) {
      const ang = -Math.PI + (a / 5) * Math.PI;
      c.beginPath(); c.moveTo(x + 4, y - 95);
      c.quadraticCurveTo(x + 4 + Math.cos(ang) * 30, y - 115 + Math.sin(ang) * 10, x + 4 + Math.cos(ang) * 46, y - 85);
      c.stroke();
    }
  }

  private drawMine(x: number) {
    const c = this.ctx;
    c.fillStyle = '#8a7356'; c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - 50, GROUND); c.lineTo(x - 30, GROUND - 38); c.lineTo(x, GROUND - 52); c.lineTo(x + 34, GROUND - 32); c.lineTo(x + 52, GROUND); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd34d';
    for (const [dx, dy] of [[-20, -18], [6, -34], [22, -14], [-4, -10]]) { c.beginPath(); c.moveTo(x + dx, GROUND + dy - 5); c.lineTo(x + dx + 5, GROUND + dy); c.lineTo(x + dx, GROUND + dy + 5); c.lineTo(x + dx - 5, GROUND + dy); c.fill(); }
  }

  private drawCastle(side: 0 | 1, pct: number, region: RegionId, invulnerable = false) {
    const c = this.ctx;
    const x = CASTLE_X[side];
    const f = side === 0 ? 1 : -1;
    const wall = region === 'shadow' ? '#6c6480' : region === 'mountains' ? '#9d927f' : '#c79a62';
    const dark = region === 'shadow' ? '#4e4763' : '#9c7342';
    const sink = (1 - pct) * 30; // crumble
    c.save();
    c.translate(x, sink);
    c.lineWidth = 3; c.strokeStyle = INK;
    // main block
    c.fillStyle = wall;
    c.fillRect(-90, GROUND - 150, 180, 150); c.strokeRect(-90, GROUND - 150, 180, 150);
    // tower
    c.fillRect(-f * 90 - 30, GROUND - 210, 60, 210); c.strokeRect(-f * 90 - 30, GROUND - 210, 60, 210);
    // crenellations
    for (let i = -90; i < 90; i += 30) { c.fillRect(i, GROUND - 168, 18, 18); c.strokeRect(i, GROUND - 168, 18, 18); }
    for (let i = 0; i < 3; i++) { const bx = -f * 90 - 30 + i * 22; c.fillRect(bx, GROUND - 226, 14, 16); c.strokeRect(bx, GROUND - 226, 14, 16); }
    // gate
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(f * 20 - 26, GROUND); c.lineTo(f * 20 - 26, GROUND - 60); c.arc(f * 20, GROUND - 60, 26, Math.PI, 0); c.lineTo(f * 20 + 26, GROUND); c.closePath(); c.fill(); c.stroke();
    // windows
    c.fillStyle = INK;
    c.fillRect(-f * 90 - 6, GROUND - 180, 12, 22);
    // pennant (abstract emblem, no real flags)
    c.beginPath(); c.moveTo(-f * 90, GROUND - 226); c.lineTo(-f * 90, GROUND - 290); c.stroke();
    c.fillStyle = TEAM[side];
    c.beginPath(); c.moveTo(-f * 90, GROUND - 290); c.lineTo(-f * 90 + f * 46, GROUND - 278); c.lineTo(-f * 90, GROUND - 264); c.closePath(); c.fill(); c.stroke();
    // cracks
    if (pct < 0.7) { c.strokeStyle = 'rgba(30,20,10,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-40, GROUND - 150); c.lineTo(-25, GROUND - 110); c.lineTo(-40, GROUND - 80); c.stroke(); }
    if (pct < 0.4) { c.beginPath(); c.moveTo(50, GROUND - 150); c.lineTo(35, GROUND - 100); c.lineTo(55, GROUND - 60); c.stroke(); }
    c.restore();
    // hp bar
    const bw = 150;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - bw / 2 - 2, GROUND - 318, bw + 4, 14);
    c.fillStyle = invulnerable ? '#a46cff' : pct > 0.5 ? '#5cc85c' : pct > 0.25 ? '#e8b730' : '#e0453a';
    c.fillRect(x - bw / 2, GROUND - 316, bw * Math.max(0, pct), 10);
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
    const wide = ['camel', 'lion', 'hyena', 'scorpking', 'worm', 'catapult', 'boss'].includes(def.id) ? 1.5 : 1;
    const s = size / (Math.max(h * 1.25, 60 * wide) + 12);
    ctx.setTransform(s, 0, 0, s, size / 2 - 60 * s, size - (GROUND + 6) * s);
    const u: Unit = { uid: 0, def, side, x: 60 - (def.id === 'camel' ? 8 : 0), lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 1.2, moving: false, attacking: 0, chargeReady: false, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0 };
    const y = def.flying ? GROUND - 30 : GROUND;
    drawArt({ c: ctx, u, x: u.x, gy: y, f: side === 0 ? 1 : -1, t: 0, swing: 0, atk: 0, side, region: 'oasis', flash: false });
    return cv.toDataURL();
  }

  private hpBar(u: Unit, gy: number) {
    if (u.dead || u.hp >= u.maxHp) return;
    const c = this.ctx;
    const w = u.def.boss ? 100 : 32;
    const y = gy - u.def.height - 14;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 7);
    c.fillStyle = u.side === 0 ? '#5cc85c' : '#e0453a'; c.fillRect(u.x - w / 2, y, (w * Math.max(0, u.hp)) / u.maxHp, 5);
  }
}

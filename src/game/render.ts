import { Battle, W, H, GROUND, CASTLE_X, MINE_X, type Unit } from './battle';
import type { RegionId } from '../data/levels';

const INK = '#16120e';
const TEAM = ['#e0a82e', '#9e1f1f'];

interface Theme { sky: [string, string]; far: string; mid: string; ground: string; ground2: string; }
const THEMES: Record<RegionId, Theme> = {
  oasis: { sky: ['#7fc8e8', '#f6e3b0'], far: '#d9b77a', mid: '#c99e5c', ground: '#e8c98a', ground2: '#d4ad6a' },
  dunes: { sky: ['#e9875a', '#f7c98b'], far: '#c8643c', mid: '#b5532f', ground: '#dc9a5e', ground2: '#c47f45' },
  mountains: { sky: ['#8fb3c9', '#e3ddc8'], far: '#8a8378', mid: '#6f685e', ground: '#bfae8e', ground2: '#a79574' },
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
    this.drawCastle(1, b.castleHp[1] / b.castleMax[1], b.level.region);

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

  private drawCastle(side: 0 | 1, pct: number, region: RegionId) {
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
    c.fillStyle = pct > 0.5 ? '#5cc85c' : pct > 0.25 ? '#e8b730' : '#e0453a';
    c.fillRect(x - bw / 2, GROUND - 316, bw * Math.max(0, pct), 10);
  }

  private limb(x1: number, y1: number, len: number, ang: number) {
    const x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    return [x2, y2] as const;
  }

  drawUnit(u: Unit, b: Battle) {
    const c = this.ctx;
    const id = u.def.id;
    const f = u.side === 0 ? 1 : -1;
    const bossKind = id === 'boss' ? b.level.region : null;
    const gy = GROUND + u.lane;
    const h = u.def.height;
    c.save();
    if (u.dead) {
      c.globalAlpha = Math.max(0, 1 - u.dead / 1.2);
      c.translate(u.x, gy); c.rotate(-f * Math.min(1.5, u.dead * 4)); c.translate(-u.x, -gy);
    }
    if (id === 'ghost' || bossKind === 'shadow') c.globalAlpha *= 0.78;
    c.strokeStyle = u.hitFlash > 0 ? '#fff' : INK;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const lw = Math.max(3, h / 12);
    c.lineWidth = lw;
    const swing = u.moving ? Math.sin(u.anim) * 0.55 : 0;
    const atk = u.attacking > 0 ? Math.sin((1 - u.attacking / 0.3) * Math.PI) : 0;
    const team = TEAM[u.side];

    // controlled marker
    if (u === b.controlled) {
      c.fillStyle = '#ffe066';
      const my = gy - h - 30 + Math.sin(performance.now() / 150) * 4;
      c.beginPath(); c.moveTo(u.x, my + 12); c.lineTo(u.x - 9, my); c.lineTo(u.x + 9, my); c.closePath(); c.fill();
      c.globalAlpha *= 1; c.strokeStyle = 'rgba(255,224,102,.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(u.x, gy + 2, 22, 6, 0, 0, 7); c.stroke();
      c.strokeStyle = u.hitFlash > 0 ? '#fff' : INK; c.lineWidth = lw;
    }

    if (id === 'camel') { this.drawCamel(u, f, gy, swing, atk, team); c.restore(); this.hpBar(u, gy); return; }
    if (id === 'catapult') { this.drawCatapult(u, f, gy, atk, team); c.restore(); this.hpBar(u, gy); return; }
    if (id === 'golem' || bossKind === 'mountains') { this.drawGolem(u, f, gy, swing, atk, bossKind === 'mountains'); c.restore(); this.hpBar(u, gy); return; }
    if (bossKind === 'dunes') { this.drawScorpion(u, f, gy, swing, atk); c.restore(); this.hpBar(u, gy); return; }

    const x = u.x;
    const hip = gy - h * 0.42;
    const sh = gy - h * 0.72;
    const headR = h * 0.13;
    const legL = h * 0.44;
    // legs / robe / ghost tail
    if (id === 'ghost' || bossKind === 'shadow') {
      c.fillStyle = 'rgba(207,224,255,.75)';
      c.beginPath(); c.moveTo(x - h * 0.18, hip); c.quadraticCurveTo(x - f * 6 + Math.sin(u.anim) * 8, gy, x - f * h * 0.45, gy - 4); c.lineTo(x + h * 0.2, hip); c.closePath(); c.fill();
    } else if (id === 'sandmage') {
      c.fillStyle = '#5a2a6e';
      c.beginPath(); c.moveTo(x, sh); c.lineTo(x - h * 0.22, gy); c.lineTo(x + h * 0.22, gy); c.closePath(); c.fill(); c.stroke();
    } else {
      this.limb(x, hip, legL, Math.PI / 2 + swing);
      this.limb(x, hip, legL, Math.PI / 2 - swing);
    }
    // body
    c.beginPath(); c.moveTo(x, hip); c.lineTo(x, sh - h * 0.04); c.stroke();
    // head
    c.fillStyle = id === 'ghost' || bossKind === 'shadow' ? '#dfe8ff' : INK;
    c.beginPath(); c.arc(x, sh - headR - h * 0.03, headR, 0, 7); c.fill();
    // headgear: turban / headscarf in team colour
    c.fillStyle = team;
    if (id === 'bandit' || bossKind === 'oasis') {
      c.fillRect(x - headR, sh - headR * 1.25 - h * 0.03, headR * 2, headR * 0.55);
      c.beginPath(); c.moveTo(x - f * headR, sh - headR - h * 0.03); c.lineTo(x - f * headR * 2.2, sh - headR * 0.4); c.lineTo(x - f * headR, sh - headR * 0.6); c.fill();
    } else if (id !== 'ghost' && bossKind !== 'shadow') {
      c.beginPath(); c.ellipse(x, sh - headR * 1.75 - h * 0.03, headR * 1.05, headR * 0.6, 0, Math.PI, 0); c.fill();
    }
    if (id === 'boss') { // crown
      c.fillStyle = '#ffd34d';
      const cy = sh - headR * 2.3 - h * 0.03;
      c.beginPath(); c.moveTo(x - headR, cy + 8); c.lineTo(x - headR, cy - 6); c.lineTo(x - headR / 2, cy); c.lineTo(x, cy - 10); c.lineTo(x + headR / 2, cy); c.lineTo(x + headR, cy - 6); c.lineTo(x + headR, cy + 8); c.closePath(); c.fill();
    }
    // arms + weapon
    const armL = h * 0.3;
    this.limb(x, sh, armL, Math.PI / 2 - f * (0.4 - swing * 0.5));
    switch (id) {
      case 'miner': {
        const a0 = -1.3 + atk * 1.8;
        const a = f > 0 ? a0 : Math.PI - a0;
        const [hx, hy] = this.limb(x, sh, armL, a);
        this.weaponLine(hx, hy, a, h * 0.38, '#6d4c2a');
        const tx = hx + Math.cos(a) * h * 0.38, ty = hy + Math.sin(a) * h * 0.38;
        const px = Math.cos(a + Math.PI / 2) * 9, py = Math.sin(a + Math.PI / 2) * 9;
        c.strokeStyle = '#666'; c.lineWidth = lw;
        c.beginPath(); c.moveTo(tx - px, ty - py); c.lineTo(tx + px, ty + py); c.stroke();
        break;
      }
      case 'archer': {
        const ang = f > 0 ? -0.15 : Math.PI + 0.15;
        const [hx, hy] = this.limb(x, sh, armL * 1.05, ang);
        c.strokeStyle = '#6d4c2a'; c.lineWidth = lw * 0.8;
        c.beginPath(); c.arc(hx, hy, h * 0.26, f > 0 ? -1.2 : Math.PI - 1.2 + 0.4, f > 0 ? 1.2 : Math.PI + 1.2 - 0.4); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 1.2;
        const pull = atk * 10;
        c.beginPath(); c.moveTo(hx + Math.cos(f > 0 ? -1.2 : Math.PI + 1.2) * h * 0.26, hy - h * 0.24); c.lineTo(hx - f * (8 + pull), hy); c.lineTo(hx + Math.cos(f > 0 ? 1.2 : Math.PI - 1.2) * h * 0.26, hy + h * 0.24); c.stroke();
        break;
      }
      case 'spear': {
        const ang = f > 0 ? 0.05 : Math.PI - 0.05;
        const [hx, hy] = this.limb(x, sh, armL * (1 + atk * 0.4), ang);
        this.weaponLine(hx - f * h * 0.5, hy, ang, h * 1.25, '#6d4c2a');
        c.fillStyle = '#ccc'; c.beginPath(); const tx = hx + f * h * 0.75; c.moveTo(tx, hy - 5); c.lineTo(tx + f * 14, hy); c.lineTo(tx, hy + 5); c.fill();
        // shield
        c.fillStyle = team; c.strokeStyle = INK; c.lineWidth = 3;
        c.beginPath(); c.ellipse(x + f * h * 0.2, hip - h * 0.08, h * 0.13, h * 0.26, 0, 0, 7); c.fill(); c.stroke();
        break;
      }
      case 'sandmage': {
        const ang = -Math.PI / 2 + f * (0.9 - atk * 0.6);
        const [hx, hy] = this.limb(x, sh, armL, f > 0 ? ang : -Math.PI - ang);
        this.weaponLine(hx, hy + h * 0.3, -Math.PI / 2, h * 0.7, '#6d4c2a');
        c.fillStyle = '#c77dff'; c.shadowColor = '#c77dff'; c.shadowBlur = 10 + atk * 10;
        c.beginPath(); c.arc(hx, hy - h * 0.42, 5 + atk * 3, 0, 7); c.fill(); c.shadowBlur = 0;
        break;
      }
      default: { // sword, bandit, ghost, boss
        const raise = -Math.PI / 2 + f * (1.1 - atk * 2.0);
        const ang = f > 0 ? raise : -Math.PI - raise;
        const [hx, hy] = this.limb(x, sh, armL, ang);
        const blade = id === 'boss' ? h * 0.6 : h * 0.42;
        const bang = f > 0 ? raise - 0.9 + atk * 0.6 : -Math.PI - raise + 0.9 - atk * 0.6;
        c.strokeStyle = id === 'ghost' ? '#9fd8ff' : '#d7d7d7'; c.lineWidth = lw * 0.9;
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(bang) * blade, hy + Math.sin(bang) * blade); c.stroke();
        c.strokeStyle = INK; c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(hx + Math.cos(bang + 1.57) * 5, hy + Math.sin(bang + 1.57) * 5); c.lineTo(hx - Math.cos(bang + 1.57) * 5, hy - Math.sin(bang + 1.57) * 5); c.stroke();
      }
    }
    c.restore();
    this.hpBar(u, gy);
  }

  /** Renders a unit portrait for HUD buttons (reuses the in-game drawing code). */
  static icon(def: Unit['def'], size = 96): string {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const r = new Renderer(cv);
    const ctx = cv.getContext('2d')!;
    const s = size / (def.height * 1.55 + 10);
    ctx.setTransform(s, 0, 0, s, size / 2 - 60 * s, size - (GROUND + 4) * s);
    const u: Unit = { uid: 0, def, side: 0, x: 60, lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 0, moving: false, attacking: 0, chargeReady: false, mineTimer: 0, defending: false, dead: 0, hitFlash: 0 };
    r.drawUnit(u, { controlled: null, level: { region: 'oasis' } } as unknown as Battle);
    return cv.toDataURL();
  }

  private weaponLine(x: number, y: number, ang: number, len: number, color: string) {
    const c = this.ctx;
    const prev = c.strokeStyle, lw = c.lineWidth;
    c.strokeStyle = color; c.lineWidth = Math.max(2, lw * 0.7);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
    c.strokeStyle = prev; c.lineWidth = lw;
  }

  private drawCamel(u: Unit, f: number, gy: number, swing: number, atk: number, team: string) {
    const c = this.ctx; const x = u.x;
    c.fillStyle = '#c89b5a'; c.lineWidth = 3;
    // legs
    for (const [dx, s] of [[-14, swing], [-6, -swing], [12, -swing], [20, swing]] as [number, number][]) this.limb(x + f * dx, gy - 26, 26, Math.PI / 2 + s * 0.6);
    // body + hump
    c.beginPath(); c.ellipse(x + f * 3, gy - 30, 26, 11, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x - f * 2, gy - 40, 12, 9, 0, Math.PI, 0); c.fill(); c.stroke();
    // neck + head
    c.lineWidth = 5; c.strokeStyle = c.strokeStyle;
    c.beginPath(); c.moveTo(x + f * 24, gy - 32); c.quadraticCurveTo(x + f * 40, gy - 34, x + f * 38, gy - 52); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.ellipse(x + f * 43, gy - 54, 8, 5, 0, 0, 7); c.fill(); c.stroke();
    // saddle cloth
    c.fillStyle = team; c.fillRect(x - f * 14 - (f < 0 ? 18 : 0), gy - 42, 18, 8);
    // rider
    const sy = gy - 46;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - f * 4, sy); c.lineTo(x - f * 4, sy - 18); c.stroke();
    c.fillStyle = '#16120e'; c.beginPath(); c.arc(x - f * 4, sy - 25, 6, 0, 7); c.fill();
    c.fillStyle = team; c.beginPath(); c.ellipse(x - f * 4, sy - 30, 7, 4, 0, Math.PI, 0); c.fill();
    const raise = -Math.PI / 2 + f * (1.0 - atk * 2);
    const ang = f > 0 ? raise : -Math.PI - raise;
    const [hx, hy] = this.limb(x - f * 4, sy - 15, 11, ang);
    c.strokeStyle = '#d7d7d7'; c.beginPath(); c.moveTo(hx, hy); const ba = ang - f * 0.6; c.lineTo(hx + Math.cos(ba) * 22, hy + Math.sin(ba) * 22); c.stroke();
  }

  private drawCatapult(u: Unit, f: number, gy: number, atk: number, team: string) {
    const c = this.ctx; const x = u.x;
    c.fillStyle = '#8a5a2b'; c.lineWidth = 3;
    c.fillRect(x - 26, gy - 20, 52, 9); c.strokeRect(x - 26, gy - 20, 52, 9);
    c.fillStyle = '#5c3b1c';
    for (const dx of [-17, 17]) { c.beginPath(); c.arc(x + dx, gy - 8, 8, 0, 7); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(x - f * 4, gy - 20); c.lineTo(x + f * 6, gy - 40); c.lineTo(x + f * 14, gy - 20); c.stroke();
    const arm = f > 0 ? -2.6 + atk * 1.8 : -0.54 - atk * 1.8;
    c.strokeStyle = '#6d4c2a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x + f * 6, gy - 38); c.lineTo(x + f * 6 + Math.cos(arm) * 32, gy - 38 + Math.sin(arm) * 32); c.stroke();
    c.fillStyle = team; c.fillRect(x - 6, gy - 18, 12, 5);
  }

  private drawGolem(u: Unit, f: number, gy: number, swing: number, atk: number, king: boolean) {
    const c = this.ctx; const x = u.x; const s = u.def.height / 58;
    c.fillStyle = king ? '#6e6b7a' : '#8a8478'; c.lineWidth = 3;
    const r = (dx: number, dy: number, w: number, h: number) => { c.fillRect(x + dx * s - (w * s) / 2, gy + dy * s, w * s, h * s); c.strokeRect(x + dx * s - (w * s) / 2, gy + dy * s, w * s, h * s); };
    r(-8 + swing * 6, -20, 12, 20); r(8 - swing * 6, -20, 12, 20);
    r(0, -48, 34, 30);
    r(0, -62, 18, 14);
    r(f * (22 + atk * 10), -46 + atk * -6, 12, 26);
    c.fillStyle = '#ffb347'; c.fillRect(x + f * 3 * s - 2, gy - 57 * s, 4, 4);
    if (king) { c.fillStyle = '#ffd34d'; c.beginPath(); const cy = gy - 62 * s; c.moveTo(x - 9 * s, cy); c.lineTo(x - 9 * s, cy - 10 * s); c.lineTo(x - 3 * s, cy - 4 * s); c.lineTo(x, cy - 12 * s); c.lineTo(x + 3 * s, cy - 4 * s); c.lineTo(x + 9 * s, cy - 10 * s); c.lineTo(x + 9 * s, cy); c.fill(); }
  }

  private drawScorpion(u: Unit, f: number, gy: number, swing: number, atk: number) {
    const c = this.ctx; const x = u.x;
    c.fillStyle = '#7a2e1a'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) { this.limb(x - f * (10 - i * 12), gy - 18, 22, Math.PI / 2 + (i % 2 ? swing : -swing) * 0.5 - f * 0.5); this.limb(x - f * (10 - i * 12), gy - 18, 22, Math.PI / 2 + (i % 2 ? -swing : swing) * 0.5 + f * 0.4); }
    c.beginPath(); c.ellipse(x, gy - 22, 44, 16, 0, 0, 7); c.fill(); c.stroke();
    // tail
    c.lineWidth = 9; c.strokeStyle = '#7a2e1a';
    c.beginPath(); c.moveTo(x - f * 38, gy - 26); c.quadraticCurveTo(x - f * 70, gy - 90, x - f * 20 + f * atk * 40, gy - 96 + atk * 40); c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#16120e';
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x - f * 20 + f * atk * 40, gy - 96 + atk * 40, 7, 0, 7); c.fill(); c.stroke();
    // claws
    c.fillStyle = '#7a2e1a';
    c.beginPath(); c.ellipse(x + f * 56, gy - 28, 13, 8, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#ffd34d'; c.fillRect(x + f * 30 - 2, gy - 34, 5, 5);
  }

  private hpBar(u: Unit, gy: number) {
    if (u.dead || u.hp >= u.maxHp) return;
    const c = this.ctx;
    const w = u.def.id === 'boss' ? 90 : 30;
    const y = gy - u.def.height - 14;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(u.x - w / 2, y, w, 5);
    c.fillStyle = u.side === 0 ? '#5cc85c' : '#e0453a'; c.fillRect(u.x - w / 2, y, (w * Math.max(0, u.hp)) / u.maxHp, 5);
  }
}

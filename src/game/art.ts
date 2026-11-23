// Original cartoon character art for حرب الرمال: big-headed desert warriors and
// monsters, drawn procedurally so the whole game ships without image assets.
import type { Unit } from './battle';
import type { RegionId } from '../data/levels';

const OUT = '#3b2414';
const SKIN = ['#eebd8f', '#c98f62'];
const CLOTH = ['#f2c14e', '#c0392b'];
const TRIM = ['#b5791f', '#6e1a12'];

type C = CanvasRenderingContext2D;

export interface ArtCtx { c: C; u: Unit; x: number; gy: number; f: number; t: number; swing: number; atk: number; side: 0 | 1; region: RegionId; flash: boolean; }

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function fillStroke(c: C, fill: string, lw = 2.5) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.stroke(); }
function circle(c: C, x: number, y: number, r: number, fill: string, lw = 2.5) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fillStroke(c, fill, lw); }
function ellipse(c: C, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, lw = 2.5) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fillStroke(c, fill, lw); }
function line(c: C, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  c.save(); c.strokeStyle = OUT; c.lineWidth = w + 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
}
function poly(c: C, pts: number[], fill: string, lw = 2.5) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); fillStroke(c, fill, lw); }

function eyes(c: C, x: number, y: number, r: number, f: number, angry: boolean, glow?: string) {
  for (const k of [0.12, 0.58]) {
    const ex = x + f * r * k;
    if (glow) { c.save(); c.fillStyle = glow; c.shadowColor = glow; c.shadowBlur = 8; c.beginPath(); c.ellipse(ex, y, r * 0.15, r * 0.2, 0, 0, 7); c.fill(); c.restore(); continue; }
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, y, r * 0.17, r * 0.23, 0, 0, 7); c.fill();
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(ex + f * r * 0.06, y + r * 0.03, r * 0.1, 0, 7); c.fill();
    if (angry) { c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.moveTo(ex - r * 0.2, y - r * 0.32 - (f * (k < 0.3 ? -1 : 1)) * 0); c.lineTo(ex + r * 0.2, y - r * 0.24 + (k < 0.3 ? -f : f) * r * 0.08); c.stroke(); }
  }
}

// ---------------- Humanoid ----------------
interface HumanOpts {
  skin: string; cloth: string; trim: string; robe?: boolean; scale?: number;
  head?: (hx: number, hy: number, r: number) => void; // headwear
  weapon?: (hx: number, hy: number, ang: number) => void; // drawn at front hand
  back?: (sx: number, sy: number) => void; // behind body (cape, quiver, shield arm)
  armAng?: number; // front arm angle override
  angry?: boolean; glowEyes?: string; noLegs?: boolean; mask?: string;
}
function human(a: ArtCtx, h: number, o: HumanOpts) {
  const { c, x, gy, f, swing } = a;
  const R = h * 0.21;
  const headY = gy - h + R;
  const neck = headY + R * 0.95;
  const hip = gy - h * 0.3;
  const legL = h * 0.3;
  const bob = Math.abs(Math.sin(a.u.anim)) * (a.u.moving ? 2 : 0);
  c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round';
  o.back?.(x - f * R * 0.2, neck + 6 - bob);
  // legs
  if (!o.noLegs) {
    for (const s of [swing, -swing]) {
      const fx = x + Math.sin(s) * legL * 0.9, fy = hip - bob + Math.cos(s) * legL;
      line(c, x, hip - bob, fx, fy, o.skin, Math.max(3, h * 0.07));
      ellipse(c, fx + f * 3, fy, h * 0.065, h * 0.04, '#5a3a22', 0, 2);
    }
  }
  // back arm
  line(c, x - f * R * 0.3, neck + 5 - bob, x - f * R * 0.3 - f * Math.sin(swing) * h * 0.18, neck + h * 0.22 - bob, o.skin, Math.max(3, h * 0.06));
  // body
  c.beginPath();
  const bw = R * 0.85;
  if (o.robe) { c.moveTo(x - bw * 0.7, neck - bob); c.lineTo(x + bw * 0.7, neck - bob); c.lineTo(x + bw * 1.15, gy - 2); c.lineTo(x - bw * 1.15, gy - 2); }
  else { c.moveTo(x - bw * 0.75, neck - bob); c.lineTo(x + bw * 0.75, neck - bob); c.lineTo(x + bw * 0.95, hip + 4 - bob); c.lineTo(x - bw * 0.95, hip + 4 - bob); }
  c.closePath(); fillStroke(c, o.cloth);
  c.fillStyle = o.trim; c.fillRect(x - bw * 0.95, hip - 4 - bob, bw * 1.9, 5); // belt
  // head
  circle(c, x, headY - bob, R, o.skin);
  if (o.mask) { c.save(); c.beginPath(); c.arc(x, headY - bob, R - 1.2, 0.15, Math.PI - 0.15); c.closePath(); c.fillStyle = o.mask; c.fill(); c.restore(); }
  eyes(c, x, headY - bob - R * 0.05, R, f, !!o.angry, o.glowEyes);
  if (!o.mask && !o.glowEyes) { c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(x + f * R * 0.38, headY - bob + R * 0.42, R * 0.18, o.angry ? Math.PI + 0.4 : 0.3, o.angry ? -0.4 : Math.PI - 0.3); c.stroke(); }
  o.head?.(x, headY - bob, R);
  // front arm + weapon
  const ang = o.armAng ?? (f > 0 ? lerp(-1.25, 0.55, a.atk) : Math.PI - lerp(-1.25, 0.55, a.atk));
  const sx = x + f * R * 0.35, sy = neck + 6 - bob;
  const al = h * 0.24;
  const hx = sx + Math.cos(ang) * al, hy = sy + Math.sin(ang) * al;
  line(c, sx, sy, hx, hy, o.skin, Math.max(3, h * 0.065));
  o.weapon?.(hx, hy, ang);
  circle(c, hx, hy, Math.max(2.5, h * 0.045), o.skin, 2);
}

const turban = (c: C, col: string) => (x: number, y: number, r: number) => {
  c.beginPath(); c.ellipse(x, y - r * 0.55, r * 1.08, r * 0.62, 0, Math.PI, 0); c.closePath(); fillStroke(c, col);
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.75); c.quadraticCurveTo(x, y - r * 1.25, x + r * 0.9, y - r * 0.6); c.stroke();
  c.strokeStyle = OUT;
};
const scimitar = (c: C, f: number, len: number) => (hx: number, hy: number, ang: number) => {
  const bang = ang - f * 1.1;
  c.save(); c.translate(hx, hy); c.rotate(bang);
  c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(len * 0.6, -len * 0.18 * f, len, -len * 0.05 * f); c.quadraticCurveTo(len * 0.55, len * 0.05 * f, 0, 3); c.closePath();
  fillStroke(c, '#e6ecf2', 2); c.fillStyle = '#b5791f'; c.fillRect(-3, -5, 5, 10); c.restore();
};

// ---------------- Beasts ----------------
function quad(a: ArtCtx, size: number, body: string, belly: string, opts: { mane?: string; spots?: boolean; collar?: string; tail?: string }) {
  const { c, x, gy, f, swing, atk } = a;
  const s = size / 46;
  const by = gy - 22 * s - Math.abs(Math.sin(a.u.anim)) * 2;
  c.strokeStyle = OUT;
  for (const [dx, k] of [[-14, 1], [-8, -1], [10, -1], [16, 1]] as [number, number][]) line(c, x + f * dx * s, by + 6 * s, x + f * dx * s + Math.sin(swing * k) * 8 * s, gy - 2, body, 5 * s);
  // tail
  c.save(); c.strokeStyle = OUT; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(x - f * 20 * s, by - 2 * s); c.quadraticCurveTo(x - f * 32 * s, by - 14 * s + Math.sin(a.u.anim * 2) * 4, x - f * 30 * s, by - 22 * s); c.stroke(); c.restore();
  if (opts.tail) circle(c, x - f * 30 * s, by - 22 * s, 4 * s, opts.tail, 2);
  ellipse(c, x, by, 24 * s, 12 * s, body);
  if (opts.spots) { c.fillStyle = 'rgba(60,35,15,.55)'; for (const [dx, dy] of [[-10, -4], [2, -6], [10, -2], [-3, 2]]) { c.beginPath(); c.arc(x + f * dx * s, by + dy * s, 2.6 * s, 0, 7); c.fill(); } }
  c.fillStyle = belly; c.beginPath(); c.ellipse(x, by + 6 * s, 16 * s, 5 * s, 0, 0, Math.PI); c.fill();
  // head
  const hx = x + f * (24 + atk * 6) * s, hy = by - 8 * s;
  if (opts.mane) circle(c, hx - f * 2 * s, hy, 14 * s, opts.mane);
  circle(c, hx, hy, 10 * s, body);
  ellipse(c, hx + f * 8 * s, hy + 4 * s, 6 * s, 4.5 * s, belly, 0, 2);
  c.fillStyle = OUT; c.beginPath(); c.arc(hx + f * 12 * s, hy + 2 * s, 1.8 * s, 0, 7); c.fill();
  circle(c, hx - f * 5 * s, hy - 9 * s, 3.5 * s, body, 2); // ear
  eyes(c, hx - f * 2 * s, hy - 3 * s, 9 * s, f, true);
  if (atk > 0.2) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx + f * 6 * s, hy + 7 * s); c.lineTo(hx + f * 9 * s, hy + 11 * s); c.lineTo(hx + f * 12 * s, hy + 7 * s); c.fill(); }
  if (opts.collar) { c.fillStyle = opts.collar; c.fillRect(hx - f * 10 * s - 3 * s, hy + 6 * s, 6 * s, 6 * s); }
}

function bird(a: ArtCtx, y: number, size: number, body: string, wing: string, opts: { crest?: string; band?: string; beak?: string }) {
  const { c, x, f } = a;
  const s = size / 40;
  const flap = Math.sin(a.u.anim * 1.6);
  c.strokeStyle = OUT;
  // back wing
  poly(c, [x - f * 4 * s, y - 2 * s, x - f * 20 * s, y - (18 + flap * 16) * s, x + f * 6 * s, y - 4 * s], wing);
  ellipse(c, x, y, 16 * s, 9 * s, body, f * -0.15);
  poly(c, [x - f * 14 * s, y, x - f * 28 * s, y - 6 * s, x - f * 26 * s, y + 6 * s], wing); // tail
  // talons
  line(c, x - f * 2 * s, y + 8 * s, x + f * 4 * s, y + 14 * s + a.atk * 6, '#e0a43a', 2.5 * s);
  const hx = x + f * 15 * s, hy = y - 6 * s;
  circle(c, hx, hy, 8 * s, body);
  poly(c, [hx + f * 6 * s, hy - 2 * s, hx + f * 15 * s, hy + 2 * s, hx + f * 6 * s, hy + 4 * s], opts.beak ?? '#f3b23a', 2);
  eyes(c, hx, hy - 2 * s, 7 * s, f, true);
  if (opts.crest) poly(c, [hx - f * 4 * s, hy - 7 * s, hx - f * 14 * s, hy - 16 * s, hx - f * 1 * s, hy - 9 * s], opts.crest, 2);
  if (opts.band) { c.fillStyle = opts.band; c.fillRect(x - 4 * s, y - 9 * s, 8 * s, 18 * s); c.strokeRect(x - 4 * s, y - 9 * s, 8 * s, 18 * s); }
  // front wing
  poly(c, [x - f * 2 * s, y - 2 * s, x - f * 16 * s, y - (22 + flap * 20) * s, x + f * 10 * s, y - 6 * s], wing);
}

function smokeTail(c: C, x: number, top: number, gy: number, f: number, col: string, t: number) {
  c.save(); c.globalAlpha *= 0.85;
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    circle(c, x - f * k * 18 + Math.sin(t * 3 + i) * 4, lerp(top, gy - 10, k), lerp(12, 4, k), col, 1.5);
  }
  c.restore();
}

function rocks(c: C, x: number, gy: number, s: number, f: number, swing: number, atk: number, col: string, crown: boolean, runes?: string) {
  const r = (dx: number, dy: number, w: number, h: number) => { c.beginPath(); c.roundRect(x + dx * s - (w * s) / 2, gy + dy * s, w * s, h * s, 4 * s); fillStroke(c, col, 3); };
  r(-9 + swing * 6, -22, 13, 22); r(9 - swing * 6, -22, 13, 22);
  r(0, -52, 38, 34);
  r(f * -24, -50, 12, 26);
  r(0, -68, 22, 18);
  r(f * (24 + atk * 12), -50 - atk * 8, 13, 28);
  c.fillStyle = runes ?? '#ffb347'; c.shadowColor = runes ?? '#ffb347'; c.shadowBlur = 8;
  c.fillRect(x + f * 2 * s - 2 * s, gy - 62 * s, 4 * s, 4 * s); c.fillRect(x + f * 8 * s - 2 * s, gy - 62 * s, 4 * s, 4 * s);
  if (runes) { c.fillRect(x - 6 * s, gy - 42 * s, 12 * s, 3 * s); c.fillRect(x - 1.5 * s, gy - 48 * s, 3 * s, 14 * s); }
  c.shadowBlur = 0;
  if (crown) crownAt(c, x, gy - 68 * s, 11 * s);
}

function crownAt(c: C, x: number, y: number, w: number) {
  poly(c, [x - w, y, x - w, y - w * 0.9, x - w * 0.45, y - w * 0.35, x, y - w * 1.1, x + w * 0.45, y - w * 0.35, x + w, y - w * 0.9, x + w, y], '#ffd34d', 2);
}

// ---------------- Unit table ----------------
export function drawArt(a: ArtCtx) {
  const { c, u, x, gy, f, side, t } = a;
  const id = u.def.id;
  const h = u.def.height;
  const skin = SKIN[side], cloth = CLOTH[side], trim = TRIM[side];
  const bossKind = id === 'boss' ? a.region : null;
  c.strokeStyle = OUT;

  switch (id) {
    case 'miner':
      return human(a, h, {
        skin, cloth: '#a87a4f', trim: cloth,
        head: (hx, hy, r) => { c.beginPath(); c.ellipse(hx, hy - r * 0.5, r * 1.05, r * 0.6, 0, Math.PI, 0); c.closePath(); fillStroke(c, cloth); },
        armAng: f > 0 ? lerp(-1.4, 0.4, a.atk) : Math.PI - lerp(-1.4, 0.4, a.atk),
        weapon: (hx, hy, ang) => {
          const ex = hx + Math.cos(ang) * h * 0.32, ey = hy + Math.sin(ang) * h * 0.32;
          line(c, hx, hy, ex, ey, '#8b5a2b', 3);
          const px = Math.cos(ang + Math.PI / 2) * 8, py = Math.sin(ang + Math.PI / 2) * 8;
          line(c, ex - px, ey - py, ex + px, ey + py, '#9aa3ad', 3);
        },
      });
    case 'sword':
      return human(a, h, { skin, cloth, trim, head: turban(c, side ? '#7a1f16' : '#fff3d6'), weapon: scimitar(c, f, h * 0.42), angry: side === 1 });
    case 'bandit':
      return human(a, h, { skin, cloth: '#7b3a2a', trim: '#2b1a10', mask: '#2b1a10', head: turban(c, '#c0392b'), weapon: scimitar(c, f, h * 0.4), angry: true });
    case 'archer':
      return human(a, h, {
        skin, cloth, trim, angry: side === 1,
        head: (hx, hy, r) => { turban(c, side ? '#7a1f16' : '#7fb069')(hx, hy, r); },
        back: (sx, sy) => { c.save(); c.translate(sx - f * 6, sy); c.rotate(-f * 0.4); c.beginPath(); c.roundRect(-4, -4, 8, 22, 3); fillStroke(c, '#8b5a2b', 2); c.restore(); },
        armAng: f > 0 ? -0.15 : Math.PI + 0.15,
        weapon: (hx, hy) => {
          const r = h * 0.28;
          c.lineWidth = 3.5; c.strokeStyle = '#8b5a2b'; c.beginPath();
          if (f > 0) c.arc(hx - r * 0.3, hy, r, -1.15, 1.15); else c.arc(hx + r * 0.3, hy, r, Math.PI - 1.15, Math.PI + 1.15);
          c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = 1.2;
          const tipX = hx - f * r * 0.3 + f * Math.cos(1.15) * r, pull = a.atk * 10;
          c.beginPath(); c.moveTo(tipX, hy - Math.sin(1.15) * r); c.lineTo(hx - f * (6 + pull), hy); c.lineTo(tipX, hy + Math.sin(1.15) * r); c.stroke(); c.strokeStyle = OUT;
        },
      });
    case 'spear':
      return human(a, h, {
        skin, cloth, trim, angry: side === 1,
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy - r * 0.15, r * 1.02, Math.PI, 0); c.closePath(); fillStroke(c, '#b8c2cc'); poly(c, [hx - 3, hy - r * 1.1, hx, hy - r * 1.6, hx + 3, hy - r * 1.1], '#b8c2cc', 2); },
        armAng: f > 0 ? 0.05 : Math.PI - 0.05,
        weapon: (hx, hy) => {
          const len = h * 1.05, push = a.atk * 10 * f;
          line(c, hx - f * len * 0.35 + push, hy, hx + f * len * 0.65 + push, hy, '#8b5a2b', 3);
          poly(c, [hx + f * len * 0.65 + push, hy - 5, hx + f * (len * 0.65 + 14) + push, hy, hx + f * len * 0.65 + push, hy + 5], '#dfe6ec', 2);
          ellipse(c, a.x + f * h * 0.2, gy - h * 0.42, h * 0.15, h * 0.24, cloth, 0, 3);
          circle(c, a.x + f * h * 0.2, gy - h * 0.42, h * 0.05, trim, 2);
        },
      });
    case 'healer':
      return human(a, h, {
        skin, cloth: '#f4f1e6', trim: '#3fa34d', robe: true,
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.08, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(hx + r * 1.05, hy + r * 0.4); c.lineTo(hx - r * 1.05, hy + r * 0.4); c.closePath(); fillStroke(c, '#3fa34d'); },
        armAng: f > 0 ? -1.1 : Math.PI + 1.1,
        weapon: (hx, hy) => {
          line(c, hx, hy - 10, hx, hy + h * 0.55, '#8b5a2b', 3);
          c.save(); c.fillStyle = '#7dff9a'; c.shadowColor = '#7dff9a'; c.shadowBlur = 10 + a.atk * 14; c.beginPath(); c.arc(hx, hy - 14, 5 + a.atk * 3, 0, 7); c.fill(); c.restore();
        },
      });
    case 'fire':
      return human(a, h, {
        skin, cloth: '#5a3a2e', trim: cloth, mask: '#2b1a10',
        head: turban(c, '#e2711d'),
        armAng: f > 0 ? 0 : Math.PI,
        weapon: (hx, hy) => {
          line(c, hx - f * 4, hy, hx + f * 12, hy, '#7a5a3a', 5);
          if (a.atk > 0 || u.attacking > 0) {
            c.save(); c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? 'rgba(255,190,60,.7)' : 'rgba(255,90,30,.65)'; c.beginPath(); c.arc(hx + f * (18 + i * 10), hy + Math.sin(t * 20 + i) * 4, 5 + i * 1.6, 0, 7); c.fill(); }
            c.restore();
          } else { c.fillStyle = '#ffb347'; c.beginPath(); c.arc(hx + f * 14, hy, 3, 0, 7); c.fill(); }
        },
      });
    case 'assassin':
      return human(a, h, {
        skin, cloth: '#2c2c34', trim: cloth, mask: '#2c2c34',
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.1, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(hx - f * r * 1.4, hy + r * 0.2); c.closePath(); fillStroke(c, '#2c2c34'); },
        weapon: (hx, hy, ang) => { const b = ang - f * 0.9; line(c, hx, hy, hx + Math.cos(b) * h * 0.26, hy + Math.sin(b) * h * 0.26, '#e6ecf2', 2.5); },
        back: (sx, sy) => line(c, sx, sy + 8, sx - f * 10, sy + 22, '#e6ecf2', 2.5),
      });
    case 'giant':
      return human(a, h, {
        skin: side ? '#b07a52' : '#d9a476', cloth: '#7a5534', trim: cloth, angry: true,
        head: (hx, hy, r) => { c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(hx + f * r * 0.35, hy + r * 0.62, r * 0.45, r * 0.22, 0, 0, 7); c.fill(); },
        weapon: (hx, hy, ang) => {
          const b = ang - f * 0.8;
          const ex = hx + Math.cos(b) * h * 0.5, ey = hy + Math.sin(b) * h * 0.5;
          line(c, hx, hy, ex, ey, '#8b5a2b', 7);
          circle(c, ex, ey, h * 0.09, '#6b4423', 3);
        },
      });
    case 'hero':
      return human(a, h, {
        skin, cloth: '#c9d2dc', trim: cloth,
        back: (sx, sy) => { poly(c, [sx - 8, sy - 4, sx + 8, sy - 4, sx - f * 26 + Math.sin(t * 4) * 3, gy - 6, sx - f * 6, gy - 4], cloth); },
        head: (hx, hy, r) => {
          c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.06, Math.PI, 0); c.closePath(); fillStroke(c, '#c9d2dc');
          c.save(); c.strokeStyle = cloth; c.lineWidth = 6; c.beginPath(); c.moveTo(hx, hy - r * 1.1); c.quadraticCurveTo(hx - f * r * 1.4, hy - r * 1.8, hx - f * r * 2, hy - r * 0.6); c.stroke(); c.restore();
        },
        weapon: scimitar(c, f, h * 0.55),
      });
    case 'sandmage':
      return human(a, h, {
        skin, cloth: '#5b2a86', trim: '#ffd34d', robe: true, angry: true,
        head: (hx, hy, r) => { poly(c, [hx - r * 1.1, hy + r * 0.3, hx, hy - r * 1.9, hx + r * 1.1, hy + r * 0.3], '#5b2a86'); },
        armAng: f > 0 ? -1.0 + a.atk * 0.6 : Math.PI + 1.0 - a.atk * 0.6,
        weapon: (hx, hy) => {
          line(c, hx, hy - 6, hx, hy + h * 0.5, '#6b4423', 3);
          c.save(); c.fillStyle = '#c77dff'; c.shadowColor = '#c77dff'; c.shadowBlur = 10 + a.atk * 12; c.beginPath(); c.arc(hx, hy - 10, 5 + a.atk * 3, 0, 7); c.fill(); c.restore();
        },
      });
    case 'ghost':
      c.save(); c.globalAlpha *= 0.8;
      smokeTail(c, x, gy - h * 0.45, gy, f, '#d8e4ff', t);
      human(a, h, { skin: '#e6eeff', cloth: '#b9c8f0', trim: '#7d8fc7', noLegs: true, glowEyes: '#7df9ff', weapon: scimitar(c, f, h * 0.36) });
      c.restore(); return;
    case 'golem':
      return rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#b39b78', false);
    case 'camel':
      return camel(a, cloth, trim, skin);
    case 'catapult':
      return catapult(a, cloth);
    case 'lion':
      return quad(a, h, '#e0a84a', '#f5d79a', { mane: '#a8611f', collar: cloth, tail: '#a8611f' });
    case 'hyena':
      return quad(a, h, '#b89a6a', '#e3d2ab', { spots: true, tail: '#6b4f2c' });
    case 'falcon':
      return bird(a, gy - 4, h, '#a86b32', '#7a4a20', { band: cloth, beak: '#f3b23a' });
    case 'vulture':
      return bird(a, gy - 4, h, '#4a3a3a', '#2e2424', { crest: '#c0392b', beak: '#d9c7a0' });
    case 'roc':
      return bird(a, gy - 10, h, '#8a4b2a', '#5c2f18', { crest: '#ffd34d', beak: '#f3b23a' });
    case 'genie':
      smokeTail(c, x, gy - h * 0.4, gy + 10, f, '#3fbf8f', t);
      return human(a, h * 0.85, {
        skin: '#4fd1a0', cloth: '#ffd34d', trim: '#b5791f', noLegs: true,
        head: (hx, hy, r) => { turban(c, '#f2f2f2')(hx, hy, r); circle(c, hx, hy - r * 0.9, r * 0.2, '#e0453a', 2); },
        armAng: f > 0 ? -0.6 - a.atk * 0.5 : Math.PI + 0.6 + a.atk * 0.5,
        weapon: (hx, hy) => { c.save(); c.fillStyle = '#c3fff0'; c.shadowColor = '#4fd1a0'; c.shadowBlur = 16; c.beginPath(); c.arc(hx, hy, 6 + a.atk * 4, 0, 7); c.fill(); c.restore(); },
      });
    case 'djinn':
      smokeTail(c, x, gy - h * 0.4, gy + 10, f, '#6a3fa0', t);
      return human(a, h * 0.85, {
        skin: '#8a5cc7', cloth: '#2a1b4a', trim: '#ffd34d', noLegs: true, glowEyes: '#ffef5c',
        head: (hx, hy, r) => { poly(c, [hx - r * 0.7, hy - r * 0.6, hx - r * 1.1, hy - r * 1.6, hx - r * 0.3, hy - r * 0.9], '#ffd34d', 2); poly(c, [hx + r * 0.7, hy - r * 0.6, hx + r * 1.1, hy - r * 1.6, hx + r * 0.3, hy - r * 0.9], '#ffd34d', 2); crownAt(c, hx, hy - r * 0.85, r * 0.55); },
        armAng: f > 0 ? -0.6 - a.atk * 0.5 : Math.PI + 0.6 + a.atk * 0.5,
        weapon: (hx, hy) => { c.save(); c.fillStyle = '#d8b4ff'; c.shadowColor = '#c77dff'; c.shadowBlur = 18; c.beginPath(); c.arc(hx, hy, 7 + a.atk * 5, 0, 7); c.fill(); c.restore(); },
      });
    case 'scorpking':
      return scorpion(a, h / 100, true);
    case 'worm':
      return worm(a, h);
    case 'titan':
      return rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#7f7a8a', true, '#5cf2ff');
    case 'warlord':
      return human(a, h, {
        skin: '#a8754e', cloth: '#3a3a44', trim: '#c0392b', angry: true,
        back: (sx, sy) => poly(c, [sx - 10, sy - 6, sx + 10, sy - 6, sx - f * 34 + Math.sin(t * 3) * 4, gy - 6, sx - f * 8, gy - 4], '#7a1f16'),
        head: (hx, hy, r) => {
          c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.08, Math.PI, 0); c.closePath(); fillStroke(c, '#4a4a56');
          poly(c, [hx - r * 0.9, hy - r * 0.5, hx - r * 1.6, hy - r * 1.7, hx - r * 0.5, hy - r * 0.9], '#efe6d2', 2);
          poly(c, [hx + r * 0.9, hy - r * 0.5, hx + r * 1.6, hy - r * 1.7, hx + r * 0.5, hy - r * 0.9], '#efe6d2', 2);
        },
        weapon: (hx, hy, ang) => {
          const b = ang - f * 0.8;
          const ex = hx + Math.cos(b) * h * 0.5, ey = hy + Math.sin(b) * h * 0.5;
          line(c, hx, hy, ex, ey, '#5a3a22', 6);
          c.save(); c.translate(ex, ey); c.rotate(b); c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-10, -24 * f, 10, -26 * f); c.lineTo(8, 0); c.closePath(); fillStroke(c, '#c9d2dc', 3); c.restore();
        },
      });
    case 'boss':
      if (bossKind === 'dunes') return scorpion(a, h / 116, false);
      if (bossKind === 'mountains') return rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#8d8578', true);
      if (bossKind === 'shadow') {
        c.save(); c.globalAlpha *= 0.85; smokeTail(c, x, gy - h * 0.45, gy, f, '#cfd9ff', t);
        human(a, h, { skin: '#e6eeff', cloth: '#7d8fc7', trim: '#3a4a8a', noLegs: true, glowEyes: '#7df9ff', head: (hx, hy, r) => crownAt(c, hx, hy - r * 0.85, r * 0.7), weapon: scimitar(c, f, h * 0.45) });
        c.restore(); return;
      }
      return human(a, h, { skin: SKIN[1], cloth: '#7b3a2a', trim: '#ffd34d', mask: '#2b1a10', angry: true, head: (hx, hy, r) => { turban(c, '#c0392b')(hx, hy, r); crownAt(c, hx, hy - r * 1.05, r * 0.55); }, weapon: scimitar(c, f, h * 0.5) });
  }
}

function camel(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, x, gy, f, swing, atk } = a;
  const col = '#d9a95f';
  for (const [dx, k] of [[-16, 1], [-8, -1], [12, -1], [20, 1]] as [number, number][]) line(c, x + f * dx, gy - 30, x + f * dx + Math.sin(swing * k) * 9, gy - 2, col, 5);
  ellipse(c, x + f * 3, gy - 34, 28, 13, col);
  ellipse(c, x - f * 3, gy - 46, 13, 11, col);
  line(c, x + f * 26, gy - 36, x + f * 38, gy - 56, col, 8);
  ellipse(c, x + f * 44, gy - 60, 11, 7, col);
  eyes(c, x + f * 42, gy - 63, 6, f, false);
  c.fillStyle = cloth; c.beginPath(); c.roundRect(x - f * 6 - 12, gy - 52, 24, 10, 3); c.fill(); c.stroke();
  // rider
  const rider: ArtCtx = { ...a, gy: gy - 44, swing: 0 };
  human(rider, 40, { skin, cloth, trim, noLegs: true, head: turban(c, a.side ? '#7a1f16' : '#fff3d6'), weapon: scimitar(c, f, 22) });
  void atk;
}

function catapult(a: ArtCtx, cloth: string) {
  const { c, x, gy, f, atk } = a;
  c.beginPath(); c.roundRect(x - 28, gy - 22, 56, 10, 3); fillStroke(c, '#a0672f');
  for (const dx of [-18, 18]) { circle(c, x + dx, gy - 9, 9, '#6b4423'); circle(c, x + dx, gy - 9, 2.5, '#3b2414', 1); }
  poly(c, [x - f * 6, gy - 22, x + f * 6, gy - 44, x + f * 16, gy - 22], '#a0672f');
  const arm = f > 0 ? -2.6 + atk * 1.8 : -0.54 - atk * 1.8;
  const ex = x + f * 6 + Math.cos(arm) * 34, ey = gy - 42 + Math.sin(arm) * 34;
  line(c, x + f * 6, gy - 42, ex, ey, '#8b5a2b', 4);
  circle(c, ex, ey, 6, '#8d8578', 2);
  c.fillStyle = cloth; c.fillRect(x - 8, gy - 20, 16, 6);
}

function scorpion(a: ArtCtx, s: number, king: boolean) {
  const { c, x, gy, f, swing, atk } = a;
  const col = king ? '#2f2a3a' : '#9a3a1f';
  for (let i = 0; i < 4; i++) {
    line(c, x - f * (14 - i * 13) * s, gy - 20 * s, x - f * (20 - i * 13) * s + Math.sin(swing + i) * 6 * s, gy - 2, col, 4 * s);
    line(c, x - f * (14 - i * 13) * s, gy - 20 * s, x - f * (8 - i * 13) * s - Math.sin(swing + i) * 6 * s, gy - 2, col, 4 * s);
  }
  ellipse(c, x, gy - 26 * s, 46 * s, 18 * s, col);
  c.save(); c.strokeStyle = OUT; c.lineWidth = 14 * s + 3; c.lineCap = 'round';
  const tx = x - f * 20 * s + f * atk * 46 * s, ty = gy - 104 * s + atk * 46 * s;
  c.beginPath(); c.moveTo(x - f * 40 * s, gy - 30 * s); c.quadraticCurveTo(x - f * 78 * s, gy - 100 * s, tx, ty); c.stroke();
  c.strokeStyle = col; c.lineWidth = 14 * s; c.stroke(); c.restore();
  poly(c, [tx - 7 * s, ty, tx + f * 14 * s, ty + 6 * s, tx - 4 * s, ty + 12 * s], '#ffd34d', 2);
  for (const k of [1, -1]) {
    const cx = x + f * (54 + atk * 10) * s, cy = gy - (30 + k * 8) * s;
    line(c, x + f * 34 * s, gy - 28 * s, cx, cy, col, 7 * s);
    ellipse(c, cx + f * 8 * s, cy, 12 * s, 7 * s, col, 0, 2.5);
  }
  eyes(c, x + f * 26 * s, gy - 34 * s, 12 * s, f, true, king ? '#ff5c5c' : undefined);
  if (king) crownAt(c, x + f * 18 * s, gy - 44 * s, 12 * s);
}

function worm(a: ArtCtx, h: number) {
  const { c, x, gy, f, t, atk } = a;
  const col = '#c98a4a';
  const seg = 9;
  for (let i = seg; i >= 0; i--) {
    const k = i / seg;
    const sx = x - f * k * 70 + Math.sin(t * 3 + i * 0.7) * 6;
    const sy = gy - (1 - k) * h * 0.85 - Math.sin(k * Math.PI) * 10;
    circle(c, sx, sy, lerp(26, 14, k), i % 2 ? col : '#b57638', 3);
  }
  const hx = x + Math.sin(t * 3) * 6, hy = gy - h * 0.85;
  // jaws
  const open = 0.3 + atk * 0.6;
  c.save(); c.translate(hx + f * 16, hy);
  for (const k of [-1, 1]) { c.save(); c.rotate(k * open * f); poly(c, [0, -4 * k, f * 30, -2 * k, f * 26, 8 * k], '#e9d7b0', 2); c.restore(); }
  c.restore();
  eyes(c, hx - f * 6, hy - 10, 16, f, true, '#ffef5c');
  // sand mound
  c.fillStyle = '#d6b37a'; c.beginPath(); c.ellipse(x - f * 30, gy + 2, 70, 12, 0, Math.PI, 0); c.fill();
}

export function isBossy(id: string) { return ['boss', 'scorpking', 'roc', 'worm', 'titan', 'djinn', 'warlord'].includes(id); }

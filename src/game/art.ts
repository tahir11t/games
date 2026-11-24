// Original cartoon character art for حرب الرمال: big-headed desert warriors and
// monsters, drawn procedurally so the whole game ships without image assets.
import type { Unit } from './battle';
import type { RegionId } from '../data/levels';

const OUT = '#22140a';
const SKIN = ['#eebd8f', '#c98f62'];
const CLOTH = ['#f2c14e', '#c0392b'];
const TRIM = ['#b5791f', '#6e1a12'];

type C = CanvasRenderingContext2D;

export interface ArtCtx { c: C; u: Unit; x: number; gy: number; f: number; t: number; swing: number; atk: number; side: 0 | 1; region: RegionId; flash: boolean; tier?: number; }

/** Armour metal by visual tier (a new look every 5 upgrade levels). */
const METAL = ['', '#c98a4a', '#d5dde5', '#ffcf3d', '#ffe27a'];
let BLADE = '#e6ecf2'; // set per unit: gold blades from tier 3
/** Player soldiers that wear tier helmets (robed casters and beasts don't). */
const HELMETED = new Set(['sword', 'archer', 'spear', 'crossbow', 'drummer', 'fire', 'giant', 'hero', 'camel', 'cavalry', 'elephant', 'miner']);
function helmet(c: C, hx: number, hy: number, r: number, tier: number, f: number, t: number) {
  const m = METAL[tier];
  if (tier === 1) { // bronze cap
    c.beginPath(); c.arc(hx, hy - r * 0.15, r * 1.04, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); fillStroke(c, vgrad(c, m, hy - r * 1.2, hy), 1.8);
    c.fillStyle = shade(m, -0.3); c.fillRect(hx - r * 1.02, hy - r * 0.35, r * 2.04, r * 0.18);
  } else if (tier === 2) { // silver helmet with nose guard and neck guard
    c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.08, Math.PI, 0); c.lineTo(hx - f * r * 1.08, hy + r * 0.55); c.lineTo(hx - f * r * 0.7, hy + r * 0.2); c.closePath(); fillStroke(c, vgrad(c, m, hy - r * 1.2, hy + r * 0.5), 1.8);
    c.fillStyle = shade(m, -0.25); c.fillRect(hx + f * r * 0.25 - 1.5, hy - r * 0.15, 3, r * 0.65);
    poly(c, [hx - 2, hy - r * 1.15, hx, hy - r * 1.55, hx + 2, hy - r * 1.15], m, 1.2);
  } else { // gold helmet with tall crest; tier 4 adds wings
    c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.1, Math.PI, 0); c.lineTo(hx - f * r * 1.1, hy + r * 0.6); c.lineTo(hx - f * r * 0.6, hy + r * 0.25); c.closePath(); fillStroke(c, vgrad(c, m, hy - r * 1.2, hy + r * 0.5), 1.8);
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(hx + f * r * 0.4, hy - r * 1.05); c.quadraticCurveTo(hx - f * r * 0.6, hy - r * 2.1, hx - f * r * 1.9, hy - r * 1.3 + Math.sin(t * 5) * 2); c.quadraticCurveTo(hx - f * r * 0.5, hy - r * 1.4, hx - f * r * 0.4, hy - r * 0.95); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    if (tier >= 4) for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.95, hy - r * 0.3, hx + sd * r * 1.9, hy - r * 1.3, hx + sd * r * 1.55, hy - r * 0.55, hx + sd * r * 2.1, hy - r * 0.8, hx + sd * r * 1.1, hy], '#fffaf0', 1.4);
  }
}
/** Outfit colour by tier: richer cloth as a soldier rises. */
function tierCloth(cloth: string, tier: number, side: number) {
  if (!tier || !cloth.startsWith('#')) return cloth;
  if (side === 1) return shade(cloth, -0.08 * tier);
  return ['', cloth, shade(cloth, -0.1), '#f7dc8a', '#fbf3dc'][tier];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---- performance: low-quality mode drops gradients on slow devices ----
let LOW = false;
export function setLowQuality(on: boolean) { LOW = on; }
export function isLowQuality() { return LOW; }
/** Cheap glow (canvas blur stalls mobile GPUs): a few soft discs. */
export function glowDot(c: C, x: number, y: number, r: number, color: string, core = '#ffffff') {
  c.save();
  c.globalAlpha *= 0.25; c.fillStyle = color; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill();
  c.globalAlpha *= 1.8; c.beginPath(); c.arc(x, y, r * 1.4, 0, 7); c.fill();
  c.restore();
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.save(); c.globalAlpha *= 0.8; c.fillStyle = core; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, 7); c.fill(); c.restore();
}
// ---- shading: every shape gets a light top and a darker bottom for volume ----
const shadeCache = new Map<string, string>();
export function shade(hex: string, amt: number): string {
  const key = hex + amt;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const out = '#' + [ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  shadeCache.set(key, out);
  return out;
}
function vgrad(c: C, fill: string, y0: number, y1: number) {
  if (LOW || !fill.startsWith('#')) return fill;
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(fill, 0.22)); g.addColorStop(0.55, fill); g.addColorStop(1, shade(fill, -0.22));
  return g;
}
function rgrad(c: C, fill: string, x: number, y: number, r: number) {
  if (LOW || !fill.startsWith('#')) return fill;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, shade(fill, 0.3)); g.addColorStop(0.6, fill); g.addColorStop(1, shade(fill, -0.2));
  return g;
}
function fillStroke(c: C, fill: string | CanvasGradient, lw = 2.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.stroke(); }
function circle(c: C, x: number, y: number, r: number, fill: string, lw = 2.6) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fillStroke(c, rgrad(c, fill, x, y, r), lw); }
function ellipse(c: C, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, lw = 2.6) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fillStroke(c, rgrad(c, fill, x, y, Math.max(rx, ry)), lw); }
function line(c: C, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  c.save(); c.strokeStyle = OUT; c.lineWidth = w + 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  if (!LOW && color.startsWith('#') && w >= 3) { c.strokeStyle = shade(color, 0.35); c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(x1 - 0.8, y1 - 0.8); c.lineTo(x2 - 0.8, y2 - 0.8); c.stroke(); }
  c.restore();
}
function poly(c: C, pts: number[], fill: string, lw = 2.6) {
  let y0 = Infinity, y1 = -Infinity;
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 0; i < pts.length; i += 2) { if (i) c.lineTo(pts[i], pts[i + 1]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  c.closePath(); fillStroke(c, vgrad(c, fill, y0, y1), lw);
}

function eyes(c: C, x: number, y: number, r: number, f: number, angry: boolean, glow?: string) {
  for (const k of [0.1, 0.58]) {
    const ex = x + f * r * k;
    if (glow) { c.save(); c.fillStyle = glow; c.globalAlpha *= 0.35; c.beginPath(); c.ellipse(ex, y, r * 0.28, r * 0.32, 0, 0, 7); c.fill(); c.globalAlpha /= 0.35; c.beginPath(); c.ellipse(ex, y, r * 0.15, r * 0.2, 0, 0, 7); c.fill(); c.restore(); continue; }
    // big expressive eyes: white, dark pupil, a shine
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, y, r * 0.2, r * 0.27, 0, 0, 7); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(ex + f * r * 0.06, y + r * 0.04, r * 0.12, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + f * r * 0.02, y - r * 0.03, r * 0.045, 0, 7); c.fill();
    // brows: slanted when angry, a soft arch otherwise
    c.strokeStyle = OUT; c.lineWidth = Math.max(1.6, r * 0.11); c.lineCap = 'round'; c.beginPath();
    const inner = k > 0.3; // the brow nearer the nose
    if (angry) { c.moveTo(ex - r * 0.2, y - r * 0.36 + (inner === (f > 0) ? -r * 0.08 : r * 0.08)); c.lineTo(ex + r * 0.2, y - r * 0.36 + (inner === (f > 0) ? r * 0.08 : -r * 0.08)); }
    else { c.moveTo(ex - r * 0.18, y - r * 0.38); c.quadraticCurveTo(ex, y - r * 0.46, ex + r * 0.18, y - r * 0.38); }
    c.stroke();
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
  face?: (hx: number, hy: number, r: number) => void; // replaces the default eyes + mouth
}
function human(a: ArtCtx, h: number, o: HumanOpts) {
  const { c, x, gy, f, swing } = a;
  const R = h * 0.245; // chunky, big-headed proportions
  const headY = gy - h + R;
  const neck = headY + R * 0.95;
  const hip = gy - h * 0.3;
  const legL = h * 0.3;
  const bob = a.u.moving ? Math.abs(Math.sin(a.u.anim)) * 2 : Math.sin(a.t * 2.4 + a.u.uid) * 0.8; // walk bounce / idle breathing
  c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round';
  const tier = a.tier ?? 0;
  const helmeted = tier >= 1 && HELMETED.has(a.u.def.id) && a.side === 0;
  if (helmeted) o = { ...o, cloth: tierCloth(o.cloth, tier, a.side), trim: tier >= 3 ? '#c9952a' : o.trim };
  BLADE = tier >= 3 ? '#ffe27a' : tier === 2 ? '#f6fafd' : '#e6ecf2';
  if (tier >= 2 && !o.noLegs) { // flowing cape
    const capeCol = tier >= 3 ? '#8e1b1b' : shade(o.cloth, -0.3);
    poly(c, [x - R * 0.7, neck - bob, x + R * 0.5, neck - bob, x - f * (R * 1.6) + Math.sin(a.t * 3 + a.u.uid) * 2, gy - h * 0.08, x - f * R * 0.4, gy - h * 0.12], capeCol, 1.8);
  }
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
  c.closePath(); fillStroke(c, vgrad(c, o.cloth, neck - bob, o.robe ? gy : hip));
  if (!LOW) { c.save(); c.strokeStyle = 'rgba(255,255,240,.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - f * bw * 0.6, neck + 3 - bob); c.lineTo(x - f * bw * 0.85, (o.robe ? gy - 6 : hip) - bob); c.stroke(); c.restore(); }
  c.fillStyle = o.trim; c.fillRect(x - bw * 0.95, hip - 4 - bob, bw * 1.9, 5); // belt
  if (tier >= 1) {
    const m = METAL[tier];
    if (tier === 1) { c.save(); c.strokeStyle = m; c.lineWidth = Math.max(2, h * 0.05); c.beginPath(); c.moveTo(x - bw * 0.7, neck + 2 - bob); c.lineTo(x + bw * 0.8, hip - 4 - bob); c.stroke(); c.restore(); }
    else { // breastplate
      c.beginPath(); c.moveTo(x - bw * 0.72, neck + 2 - bob); c.lineTo(x + bw * 0.72, neck + 2 - bob); c.lineTo(x + bw * 0.62, hip - 6 - bob); c.quadraticCurveTo(x, hip - bob, x - bw * 0.62, hip - 6 - bob); c.closePath();
      fillStroke(c, vgrad(c, m, neck - bob, hip - bob), 1.6);
      c.strokeStyle = shade(m, -0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(x, neck + 4 - bob); c.lineTo(x, hip - 6 - bob); c.stroke(); c.strokeStyle = OUT;
    }
    c.fillStyle = tier >= 3 ? '#ffcf3d' : m; c.fillRect(x - 3, hip - 5 - bob, 6, 6); // buckle
  }
  // head
  circle(c, x, headY - bob, R, o.skin);
  if (!LOW) { // rim light from the sun (top-left) and a soft chin shadow: volume without heavy filters
    c.save(); c.strokeStyle = 'rgba(255,255,240,.45)'; c.lineWidth = Math.max(1.5, R * 0.16); c.lineCap = 'round';
    c.beginPath(); c.arc(x, headY - bob, R * 0.78, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
    c.fillStyle = 'rgba(40,20,10,.18)'; c.beginPath(); c.ellipse(x, neck - bob + 1, R * 0.55, R * 0.16, 0, 0, 7); c.fill();
    c.restore();
  }
  if (o.mask) { c.save(); c.beginPath(); c.arc(x, headY - bob, R - 1.2, 0.15, Math.PI - 0.15); c.closePath(); c.fillStyle = o.mask; c.fill(); c.restore(); }
  if (o.face) o.face(x, headY - bob, R);
  else eyes(c, x, headY - bob - R * 0.05, R, f, !!o.angry, o.glowEyes);
  if (!o.face && !o.glowEyes && !o.mask) { c.fillStyle = 'rgba(230,110,90,.28)'; c.beginPath(); c.arc(x + f * R * 0.62, headY - bob + R * 0.3, R * 0.16, 0, 7); c.fill(); }
  if (!o.face && !o.mask && !o.glowEyes) { c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(x + f * R * 0.38, headY - bob + R * 0.42, R * 0.18, o.angry ? Math.PI + 0.4 : 0.3, o.angry ? -0.4 : Math.PI - 0.3); c.stroke(); }
  o.head?.(x, headY - bob, R);
  if (tier >= 1 && !o.noLegs) {
    for (const sx of [x - f * R * 0.55, x + f * R * 0.55]) ellipse(c, sx, neck + 4 - bob, R * 0.42, R * 0.26, METAL[tier], 0, 1.6);
  }
  if (helmeted) helmet(c, x, headY - bob, R, tier, f, a.t);
  else if (tier >= 3) { // plume
    c.save(); c.strokeStyle = tier >= 4 ? '#ff4d4d' : a.side ? '#3a3a44' : '#c0392b'; c.lineWidth = R * 0.32; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, headY - bob - R * 0.95); c.quadraticCurveTo(x - f * R * 0.9, headY - bob - R * 1.9, x - f * R * 1.7, headY - bob - R * 1.1); c.stroke(); c.restore();
  }
  // front arm + weapon
  const ang = o.armAng ?? (f > 0 ? lerp(-1.25, 0.55, a.atk) : Math.PI - lerp(-1.25, 0.55, a.atk));
  const sx = x + f * R * 0.35, sy = neck + 6 - bob;
  const al = h * 0.24;
  const hx = sx + Math.cos(ang) * al, hy = sy + Math.sin(ang) * al;
  line(c, sx, sy, hx, hy, o.skin, Math.max(3, h * 0.065));
  if (o.weapon) {
    const ws = 1 + tier * 0.1; // bigger weapons as the soldier rises
    if (ws !== 1) { c.save(); c.translate(hx, hy); c.scale(ws, ws); c.translate(-hx, -hy); o.weapon(hx, hy, ang); c.restore(); } else o.weapon(hx, hy, ang);
  }
  if (tier >= 3 && o.weapon) glowDot(c, hx + Math.cos(ang - f * 1.1) * h * 0.3, hy + Math.sin(ang - f * 1.1) * h * 0.3, 2.5 + Math.sin(a.t * 6) * 0.8, '#fff3b0');
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
  fillStroke(c, BLADE, 2); c.fillStyle = '#b5791f'; c.fillRect(-3, -5, 5, 10); c.restore();
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
  c.fillStyle = runes ?? '#ffb347';
  c.fillRect(x + f * 2 * s - 2 * s, gy - 62 * s, 4 * s, 4 * s); c.fillRect(x + f * 8 * s - 2 * s, gy - 62 * s, 4 * s, 4 * s);
  if (runes) { c.fillRect(x - 6 * s, gy - 42 * s, 12 * s, 3 * s); c.fillRect(x - 1.5 * s, gy - 48 * s, 3 * s, 14 * s); }
  if (crown) crownAt(c, x, gy - 68 * s, 11 * s);
}

function crownAt(c: C, x: number, y: number, w: number) {
  poly(c, [x - w, y, x - w, y - w * 0.9, x - w * 0.45, y - w * 0.35, x, y - w * 1.1, x + w * 0.45, y - w * 0.35, x + w, y - w * 0.9, x + w, y], '#ffd34d', 2);
}

// ---------------- Unit table ----------------
export function drawArt(a: ArtCtx) {
  const tier = a.tier ?? a.u.tier ?? 0;
  a.tier = tier;
  if (tier >= 4 && !LOW) { // legendary aura at the feet
    const c = a.c; const r = Math.min(60, a.u.def.height * 0.55);
    c.save(); c.globalAlpha *= 0.35 + Math.sin(a.t * 4) * 0.1; c.strokeStyle = '#ffe27a'; c.lineWidth = 3; c.beginPath(); c.ellipse(a.x, a.gy + 2, r, r * 0.22, 0, 0, 7); c.stroke(); c.restore();
  }
  drawArtInner(a);
  if (tier >= 3 && !LOW) { // sparkles
    const c = a.c;
    for (let i = 0; i < (tier >= 4 ? 3 : 1); i++) { const ph = a.t * 2 + i * 2.1 + a.u.uid; const sx = a.x + Math.sin(ph * 1.3) * a.u.def.height * 0.35, sy = a.gy - a.u.def.height * (0.3 + ((ph * 0.5) % 1) * 0.7); c.fillStyle = '#fff6c0'; c.globalAlpha *= 0.8; c.beginPath(); c.moveTo(sx, sy - 4); c.lineTo(sx + 1.2, sy - 1.2); c.lineTo(sx + 4, sy); c.lineTo(sx + 1.2, sy + 1.2); c.lineTo(sx, sy + 4); c.lineTo(sx - 1.2, sy + 1.2); c.lineTo(sx - 4, sy); c.lineTo(sx - 1.2, sy - 1.2); c.fill(); c.globalAlpha /= 0.8; }
  }
}

function drawArtInner(a: ArtCtx) {
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
          glowDot(c, hx, hy - 14, 5 + a.atk * 3, '#7dff9a');
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
          glowDot(c, hx, hy - 10, 5 + a.atk * 3, '#c77dff');
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
        weapon: (hx, hy) => glowDot(c, hx, hy, 6 + a.atk * 4, '#4fd1a0', '#c3fff0'),
      });
    case 'djinn':
      smokeTail(c, x, gy - h * 0.4, gy + 10, f, '#6a3fa0', t);
      return human(a, h * 0.85, {
        skin: '#8a5cc7', cloth: '#2a1b4a', trim: '#ffd34d', noLegs: true, glowEyes: '#ffef5c',
        head: (hx, hy, r) => { poly(c, [hx - r * 0.7, hy - r * 0.6, hx - r * 1.1, hy - r * 1.6, hx - r * 0.3, hy - r * 0.9], '#ffd34d', 2); poly(c, [hx + r * 0.7, hy - r * 0.6, hx + r * 1.1, hy - r * 1.6, hx + r * 0.3, hy - r * 0.9], '#ffd34d', 2); crownAt(c, hx, hy - r * 0.85, r * 0.55); },
        armAng: f > 0 ? -0.6 - a.atk * 0.5 : Math.PI + 0.6 + a.atk * 0.5,
        weapon: (hx, hy) => glowDot(c, hx, hy, 7 + a.atk * 5, '#c77dff', '#f0dcff'),
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
    case 'cavalry':
      return horseRider(a, cloth, trim, skin);
    case 'crossbow':
      return human(a, h, {
        skin, cloth, trim, angry: side === 1,
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.05, Math.PI, 0); c.closePath(); fillStroke(c, vgrad(c, '#9aa6b2', hy - r, hy)); c.fillStyle = '#7d8894'; c.fillRect(hx - r * 1.15, hy - r * 0.15, r * 2.3, r * 0.22); },
        armAng: f > 0 ? 0.02 : Math.PI - 0.02,
        weapon: (hx, hy) => {
          line(c, hx - f * 14, hy + 2, hx + f * 12, hy, '#7a4f28', 4.5);
          c.save(); c.strokeStyle = '#5c3b1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx + f * 10, hy - 11); c.quadraticCurveTo(hx + f * 15, hy, hx + f * 10, hy + 11); c.stroke();
          c.strokeStyle = '#ddd'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx + f * 10, hy - 11); c.lineTo(hx - f * (2 + a.atk * 6), hy); c.lineTo(hx + f * 10, hy + 11); c.stroke(); c.restore();
          if (a.atk < 0.3) line(c, hx - f * 2, hy - 1, hx + f * 14, hy - 1, '#cfd6dc', 1.5);
        },
      });
    case 'drummer':
      return human(a, h, {
        skin, cloth, trim,
        head: turban(c, side ? '#7a1f16' : '#2a7f8f'),
        armAng: f > 0 ? lerp(-0.9, 0.2, a.atk) : Math.PI - lerp(-0.9, 0.2, a.atk),
        weapon: (hx, hy) => {
          const dx = a.x + f * h * 0.16, dy = gy - h * 0.38;
          ellipse(c, dx, dy, h * 0.16, h * 0.14, '#a0672f');
          c.save(); c.fillStyle = '#f3e3c3'; c.beginPath(); c.ellipse(dx + f * h * 0.1, dy, h * 0.05, h * 0.13, 0, 0, 7); c.fill(); c.stroke(); c.restore();
          line(c, hx, hy, hx + f * 10, hy + 8, '#6b4423', 2.5);
          if (a.atk > 0.5) { c.fillStyle = 'rgba(255,224,102,.8)'; c.font = 'bold 12px system-ui'; c.fillText('♪', dx + f * 18, dy - 18 - a.atk * 6); }
        },
      });
    case 'elephant':
      return elephant(a, cloth, trim, skin);
    case 'mummy':
      return mummy(a, h, false);
    case 'mummyking':
      return mummy(a, h, true);
    case 'skeleton':
      return skeleton(a, h);
    case 'cobra':
      return cobra(a, h, false);
    case 'cobraqueen':
      return cobra(a, h, true);
    case 'phoenix': {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(255,${120 + i * 20},40,${0.25 - i * 0.03})`; c.beginPath(); c.arc(x - f * (20 + i * 12), gy - 14 + Math.sin(t * 8 + i) * 5, 12 - i, 0, 7); c.fill(); }
      c.restore();
      return bird(a, gy - 10, h, '#ff7a2d', '#e0451f', { crest: '#ffd34d', beak: '#ffe08a' });
    }
    // ================= Civilizations =================
    // --- Elves ---
    case 'elfworker': return human(a, h, { skin: '#f2d2b0', cloth: '#6f8f4a', trim: '#d9c36a', head: (hx, hy, r) => elfEars(c, hx, hy, r, f, '#f2d2b0'),
      armAng: f > 0 ? lerp(-1.4, 0.4, a.atk) : Math.PI - lerp(-1.4, 0.4, a.atk), weapon: (hx, hy, ang) => { const ex = hx + Math.cos(ang) * h * 0.3, ey = hy + Math.sin(ang) * h * 0.3; line(c, hx, hy, ex, ey, '#8b5a2b', 3); c.save(); c.strokeStyle = '#cfd6dc'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey, 7, ang - 2.2, ang - 0.4); c.stroke(); c.restore(); } });
    case 'elfarcher': return human(a, h, { skin: '#f2d2b0', cloth: '#2f8f4e', trim: '#d9c36a',
      head: (hx, hy, r) => { elfEars(c, hx, hy, r, f, '#f2d2b0'); c.beginPath(); c.arc(hx, hy, r * 1.12, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(hx - f * r * 1.5, hy + r * 0.3); c.closePath(); fillStroke(c, '#246b3b'); },
      armAng: f > 0 ? -0.18 : Math.PI + 0.18, weapon: (hx, hy) => bow(c, hx, hy, h * 0.34, f, a.atk, '#a8742c') });
    case 'bladedancer': return human(a, h, { skin: '#f2d2b0', cloth: '#1f8a8a', trim: '#e6c35c',
      head: (hx, hy, r) => { elfEars(c, hx, hy, r, f, '#f2d2b0'); c.save(); c.strokeStyle = '#e8e0c8'; c.lineWidth = r * 0.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx - f * r * 0.4, hy - r * 0.8); c.quadraticCurveTo(hx - f * r * 2, hy - r * 0.6 + Math.sin(a.t * 6) * 3, hx - f * r * 2.2, hy + r * 0.8); c.stroke(); c.restore(); },
      weapon: scimitar(c, f, h * 0.36), back: (sx, sy) => line(c, sx, sy + 6, sx - f * 16, sy + 20, '#e6ecf2', 2.5) });
    case 'druid': return human(a, h, { skin: '#f2d2b0', cloth: '#6b4f2a', trim: '#7fbf4a', robe: true,
      head: (hx, hy, r) => { elfEars(c, hx, hy, r, f, '#f2d2b0'); for (const sd of [-1, 1]) { c.save(); c.strokeStyle = '#8b6a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx + sd * r * 0.5, hy - r * 0.8); c.lineTo(hx + sd * r * 1.1, hy - r * 1.8); c.moveTo(hx + sd * r * 0.85, hy - r * 1.3); c.lineTo(hx + sd * r * 1.5, hy - r * 1.5); c.stroke(); c.restore(); } },
      armAng: f > 0 ? -1.1 : Math.PI + 1.1, weapon: (hx, hy) => { line(c, hx, hy - 10, hx, hy + h * 0.55, '#6b4423', 3); glowDot(c, hx, hy - 14, 5 + a.atk * 3, '#7dff9a'); } });
    case 'treant': return treant(a, h);
    case 'elkrider': return elkRider(a);
    case 'elfqueen': return human(a, h, { skin: '#f6e0c8', cloth: '#e8f0e0', trim: '#2f8f4e', robe: true,
      head: (hx, hy, r) => { elfEars(c, hx, hy, r, f, '#f6e0c8'); c.save(); c.strokeStyle = '#f2e6a8'; c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(hx, hy - r); c.quadraticCurveTo(hx - f * r * 2, hy, hx - f * r * 1.6, hy + r * 2.2); c.stroke(); c.restore(); for (let i = -2; i <= 2; i++) { c.fillStyle = '#3fae5a'; c.beginPath(); c.ellipse(hx + i * r * 0.4, hy - r * 1.05, r * 0.18, r * 0.35, i * 0.3, 0, 7); c.fill(); } },
      armAng: f > 0 ? -0.8 - a.atk * 0.5 : Math.PI + 0.8 + a.atk * 0.5, weapon: (hx, hy) => { line(c, hx, hy, hx, hy + h * 0.6, '#d9c36a', 3); glowDot(c, hx, hy - 6, 7 + a.atk * 4, '#8fff9a', '#f0fff0'); } });
    // --- Ghosts ---
    case 'wisp': { const y = gy - 22 + Math.sin(t * 3 + a.u.uid) * 4; smokeTail(c, x, y, gy - 4, f, '#9fd8ff', t); glowDot(c, x, y, 11, '#9fd8ff', '#ffffff'); eyes(c, x - f * 2, y - 2, 9, f, false, '#1b3a5a'); return; }
    case 'wraith': c.save(); c.globalAlpha *= 0.85; smokeTail(c, x, gy - h * 0.4, gy + 6, f, '#4a3a6a', t);
      human(a, h, { skin: '#2a2238', cloth: '#3a2f52', trim: '#7a5fb0', noLegs: true, glowEyes: '#b48cff',
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.15, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(hx + r, hy + r * 0.9); c.lineTo(hx - r, hy + r * 0.9); c.closePath(); fillStroke(c, '#2c2440'); eyes(c, hx, hy, r, f, true, '#c9a6ff'); },
        weapon: (hx, hy, ang) => { const b2 = ang - f * 0.6; const ex = hx + Math.cos(b2) * h * 0.5, ey = hy + Math.sin(b2) * h * 0.5; line(c, hx, hy, ex, ey, '#3a2f2a', 2.5); c.save(); c.strokeStyle = '#cfd6e6'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey + 10, 14, -Math.PI / 2 - f * 0.2, f > 0 ? 0.5 : Math.PI - 0.5, f < 0); c.stroke(); c.restore(); } });
      c.restore(); return;
    case 'banshee': c.save(); c.globalAlpha *= 0.82; smokeTail(c, x, gy - h * 0.45, gy, f, '#cfe0ff', t);
      human(a, h, { skin: '#dfe8ff', cloth: '#a8b8e8', trim: '#6c4bb4', noLegs: true,
        head: (hx, hy, r) => { c.save(); c.strokeStyle = '#eef2ff'; c.lineWidth = r * 0.5; for (const sd of [-0.6, 0.6]) { c.beginPath(); c.moveTo(hx + sd * r, hy - r * 0.6); c.quadraticCurveTo(hx + sd * r * 1.8 - f * r, hy + r, hx + sd * r * 1.3 - f * r * 1.4 + Math.sin(a.t * 4) * 3, hy + r * 2.4); c.stroke(); } c.restore(); },
        face: (hx, hy, r) => { eyes(c, hx, hy - r * 0.1, r, f, true, '#6c4bb4'); c.fillStyle = '#2a1a40'; c.beginPath(); c.ellipse(hx + f * r * 0.35, hy + r * 0.45, r * 0.18, r * (0.2 + a.atk * 0.25), 0, 0, 7); c.fill(); },
        armAng: f > 0 ? -0.4 : Math.PI + 0.4 });
      if (a.atk > 0.3) { c.strokeStyle = 'rgba(200,180,255,.5)'; c.lineWidth = 2; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(x + f * 10, gy - h * 0.82, 8 * k, f > 0 ? -0.6 : Math.PI - 0.6, f > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } }
      c.restore(); return;
    case 'specter': c.save(); c.globalAlpha *= 0.8;
      human(a, h, { skin: '#cfe0f4', cloth: '#7a8fb8', trim: '#3a4a8a', glowEyes: '#7df9ff', angry: true,
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.08, Math.PI, 0); c.closePath(); fillStroke(c, '#8fa0c0'); c.fillStyle = '#1e2a4a'; c.fillRect(hx - r, hy - r * 0.2, r * 2, r * 0.2); },
        weapon: scimitar(c, f, h * 0.42), back: (sx, sy) => ellipse(c, sx + f * h * 0.3, sy + h * 0.25, h * 0.12, h * 0.2, '#5a6a9a', 0, 2) });
      c.restore(); return;
    case 'phantom': c.save(); c.globalAlpha *= 0.85;
      human(a, h, { skin: '#3a3450', cloth: '#26213a', trim: '#b48cff', mask: '#14101f', glowEyes: '#ff5c8a',
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.1, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(hx - f * r * 1.4, hy + r * 0.2); c.closePath(); fillStroke(c, '#1e1a2e'); },
        weapon: (hx, hy, ang) => { const b2 = ang - f * 0.9; line(c, hx, hy, hx + Math.cos(b2) * h * 0.28, hy + Math.sin(b2) * h * 0.28, '#d8c8ff', 2.5); } });
      c.restore(); return;
    case 'ghostking': c.save(); c.globalAlpha *= 0.85; smokeTail(c, x, gy - h * 0.45, gy, f, '#b8a8ff', t);
      human(a, h, { skin: '#e0e6ff', cloth: '#4a3a8a', trim: '#ffd34d', noLegs: true, glowEyes: '#7df9ff', head: (hx, hy, r) => crownAt(c, hx, hy - r * 0.85, r * 0.7), weapon: scimitar(c, f, h * 0.5) });
      c.restore(); return;
    // --- Zombies ---
    case 'gravedigger': return human(a, h, { ...zombieLook(c, f, '#6a5a44'), armAng: f > 0 ? lerp(-1.3, 0.5, a.atk) : Math.PI - lerp(-1.3, 0.5, a.atk),
      weapon: (hx, hy, ang) => { const ex = hx + Math.cos(ang) * h * 0.38, ey = hy + Math.sin(ang) * h * 0.38; line(c, hx, hy, ex, ey, '#6b4423', 3); poly(c, [ex - 5, ey - 2, ex + 5, ey - 2, ex + 4, ey + 9, ex - 4, ey + 9], '#8a8f96', 1.5); } });
    case 'zombie': return human(a, h, { ...zombieLook(c, f, '#5a6a8a'), armAng: f > 0 ? -0.15 + a.atk * 0.3 : Math.PI + 0.15 - a.atk * 0.3 });
    case 'runner': { c.save(); c.translate(x, gy); c.rotate(f * 0.18); c.translate(-x, -gy); human(a, h, { ...zombieLook(c, f, '#8a3a2a'), armAng: f > 0 ? 0.3 : Math.PI - 0.3 }); c.restore(); return; }
    case 'bloater': human(a, h, { ...zombieLook(c, f, '#4a5a3a'), armAng: f > 0 ? 0.2 : Math.PI - 0.2 });
      ellipse(c, x + f * 4, gy - h * 0.45, h * 0.26, h * 0.24, '#9fbf5a');
      c.fillStyle = '#c6e070'; for (const [dx, dy] of [[-6, -6], [6, 4], [-2, 8], [8, -10]]) { c.beginPath(); c.arc(x + f * 4 + dx, gy - h * 0.45 + dy, 3, 0, 7); c.fill(); }
      return;
    case 'skelarcher': return skeleton(a, h, true);
    case 'abomination': return human(a, h, { ...zombieLook(c, f, '#6a5040'), skin: '#b8c9a0',
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.7; const ex = hx + Math.cos(b2) * h * 0.4, ey = hy + Math.sin(b2) * h * 0.4; line(c, hx, hy, ex, ey, '#5a3a2a', 4); c.save(); c.strokeStyle = '#9aa3ad'; c.lineWidth = 4; c.beginPath(); c.arc(ex + f * 6, ey, 9, -Math.PI / 2, Math.PI / 2, f < 0); c.stroke(); c.restore(); },
      head: (hx, hy, r) => { c.save(); c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx - r * 0.8, hy - r * 0.3); c.lineTo(hx + r * 0.6, hy + r * 0.4); for (let k = -3; k <= 3; k++) { const px = hx - r * 0.1 + k * r * 0.2, py = hy + k * r * 0.1; c.moveTo(px - 2, py - 3); c.lineTo(px + 2, py + 3); } c.stroke(); c.restore(); } });
    case 'necromancer': return human(a, h, { skin: '#c8d0b0', cloth: '#1e1a24', trim: '#7a3fb0', robe: true, glowEyes: '#7dff5c',
      head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.15, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(hx + r * 1.1, hy + r * 0.9); c.lineTo(hx - r * 1.1, hy + r * 0.9); c.closePath(); fillStroke(c, '#16121c'); eyes(c, hx, hy, r, f, true, '#7dff5c'); },
      armAng: f > 0 ? -1 + a.atk * 0.5 : Math.PI + 1 - a.atk * 0.5,
      weapon: (hx, hy) => { line(c, hx, hy - 6, hx, hy + h * 0.55, '#3a2a1a', 3); circle(c, hx, hy - 12, 6, '#ece6d6', 1.5); c.fillStyle = '#1b1b1b'; c.fillRect(hx - 3, hy - 13, 2, 2); c.fillRect(hx + 1, hy - 13, 2, 2); glowDot(c, hx, hy - 12, 3 + a.atk * 3, '#7dff5c'); } });
    case 'plaguelord': return human(a, h, { ...zombieLook(c, f, '#3a2a3a'), skin: '#8a9f6a', angry: true,
      head: (hx, hy, r) => crownAt(c, hx, hy - r * 0.9, r * 0.6),
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.7; const ex = hx + Math.cos(b2) * h * 0.45, ey = hy + Math.sin(b2) * h * 0.45; line(c, hx, hy, ex, ey, '#3a2a1a', 4); circle(c, ex, ey + 12, h * 0.07, '#5a5f66', 2); } });
    // --- Dwarves ---
    case 'dwarfminer': return human(a, h, { ...dwarfLook(c, f, '#7a5a3a', '#c97a3a'),
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#c97a3a'); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.05, Math.PI, 0); c.closePath(); fillStroke(c, '#c9a24a'); glowDot(c, hx + f * r * 0.3, hy - r * 0.75, 3, '#fff3a0'); },
      armAng: f > 0 ? lerp(-1.4, 0.4, a.atk) : Math.PI - lerp(-1.4, 0.4, a.atk),
      weapon: (hx, hy, ang) => { const ex = hx + Math.cos(ang) * h * 0.4, ey = hy + Math.sin(ang) * h * 0.4; line(c, hx, hy, ex, ey, '#8b5a2b', 3); const px = Math.cos(ang + Math.PI / 2) * 9, py = Math.sin(ang + Math.PI / 2) * 9; line(c, ex - px, ey - py, ex + px, ey + py, '#9aa3ad', 3); } });
    case 'axethrower': return human(a, h, { ...dwarfLook(c, f, '#3f6fa8', '#8a5a2a'),
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#8a5a2a'); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.05, Math.PI, 0); c.closePath(); fillStroke(c, '#9aa6b2'); for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.8, hy - r * 0.4, hx + sd * r * 1.6, hy - r * 1.4, hx + sd * r * 1.1, hy - r * 0.6], '#efe6d2', 1.5); },
      armAng: f > 0 ? lerp(-1.5, 0.2, a.atk) : Math.PI - lerp(-1.5, 0.2, a.atk), weapon: (hx, hy, ang) => axe(c, hx, hy, ang, h * 0.3, f) });
    case 'shieldwall': return human(a, h, { ...dwarfLook(c, f, '#4a5a6a', '#a8742c'),
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#a8742c'); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.08, Math.PI, 0); c.closePath(); fillStroke(c, '#b8c2cc'); c.fillStyle = '#8a95a0'; c.fillRect(hx - 1.5, hy - r * 0.2, 3, r * 0.7); },
      armAng: f > 0 ? 0.1 : Math.PI - 0.1,
      weapon: (hx, hy) => { c.beginPath(); c.roundRect(a.x + f * h * 0.12 - h * 0.17, gy - h * 0.82, h * 0.34, h * 0.7, 5); fillStroke(c, vgrad(c, '#3f6fa8', gy - h * 0.82, gy - h * 0.12), 2.5); circle(c, a.x + f * h * 0.12, gy - h * 0.47, h * 0.07, '#c9a24a', 1.5); void hx; void hy; } });
    case 'berserker': return human(a, h, { ...dwarfLook(c, f, '#8a3a2a', '#d0461f'), skin: '#e8a882', angry: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#d0461f'); c.save(); c.strokeStyle = '#d0461f'; c.lineWidth = r * 0.5; c.beginPath(); c.moveTo(hx - r * 0.3, hy - r * 0.9); c.lineTo(hx + r * 0.3, hy - r * 1.3); c.stroke(); c.restore(); },
      weapon: (hx, hy, ang) => axe(c, hx, hy, ang - f * 0.6, h * 0.36, f), back: (sx, sy) => axe(c, sx, sy + 10, Math.PI / 2 + f * 0.6, h * 0.3, -f) });
    case 'cannon': { c.beginPath(); c.roundRect(x - 26, gy - 20, 52, 10, 3); fillStroke(c, '#5a4030');
      for (const dx of [-18, 18]) { circle(c, x + dx, gy - 9, 9, '#4a3020'); }
      const rec = a.atk * 6;
      c.save(); c.translate(x - f * rec, gy - 30); c.rotate(-f * 0.25); c.beginPath(); c.roundRect(-14, -8, 44 * 1, 16, 6); c.restore();
      c.save(); c.translate(x - f * rec, gy - 30); c.scale(f, 1); c.rotate(-0.25); c.beginPath(); c.roundRect(-14, -8, 44, 16, 6); fillStroke(c, vgrad(c, '#4a4f56', -8, 8), 2.5); c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(30, 0, 5, 0, 7); c.fill(); c.restore();
      if (a.atk > 0.6) glowDot(c, x + f * 34, gy - 40, 7, '#ffb347');
      const gunner: ArtCtx = { ...a, x: x - f * 30 };
      human(gunner, 40, { ...dwarfLook(c, f, '#3f6fa8', '#8a5a2a'), head: (hx, hy, r) => beard(c, hx, hy, r, f, '#8a5a2a') }); return; }
    case 'gyrocopter': { const y = gy - 6;
      c.save(); c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x, y - 30); c.stroke(); c.restore();
      const sp = Math.sin(t * 40) * 30;
      c.save(); c.globalAlpha *= 0.7; c.fillStyle = '#cfd6dc'; c.beginPath(); c.ellipse(x, y - 31, Math.abs(sp) + 6, 2.5, 0, 0, 7); c.fill(); c.restore();
      ellipse(c, x, y - 10, 20, 11, '#c9a24a'); poly(c, [x - f * 18, y - 12, x - f * 34, y - 18, x - f * 34, y - 6], '#a8742c', 2);
      c.fillStyle = '#9fd8ff'; c.beginPath(); c.arc(x + f * 8, y - 14, 6, 0, 7); c.fill();
      beard(c, x + f * 2, y - 18, 7, f, '#8a5a2a'); circle(c, x + f * 2, y - 22, 6, '#e6b48a', 1.5);
      line(c, x + f * 14, y - 6, x + f * 26, y - 6, '#4a4f56', 3); return; }
    case 'dwarfking': return human(a, h, { ...dwarfLook(c, f, '#7a1f3a', '#e8e0d0'), angry: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#e8e0d0', true); crownAt(c, hx, hy - r * 0.9, r * 0.65); },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.8; const ex = hx + Math.cos(b2) * h * 0.5, ey = hy + Math.sin(b2) * h * 0.5; line(c, hx, hy, ex, ey, '#6b4423', 4); c.save(); c.translate(ex, ey); c.rotate(b2); c.beginPath(); c.roundRect(-8, -12, 16, 24, 3); fillStroke(c, vgrad(c, '#b8c2cc', -12, 12), 2.5); c.restore(); } });
    // --- Giants ---
    case 'goblin': return human(a, h, { ...goblinLook(c, f), armAng: f > 0 ? lerp(-1.4, 0.4, a.atk) : Math.PI - lerp(-1.4, 0.4, a.atk),
      weapon: (hx, hy, ang) => { const ex = hx + Math.cos(ang) * h * 0.3, ey = hy + Math.sin(ang) * h * 0.3; line(c, hx, hy, ex, ey, '#8b5a2b', 3); line(c, ex - 6, ey - 3, ex + 6, ey + 3, '#9aa3ad', 3); } });
    case 'goblinspear': return human(a, h, { ...goblinLook(c, f), armAng: f > 0 ? 0.05 : Math.PI - 0.05,
      weapon: (hx, hy) => { const push = a.atk * 8 * f; line(c, hx - f * 16 + push, hy, hx + f * 34 + push, hy, '#8b5a2b', 2.5); poly(c, [hx + f * 34 + push, hy - 4, hx + f * 44 + push, hy, hx + f * 34 + push, hy + 4], '#cfd6dc', 1.5); } });
    case 'ogre': return human(a, h, { skin: '#a8b06a', cloth: '#6b4a2a', trim: '#3a2a1a', angry: true,
      face: (hx, hy, r) => { eyes(c, hx, hy - r * 0.15, r, f, true); c.fillStyle = '#f4ecd8'; poly(c, [hx + f * r * 0.15, hy + r * 0.45, hx + f * r * 0.25, hy + r * 0.15, hx + f * r * 0.35, hy + r * 0.45], '#f4ecd8', 1); poly(c, [hx + f * r * 0.55, hy + r * 0.45, hx + f * r * 0.65, hy + r * 0.15, hx + f * r * 0.75, hy + r * 0.45], '#f4ecd8', 1); },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.8; const ex = hx + Math.cos(b2) * h * 0.48, ey = hy + Math.sin(b2) * h * 0.48; line(c, hx, hy, ex, ey, '#7a4f28', 8); circle(c, ex, ey, h * 0.09, '#6b4423', 2.5); } });
    case 'troll': return human(a, h, { skin: '#7a9aa8', cloth: '#4a3a2a', trim: '#2a1a10', angry: true,
      head: (hx, hy, r) => { c.save(); c.strokeStyle = '#3a4a3a'; c.lineWidth = r * 0.25; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(hx + k * r * 0.25, hy - r * 0.9); c.lineTo(hx + k * r * 0.35 - f * r * 0.4, hy - r * 1.6); c.stroke(); } c.restore(); },
      face: (hx, hy, r) => { eyes(c, hx, hy - r * 0.1, r, f, true, '#ffcf3d'); for (const k of [0.15, 0.65]) poly(c, [hx + f * r * (k - 0.08), hy + r * 0.5, hx + f * r * k, hy + r * 0.05, hx + f * r * (k + 0.08), hy + r * 0.5], '#f4ecd8', 1); },
      armAng: f > 0 ? lerp(-1, 0.9, a.atk) : Math.PI - lerp(-1, 0.9, a.atk) });
    case 'cyclops': return human(a, h, { skin: '#c9a882', cloth: '#5a4a6a', trim: '#2a1a10',
      face: (hx, hy, r) => { const ex = hx + f * r * 0.35; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, hy - r * 0.05, r * 0.32, r * 0.36, 0, 0, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#7a3a1a'; c.beginPath(); c.arc(ex + f * r * 0.08, hy, r * 0.17, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(ex + f * r * 0.1, hy, r * 0.08, 0, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - r * 0.4, hy - r * 0.48); c.lineTo(ex + r * 0.4, hy - r * 0.38); c.stroke(); },
      armAng: f > 0 ? lerp(-2.2, -0.3, a.atk) : Math.PI - lerp(-2.2, -0.3, a.atk),
      weapon: (hx, hy) => { if (a.atk < 0.6) circle(c, hx + f * h * 0.04, hy - h * 0.2, h * 0.1, '#8d8578', 2); } });
    case 'frostgiant': return human(a, h, { skin: '#9fc8e8', cloth: '#3a5f8a', trim: '#e8f4ff', angry: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#f4fbff', true); poly(c, [hx - r * 0.9, hy - r * 0.7, hx - r * 0.5, hy - r * 1.5, hx - r * 0.1, hy - r * 0.9, hx + r * 0.3, hy - r * 1.6, hx + r * 0.6, hy - r * 0.9, hx + r * 0.9, hy - r * 1.4, hx + r, hy - r * 0.6], '#d8f0ff', 1.5); },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.8; const ex = hx + Math.cos(b2) * h * 0.5, ey = hy + Math.sin(b2) * h * 0.5; line(c, hx, hy, ex, ey, '#bfe4ff', 7); poly(c, [ex - 8, ey, ex, ey - 16, ex + 8, ey, ex, ey + 12], '#e8f8ff', 2); } });
    case 'giantking': return human(a, h, { skin: '#c9a882', cloth: '#5a1f2a', trim: '#ffd34d', angry: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#8a5a2a', true); crownAt(c, hx, hy - r * 0.9, r * 0.7); },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.8; const ex = hx + Math.cos(b2) * h * 0.5, ey = hy + Math.sin(b2) * h * 0.5; line(c, hx, hy, ex, ey, '#6b4423', 6); c.save(); c.translate(ex, ey); c.rotate(b2); c.beginPath(); c.roundRect(-12, -16, 24, 32, 4); fillStroke(c, vgrad(c, '#8d8578', -16, 16), 2.5); c.restore(); } });
    // --- Premium legends ---
    case 'sultan': return human(a, h, { skin, cloth: '#7a1fa8', trim: '#ffd34d',
      back: (sx, sy) => poly(c, [sx - 10, sy - 6, sx + 10, sy - 6, sx - f * 32 + Math.sin(t * 3) * 4, gy - 4, sx - f * 6, gy - 2], '#c0392b'),
      head: (hx, hy, r) => { c.beginPath(); c.ellipse(hx, hy - r * 0.55, r * 1.2, r * 0.75, 0, Math.PI, 0); c.closePath(); fillStroke(c, vgrad(c, '#fff6e0', hy - r * 1.3, hy)); c.save(); c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - r * 1.1, hy - r * 0.6); c.quadraticCurveTo(hx, hy - r * 1.2, hx + r * 1.1, hy - r * 0.6); c.stroke(); c.restore(); glowDot(c, hx + f * r * 0.1, hy - r * 0.95, r * 0.2, '#e0453a', '#ffd0d0'); c.save(); c.strokeStyle = '#3a2210'; c.lineWidth = r * 0.25; c.beginPath(); c.moveTo(hx + f * r * 0.1, hy + r * 0.55); c.quadraticCurveTo(hx + f * r * 0.4, hy + r * 0.75, hx + f * r * 0.75, hy + r * 0.5); c.stroke(); c.restore(); },
      weapon: (hx, hy, ang) => { scimitar(c, f, h * 0.55)(hx, hy, ang); glowDot(c, hx, hy, 3, '#ffd34d'); } });
    case 'dragon': return dragon(a);
    case 'shadowqueen': return human(a, h, { skin: '#e8c0a0', cloth: '#2a1a3a', trim: '#c9a6ff', angry: true,
      back: (sx, sy) => poly(c, [sx - 9, sy - 5, sx + 9, sy - 5, sx - f * 30 + Math.sin(t * 5) * 4, gy - 4, sx - f * 6, gy - 2], '#4a1f6a'),
      head: (hx, hy, r) => { c.save(); c.strokeStyle = '#1a0f24'; c.lineWidth = r * 0.5; c.beginPath(); c.moveTo(hx, hy - r); c.quadraticCurveTo(hx - f * r * 2.2, hy - r * 0.2, hx - f * r * 1.7, hy + r * 1.9); c.stroke(); c.restore(); crownAt(c, hx, hy - r * 0.95, r * 0.5); c.fillStyle = '#1a0f24'; c.beginPath(); c.arc(hx, hy + r * 0.25, r * 0.95, 0.25, Math.PI - 0.25); c.closePath(); c.globalAlpha *= 0.85; c.fill(); c.globalAlpha /= 0.85; },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.9; line(c, hx, hy, hx + Math.cos(b2) * h * 0.32, hy + Math.sin(b2) * h * 0.32, '#e0ccff', 2.6); glowDot(c, hx + Math.cos(b2) * h * 0.32, hy + Math.sin(b2) * h * 0.32, 3, '#b48cff'); },
      armAng: f > 0 ? lerp(-1.4, 0.7, a.atk) : Math.PI - lerp(-1.4, 0.7, a.atk) });
    case 'guardian': { rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#c9a24a', true, '#7fe0ff'); glowDot(c, x, gy - h * 0.48, 6 + Math.sin(t * 3) * 1.5, '#7fe0ff'); return; }
    case 'firebird': { c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(255,${140 + i * 15},40,${0.28 - i * 0.03})`; c.beginPath(); c.arc(x - f * (24 + i * 13), gy - 18 + Math.sin(t * 8 + i) * 5, 13 - i, 0, 7); c.fill(); } c.restore();
      bird(a, gy - 10, h, '#ffb02e', '#ff5a1f', { crest: '#fff07a', beak: '#ffe08a' });
      const rider: ArtCtx = { ...a, gy: gy - h * 0.36, swing: 0 };
      human(rider, 36, { skin: '#f2d2b0', cloth: '#c0392b', trim: '#ffd34d', noLegs: true, head: turban(c, '#ffd34d'), armAng: f > 0 ? -0.3 : Math.PI + 0.3, weapon: (hx, hy) => glowDot(c, hx, hy, 4 + a.atk * 3, '#ff9a3d', '#fff0b0') });
      return; }

    case 'pharaoh': return human(a, h, { skin: '#c98f62', cloth: '#f4ecd8', trim: '#2a6fb5', robe: true,
      head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.08, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(hx + r * 0.9, hy - r * 0.45); c.quadraticCurveTo(hx, hy - r * 0.75, hx - r * 0.9, hy - r * 0.45); c.closePath(); fillStroke(c, '#ffd34d');
        for (const sd of [-1, 1]) { poly(c, [hx + sd * r * 0.85, hy - r * 0.5, hx + sd * r * 1.3, hy - r * 0.2, hx + sd * r * 1.25, hy + r * 1.3, hx + sd * r * 0.8, hy + r * 1.0], '#ffd34d', 2); c.fillStyle = '#2a6fb5'; for (let i = 0; i < 4; i++) c.fillRect(hx + sd * r * 1.05 - r * 0.2, hy - r * 0.05 + i * r * 0.32, r * 0.4, r * 0.12); }
        poly(c, [hx - r * 0.12, hy - r * 1.05, hx, hy - r * 1.5, hx + r * 0.12, hy - r * 1.05], '#2a6fb5', 1.4); c.fillStyle = '#1b1b1b'; c.fillRect(hx + f * r * 0.15, hy + r * 0.6, f * r * 0.2, r * 0.45); },
      armAng: f > 0 ? -0.9 - a.atk * 0.4 : Math.PI + 0.9 + a.atk * 0.4,
      weapon: (hx, hy) => { line(c, hx, hy - 6, hx, hy + h * 0.55, '#ffd34d', 3); c.save(); c.strokeStyle = '#ffd34d'; c.lineWidth = 3; c.beginPath(); c.arc(hx, hy - 12, 6, Math.PI, 0); c.stroke(); c.restore(); glowDot(c, hx, hy - 12, 4 + a.atk * 3, '#7fd8ff'); } });
    case 'valkyrie': { const y = gy - 8 + Math.sin(t * 3 + a.u.uid) * 3; const flap = Math.sin(t * 6);
      for (const sd of [1, -1]) { c.save(); c.translate(x - f * 4, y - h * 0.7); c.scale(-f, 1); c.rotate(sd * 0.15 - 0.4 + flap * 0.25 * sd);
        for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#f4f8ff' : '#dfe8f6'; c.strokeStyle = '#22140a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(14 + k * 9, -6 - k * 5, 18 - k * 2, 6, -0.5 - k * 0.12, 0, 7); c.fill(); c.stroke(); } c.restore(); }
      human({ ...a, gy: y }, h, { skin: '#f2d2b0', cloth: '#3f6fa8', trim: '#ffd34d', noLegs: true,
        head: (hx, hy, r) => { c.save(); c.strokeStyle = '#f2e6a8'; c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(hx, hy - r); c.quadraticCurveTo(hx - f * r * 2, hy, hx - f * r * 1.6, hy + r * 2); c.stroke(); c.restore(); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.06, Math.PI, 0); c.closePath(); fillStroke(c, vgrad(c, '#d5dde5', hy - r * 1.2, hy)); for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.9, hy - r * 0.4, hx + sd * r * 1.8, hy - r * 1.2, hx + sd * r * 1.3, hy - r * 0.3], '#ffffff', 1.4); },
        armAng: f > 0 ? -0.3 - a.atk * 0.4 : Math.PI + 0.3 + a.atk * 0.4,
        weapon: (hx, hy, ang) => { const ex = hx + Math.cos(ang) * h * 0.6, ey = hy + Math.sin(ang) * h * 0.6; line(c, hx - Math.cos(ang) * 12, hy - Math.sin(ang) * 12, ex, ey, '#c9a24a', 3); poly(c, [ex - 4, ey - 4, ex + Math.cos(ang) * 14, ey + Math.sin(ang) * 14, ex + 4, ey + 4], '#dfe6ec', 1.5); if (a.atk > 0.2) glowDot(c, ex, ey, 6, '#bfe8ff'); } });
      return; }
    // --- civilization specials & heroes ---
    case 'sprite': { const y = gy - 6 + Math.sin(t * 5 + a.u.uid) * 3;
      for (const sd of [-1, 1]) { c.save(); c.globalAlpha *= 0.6; c.fillStyle = '#c8f4ff'; c.beginPath(); c.ellipse(x - f * 4 + sd * 2, y - 26, 9, 5 + Math.abs(Math.sin(t * 20)) * 4, sd * 0.6, 0, 7); c.fill(); c.restore(); }
      human({ ...a, gy: y }, h, { skin: '#f2d2b0', cloth: '#5fbf6a', trim: '#f2e6a8', noLegs: true, head: (hx, hy, r) => elfEars(c, hx, hy, r, f, '#f2d2b0'), armAng: f > 0 ? -0.15 : Math.PI + 0.15, weapon: (hx, hy) => bow(c, hx, hy, h * 0.3, f, a.atk, '#d9c36a') });
      glowDot(c, x, y + 2, 3, '#fff6a0'); return; }
    case 'moonarcher': human(a, h, { skin: '#f6e0c8', cloth: '#2a4a8a', trim: '#cfe0ff',
      head: (hx, hy, r) => { elfEars(c, hx, hy, r, f, '#f6e0c8'); c.save(); c.strokeStyle = '#e8eef8'; c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(hx, hy - r); c.quadraticCurveTo(hx - f * r * 2.2, hy - r * 0.2, hx - f * r * 1.8, hy + r * 1.8); c.stroke(); c.restore(); c.fillStyle = '#e8f0ff'; c.beginPath(); c.arc(hx, hy - r * 1.05, r * 0.32, 0.3, Math.PI * 2 - 0.3); c.fill(); },
      back: (sx, sy) => poly(c, [sx - 8, sy - 4, sx + 8, sy - 4, sx - f * 24 + Math.sin(t * 3) * 3, gy - 6, sx - f * 4, gy - 4], '#1e3a6e'),
      armAng: f > 0 ? -0.15 : Math.PI + 0.15, weapon: (hx, hy) => { bow(c, hx, hy, h * 0.36, f, a.atk, '#cfe0ff'); glowDot(c, hx + f * 4, hy, 3 + a.atk * 3, '#9fd8ff'); } });
      return;
    case 'poltergeist': { c.save(); c.globalAlpha *= 0.8; smokeTail(c, x, gy - h * 0.4, gy, f, '#b8a8e8', t);
      human(a, h, { skin: '#d8d0f4', cloth: '#7a6ab8', trim: '#3a2a6a', noLegs: true, glowEyes: '#ffef5c', armAng: f > 0 ? -1.2 + a.atk * 1.4 : Math.PI + 1.2 - a.atk * 1.4,
        weapon: (hx, hy) => { if (a.atk < 0.5) { c.save(); c.translate(hx, hy - 8); c.rotate(t * 4); c.beginPath(); c.roundRect(-6, -5, 12, 10, 2); fillStroke(c, '#8a5a2a', 1.5); c.restore(); } } });
      c.restore(); return; }
    case 'soulreaper': { c.save(); c.globalAlpha *= 0.9; smokeTail(c, x, gy - h * 0.4, gy + 6, f, '#2a1f3a', t);
      human(a, h, { skin: '#1a1424', cloth: '#2a1f3a', trim: '#7dff9a', noLegs: true,
        head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy, r * 1.2, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(hx + r * 1.1, hy + r); c.lineTo(hx - r * 1.1, hy + r); c.closePath(); fillStroke(c, '#18121f'); circle(c, hx + f * r * 0.15, hy + r * 0.05, r * 0.6, '#ece6d6', 1.2); eyes(c, hx + f * r * 0.1, hy, r * 0.6, f, true, '#7dff9a'); },
        weapon: (hx, hy, ang) => { const b2 = ang - f * 0.5; const ex = hx + Math.cos(b2) * h * 0.6, ey = hy + Math.sin(b2) * h * 0.6; line(c, hx, hy, ex, ey, '#2a1f1a', 3); c.save(); c.strokeStyle = '#d8ffe0'; c.lineWidth = 4; c.beginPath(); c.arc(ex, ey + 14, 20, -Math.PI / 2 - f * 0.2, f > 0 ? 0.5 : Math.PI - 0.5, f < 0); c.stroke(); c.restore(); glowDot(c, ex, ey, 3, '#7dff9a'); } });
      c.restore(); return; }
    case 'ghoul': { c.save(); c.translate(x, gy); c.rotate(f * 0.25); c.translate(-x, -gy);
      human(a, h, { skin: '#9aa88a', cloth: '#3a3028', trim: '#1a1410', angry: true, glowEyes: '#ffef5c', armAng: f > 0 ? 0.4 - a.atk * 0.6 : Math.PI - 0.4 + a.atk * 0.6,
        weapon: (hx, hy) => { c.save(); c.strokeStyle = '#f4ecd8'; c.lineWidth = 1.8; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + f * 9, hy + k * 4 + 3); c.stroke(); } c.restore(); } });
      c.restore(); return; }
    case 'lich': return human(a, h, { skin: '#ece6d6', cloth: '#2a1f3a', trim: '#7dff5c', robe: true,
      face: (hx, hy, r) => { c.fillStyle = '#1b1b1b'; for (const k of [0.1, 0.55]) { c.beginPath(); c.arc(hx + f * r * k, hy - r * 0.05, r * 0.2, 0, 7); c.fill(); } glowDot(c, hx + f * r * 0.1, hy - r * 0.05, r * 0.09, '#7dff5c'); glowDot(c, hx + f * r * 0.55, hy - r * 0.05, r * 0.09, '#7dff5c'); for (let k = 0; k < 4; k++) c.fillRect(hx + f * r * (0.15 + k * 0.12), hy + r * 0.45, f * r * 0.07, r * 0.15); },
      head: (hx, hy, r) => crownAt(c, hx, hy - r * 0.85, r * 0.55),
      armAng: f > 0 ? -1 + a.atk * 0.5 : Math.PI + 1 - a.atk * 0.5,
      weapon: (hx, hy) => { line(c, hx, hy - 10, hx, hy + h * 0.55, '#3a2a1a', 3); poly(c, [hx - 7, hy - 10, hx, hy - 24, hx + 7, hy - 10], '#7dff5c', 1.5); glowDot(c, hx, hy - 15, 4 + a.atk * 4, '#7dff5c'); } });
    case 'runepriest': return human(a, h, { ...dwarfLook(c, f, '#e8e0d0', '#e8e0d0'), robe: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#e8e0d0', true); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.05, Math.PI, 0); c.closePath(); fillStroke(c, '#3f6fa8'); },
      armAng: f > 0 ? -1.1 : Math.PI + 1.1, weapon: (hx, hy) => { line(c, hx, hy - 8, hx, hy + h * 0.5, '#6b4423', 3); c.beginPath(); c.roundRect(hx - 6, hy - 18, 12, 12, 2); fillStroke(c, '#8a95a0', 1.5); glowDot(c, hx, hy - 12, 3 + a.atk * 3, '#7fd8ff'); } });
    case 'thunderlord': human(a, h, { ...dwarfLook(c, f, '#2a3f6a', '#d8d0c0'), angry: true,
      head: (hx, hy, r) => { beard(c, hx, hy, r, f, '#d8d0c0', true); c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.08, Math.PI, 0); c.closePath(); fillStroke(c, '#c9a24a'); for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.9, hy - r * 0.4, hx + sd * r * 1.8, hy - r * 1.2, hx + sd * r * 1.3, hy - r * 0.4], '#fffaf0', 1.4); },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.8; const ex = hx + Math.cos(b2) * h * 0.42, ey = hy + Math.sin(b2) * h * 0.42; line(c, hx, hy, ex, ey, '#6b4423', 3.5); c.save(); c.translate(ex, ey); c.rotate(b2); c.beginPath(); c.roundRect(-7, -10, 14, 20, 3); fillStroke(c, vgrad(c, '#b8c2cc', -10, 10), 2); c.restore(); if (a.atk > 0.2) glowDot(c, ex, ey, 6, '#bfe8ff'); } });
      return;
    case 'mammoth': return mammoth(a);
    case 'colossus': return rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#8a7f72', true, '#ffb347');
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

function horseRider(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, x, gy, f, swing } = a;
  const col = a.side ? '#5a3a2a' : '#8b5a33';
  const by = gy - 34 - Math.abs(Math.sin(a.u.anim)) * 3;
  for (const [dx, k] of [[-16, 1], [-9, -1], [12, -1], [19, 1]] as [number, number][]) line(c, x + f * dx, by + 8, x + f * dx + Math.sin(swing * k * 1.3) * 11, gy - 2, col, 5);
  c.save(); c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.moveTo(x - f * 24, by - 2); c.quadraticCurveTo(x - f * 36, by + 4 + Math.sin(a.t * 6) * 3, x - f * 32, by + 18); c.stroke(); c.restore();
  ellipse(c, x, by, 26, 12, col);
  poly(c, [x + f * 18, by - 4, x + f * 30, by - 28, x + f * 38, by - 26, x + f * 28, by + 2], col);
  ellipse(c, x + f * 40, by - 25, 9, 6, col, f * 0.3);
  eyes(c, x + f * 37, by - 28, 5, f, false);
  poly(c, [x + f * 26, by - 30, x + f * 22, by - 22, x + f * 18, by - 8, x + f * 24, by - 12], '#2a1a10', 1.5); // mane
  c.fillStyle = cloth; c.beginPath(); c.roundRect(x - 12, by - 10, 24, 12, 3); c.fill(); c.stroke();
  const rider: ArtCtx = { ...a, gy: by - 4, swing: 0 };
  human(rider, 42, {
    skin, cloth: '#c9d2dc', trim,
    head: (hx, hy, r) => { c.beginPath(); c.arc(hx, hy - r * 0.1, r * 1.05, Math.PI, 0); c.closePath(); fillStroke(c, '#c9d2dc'); poly(c, [hx - 2, hy - r * 1.1, hx, hy - r * 1.7, hx + 2, hy - r * 1.1], cloth, 1.5); },
    noLegs: true, armAng: f > 0 ? 0.25 - a.atk * 0.25 : Math.PI - 0.25 + a.atk * 0.25,
    weapon: (hx, hy) => { const push = a.atk * 10 * f; line(c, hx - f * 14 + push, hy, hx + f * 40 + push, hy - 4, '#8b5a2b', 2.5); poly(c, [hx + f * 40 + push, hy - 8, hx + f * 52 + push, hy - 5, hx + f * 40 + push, hy - 1], '#dfe6ec', 1.5); },
  });
}

function elephant(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, x, gy, f, swing, atk } = a;
  const s = a.u.def.height / 105;
  const col = '#8f8a86';
  const by = gy - 48 * s - Math.abs(Math.sin(a.u.anim)) * 2;
  for (const [dx, k] of [[-26, 1], [-12, -1], [16, -1], [28, 1]] as [number, number][]) { line(c, x + f * dx * s, by + 18 * s, x + f * dx * s + Math.sin(swing * k * 0.6) * 6, gy - 4, col, 11 * s); ellipse(c, x + f * dx * s + Math.sin(swing * k * 0.6) * 6, gy - 3, 7 * s, 3 * s, shade(col, -0.2), 0, 1.5); }
  ellipse(c, x, by, 44 * s, 28 * s, col);
  // howdah
  c.fillStyle = cloth; c.beginPath(); c.roundRect(x - 26 * s, by - 46 * s, 44 * s, 22 * s, 4); fillStroke(c, vgrad(c, cloth, by - 46 * s, by - 24 * s));
  c.fillStyle = trim; c.fillRect(x - 30 * s, by - 26 * s, 52 * s, 6 * s);
  poly(c, [x - 30 * s, by - 46 * s, x - 4 * s, by - 62 * s, x + 22 * s, by - 46 * s], trim);
  // head + ear + trunk + tusk
  const hx = x + f * 40 * s, hy = by - 8 * s;
  ellipse(c, hx - f * 6 * s, hy, 16 * s, 22 * s, shade(col, -0.08), f * 0.2);
  circle(c, hx, hy - 6 * s, 20 * s, col);
  const tr = -0.3 + atk * 1.4;
  c.save(); c.strokeStyle = OUT; c.lineCap = 'round'; c.lineWidth = 12 * s + 2.6;
  const ex = hx + f * (14 + Math.sin(tr) * 20) * s, ey = hy + (38 - atk * 30) * s;
  c.beginPath(); c.moveTo(hx + f * 12 * s, hy + 2 * s); c.quadraticCurveTo(hx + f * 26 * s, hy + 20 * s, ex, ey); c.stroke();
  c.strokeStyle = col; c.lineWidth = 12 * s; c.stroke(); c.restore();
  poly(c, [hx + f * 10 * s, hy + 6 * s, hx + f * 30 * s, hy + 12 * s, hx + f * 12 * s, hy + 12 * s], '#f4ecd8', 1.5);
  eyes(c, hx + f * 2 * s, hy - 10 * s, 12 * s, f, a.side === 1);
  void skin;
}

function mummy(a: ArtCtx, h: number, king: boolean) {
  const { c } = a;
  human(a, h, {
    skin: '#d8ccaa', cloth: '#cbbd98', trim: king ? '#ffd34d' : '#9c8d6a', glowEyes: king ? '#ff4d4d' : '#9effa0', angry: true,
    armAng: a.f > 0 ? -0.1 + a.atk * 0.3 : Math.PI + 0.1 - a.atk * 0.3,
    head: (hx, hy, r) => {
      c.save(); c.strokeStyle = 'rgba(110,95,60,.6)'; c.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx - r, hy + i * r * 0.32); c.lineTo(hx + r, hy + i * r * 0.32 - r * 0.2); c.stroke(); }
      c.restore();
      if (king) {
        // golden headdress: a band over the brow and striped side flaps, face left visible
        c.beginPath(); c.arc(hx, hy, r * 1.08, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(hx + r * 0.9, hy - r * 0.45); c.quadraticCurveTo(hx, hy - r * 0.75, hx - r * 0.9, hy - r * 0.45); c.closePath(); fillStroke(c, '#ffd34d');
        for (const sd of [-1, 1]) {
          poly(c, [hx + sd * r * 0.85, hy - r * 0.5, hx + sd * r * 1.25, hy - r * 0.2, hx + sd * r * 1.2, hy + r * 1.1, hx + sd * r * 0.8, hy + r * 0.9], '#ffd34d', 2);
          c.fillStyle = '#2a6fb5'; for (let i = 0; i < 3; i++) c.fillRect(hx + sd * r * 1.02 - r * 0.18, hy - r * 0.05 + i * r * 0.35, r * 0.36, r * 0.12);
        }
        crownAt(c, hx, hy - r * 0.95, r * 0.5);
      }
    },
    weapon: king ? scimitar(c, a.f, h * 0.5) : undefined,
  });
  // loose bandage strip
  c.save(); c.strokeStyle = '#cbbd98'; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x - a.f * 6, a.gy - h * 0.45); c.quadraticCurveTo(a.x - a.f * 20, a.gy - h * 0.35 + Math.sin(a.t * 4) * 4, a.x - a.f * 26, a.gy - h * 0.2); c.stroke(); c.restore();
}

function skeleton(a: ArtCtx, h: number, archer = false) {
  const { c, x, gy, f, swing } = a;
  const bone = '#ece6d6';
  const R = h * 0.19, headY = gy - h + R, hip = gy - h * 0.32;
  for (const sw of [swing, -swing]) line(c, x, hip, x + Math.sin(sw) * h * 0.28, gy - 2, bone, 2.5);
  line(c, x, hip, x, headY + R, bone, 3);
  for (let i = 0; i < 3; i++) line(c, x - R * 0.6, headY + R * 1.4 + i * 5, x + R * 0.6, headY + R * 1.4 + i * 5, bone, 1.6);
  line(c, x, headY + R * 1.2, x - f * Math.sin(swing) * h * 0.18, headY + R + h * 0.22, bone, 2.2);
  circle(c, x, headY, R, bone);
  c.fillStyle = '#1b1b1b';
  for (const k of [0.1, 0.55]) { c.beginPath(); c.arc(x + f * R * k, headY - R * 0.05, R * 0.2, 0, 7); c.fill(); }
  c.fillStyle = '#ff5c3d'; for (const k of [0.1, 0.55]) { c.beginPath(); c.arc(x + f * R * k, headY - R * 0.05, R * 0.07, 0, 7); c.fill(); }
  c.fillRect(x + f * R * 0.2, headY + R * 0.5, R * 0.5 * f, 2);
  const ang = archer ? (f > 0 ? -0.15 : Math.PI + 0.15) : f > 0 ? lerp(-1.25, 0.55, a.atk) : Math.PI - lerp(-1.25, 0.55, a.atk);
  const sx = x + f * R * 0.3, sy = headY + R * 1.2;
  const hx = sx + Math.cos(ang) * h * 0.24, hy = sy + Math.sin(ang) * h * 0.24;
  line(c, sx, sy, hx, hy, bone, 2.2);
  if (archer) bow(c, hx, hy, h * 0.3, f, a.atk, '#5a4a3a');
  else scimitar(c, f, h * 0.38)(hx, hy, ang);
}

function cobra(a: ArtCtx, h: number, queen: boolean) {
  const { c, x, gy, f, t, atk } = a;
  const col = queen ? '#3f7d4a' : '#6f8f3a';
  const belly = queen ? '#e8d27a' : '#d9c98a';
  const s = h / 40;
  // coils on the ground
  c.save(); c.strokeStyle = OUT; c.lineCap = 'round'; c.lineWidth = 10 * s + 2.6;
  const path = () => { c.beginPath(); c.moveTo(x - f * 30 * s, gy - 5 * s); c.quadraticCurveTo(x - f * 10 * s, gy + 2 * s + Math.sin(t * 5) * 2, x, gy - 8 * s); c.quadraticCurveTo(x + f * 6 * s, gy - 26 * s, x + f * (4 + atk * 14) * s, gy - 34 * s); };
  path(); c.stroke(); c.strokeStyle = col; c.lineWidth = 10 * s; path(); c.stroke(); c.restore();
  const hx = x + f * (6 + atk * 14) * s, hy = gy - 38 * s;
  ellipse(c, hx - f * 2 * s, hy + 4 * s, 11 * s, 13 * s, col); // hood
  c.fillStyle = belly; c.beginPath(); c.ellipse(hx - f * 1 * s, hy + 6 * s, 5 * s, 9 * s, 0, 0, 7); c.fill();
  ellipse(c, hx + f * 3 * s, hy - 4 * s, 7 * s, 5.5 * s, col);
  eyes(c, hx + f * 1 * s, hy - 5 * s, 7 * s, f, true, queen ? '#ff4d4d' : '#ffe14d');
  if (atk > 0.3) { c.strokeStyle = '#e0453a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx + f * 9 * s, hy - 3 * s); c.lineTo(hx + f * 15 * s, hy - 2 * s); c.stroke(); }
  if (queen) crownAt(c, hx + f * 1 * s, hy - 8 * s, 6 * s);
}

// ---------------- civilization helpers ----------------
function elfEars(c: C, hx: number, hy: number, r: number, f: number, skin: string) {
  poly(c, [hx - f * r * 0.85, hy - r * 0.1, hx - f * r * 1.7, hy - r * 0.75, hx - f * r * 0.9, hy + r * 0.25], skin, 1.5);
}
function bow(c: C, hx: number, hy: number, r: number, f: number, atk: number, col: string) {
  c.lineWidth = 3.5; c.strokeStyle = col; c.beginPath();
  if (f > 0) c.arc(hx - r * 0.3, hy, r, -1.15, 1.15); else c.arc(hx + r * 0.3, hy, r, Math.PI - 1.15, Math.PI + 1.15);
  c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = 1.2;
  const tipX = hx - f * r * 0.3 + f * Math.cos(1.15) * r;
  c.beginPath(); c.moveTo(tipX, hy - Math.sin(1.15) * r); c.lineTo(hx - f * (6 + atk * 10), hy); c.lineTo(tipX, hy + Math.sin(1.15) * r); c.stroke(); c.strokeStyle = OUT;
}
function beard(c: C, hx: number, hy: number, r: number, f: number, col: string, long = false) {
  c.beginPath(); c.moveTo(hx - r * 0.75, hy + r * 0.05); c.quadraticCurveTo(hx + f * r * 0.3, hy + r * (long ? 2.2 : 1.6), hx + r * 0.85, hy + r * 0.05);
  c.quadraticCurveTo(hx + f * r * 0.3, hy + r * 0.55, hx - r * 0.75, hy + r * 0.05); c.closePath(); fillStroke(c, col, 1.5);
}
function axe(c: C, hx: number, hy: number, ang: number, len: number, f: number) {
  const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
  line(c, hx, hy, ex, ey, '#7a4f28', 3);
  c.save(); c.translate(ex, ey); c.rotate(ang); c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(4, -12 * f, -8, -14 * f); c.lineTo(-10, 2 * f); c.closePath(); fillStroke(c, '#c9d2dc', 1.8); c.restore();
}
function zombieLook(c: C, f: number, cloth: string): HumanOpts {
  return {
    skin: '#8fae6a', cloth, trim: '#3a2a1a', angry: true,
    face: (hx, hy, r) => { // mismatched eyes and a slack jaw
      c.fillStyle = '#f4f0c0'; c.beginPath(); c.arc(hx + f * r * 0.15, hy - r * 0.1, r * 0.2, 0, 7); c.fill(); c.beginPath(); c.arc(hx + f * r * 0.6, hy - r * 0.05, r * 0.13, 0, 7); c.fill();
      c.fillStyle = '#c0392b'; c.beginPath(); c.arc(hx + f * r * 0.17, hy - r * 0.08, r * 0.07, 0, 7); c.fill();
      c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(hx + f * r * 0.4, hy + r * 0.5, r * 0.22, r * 0.12, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx - r * 0.6, hy - r * 0.5); c.lineTo(hx - r * 0.2, hy - r * 0.2); c.stroke();
    },
  };
}
function dwarfLook(c: C, f: number, cloth: string, beardCol: string): HumanOpts {
  void c; void f; void beardCol;
  return { skin: '#e6b48a', cloth, trim: '#c9a24a' };
}
function goblinLook(c: C, f: number): HumanOpts {
  return {
    skin: '#7fae4a', cloth: '#6b4a2a', trim: '#3a2a1a', angry: true,
    head: (hx, hy, r) => { for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.8, hy - r * 0.2, hx + sd * r * 1.9, hy - r * 0.6, hx + sd * r * 0.9, hy + r * 0.3], '#7fae4a', 1.5); c.fillStyle = '#5f8a3a'; c.beginPath(); c.ellipse(hx + f * r * 0.85, hy + r * 0.15, r * 0.2, r * 0.13, 0, 0, 7); c.fill(); },
  };
}

function treant(a: ArtCtx, h: number) {
  const { c, x, gy, f, swing, atk, t } = a;
  const bark = '#6b4a2a';
  for (const sw of [swing, -swing]) line(c, x, gy - h * 0.3, x + Math.sin(sw) * h * 0.18, gy - 2, shade(bark, -0.1), 10);
  c.beginPath(); c.moveTo(x - h * 0.18, gy - h * 0.28); c.quadraticCurveTo(x - h * 0.22, gy - h * 0.7, x - h * 0.1, gy - h * 0.85); c.lineTo(x + h * 0.12, gy - h * 0.85); c.quadraticCurveTo(x + h * 0.24, gy - h * 0.6, x + h * 0.18, gy - h * 0.28); c.closePath();
  fillStroke(c, vgrad(c, bark, gy - h * 0.85, gy - h * 0.28), 2.5);
  c.strokeStyle = 'rgba(40,25,10,.5)'; c.lineWidth = 1.5; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * h * 0.07, gy - h * 0.8); c.quadraticCurveTo(x + k * h * 0.1, gy - h * 0.55, x + k * h * 0.06, gy - h * 0.32); c.stroke(); } c.strokeStyle = OUT;
  // branch arms
  line(c, x - f * h * 0.1, gy - h * 0.7, x - f * h * 0.35, gy - h * 0.45, bark, 6);
  const ax = x + f * (h * 0.35 + atk * 10), ay = gy - h * (0.6 - atk * 0.2);
  line(c, x + f * h * 0.1, gy - h * 0.72, ax, ay, bark, 7);
  line(c, ax, ay, ax + f * 10, ay - 8, bark, 3); line(c, ax, ay, ax + f * 12, ay + 4, bark, 3);
  // leafy crown
  for (const [dx, dy, r] of [[0, -0.95, 0.22], [-0.17, -0.88, 0.16], [0.18, -0.9, 0.17], [0, -1.08, 0.15]] as [number, number, number][]) circle(c, x + dx * h, gy + dy * h + Math.sin(t * 1.5 + dx * 10) * 1.5, r * h, '#3f8f3a', 2);
  eyes(c, x + f * h * 0.02, gy - h * 0.66, h * 0.12, f, true, '#d8ff7a');
}

function elkRider(a: ArtCtx) {
  const { c, x, gy, f, swing } = a;
  const col = '#9a6a3a';
  const by = gy - 34 - Math.abs(Math.sin(a.u.anim)) * 3;
  for (const [dx, k] of [[-16, 1], [-9, -1], [12, -1], [19, 1]] as [number, number][]) line(c, x + f * dx, by + 8, x + f * dx + Math.sin(swing * k * 1.3) * 11, gy - 2, col, 4.5);
  ellipse(c, x, by, 25, 12, col);
  poly(c, [x + f * 18, by - 4, x + f * 28, by - 24, x + f * 36, by - 22, x + f * 28, by + 2], col);
  ellipse(c, x + f * 38, by - 22, 9, 6, col, f * 0.3);
  eyes(c, x + f * 36, by - 25, 5, f, false);
  c.save(); c.strokeStyle = '#e8dcc0'; c.lineWidth = 2.5; c.lineCap = 'round';
  for (const off of [-3, 4]) { const bx = x + f * (34 + off), byy = by - 28; c.beginPath(); c.moveTo(bx, byy); c.lineTo(bx - f * 6, byy - 16); c.moveTo(bx - f * 3, byy - 8); c.lineTo(bx - f * 12, byy - 10); c.moveTo(bx - f * 5, byy - 13); c.lineTo(bx + f * 2, byy - 22); c.stroke(); }
  c.restore();
  const rider: ArtCtx = { ...a, gy: by - 4, swing: 0 };
  human(rider, 42, { skin: '#f2d2b0', cloth: '#2f8f4e', trim: '#d9c36a', noLegs: true, head: (hx, hy, r) => elfEars(c, hx, hy, r, f, '#f2d2b0'),
    armAng: f > 0 ? 0.25 - a.atk * 0.25 : Math.PI - 0.25 + a.atk * 0.25,
    weapon: (hx, hy) => { const push = a.atk * 10 * f; line(c, hx - f * 14 + push, hy, hx + f * 40 + push, hy - 4, '#d9c36a', 2.5); poly(c, [hx + f * 40 + push, hy - 8, hx + f * 52 + push, hy - 5, hx + f * 40 + push, hy - 1], '#dfe6ec', 1.5); } });
}

function mammoth(a: ArtCtx) {
  const { c, x, gy, f, swing, atk } = a;
  const s = a.u.def.height / 110;
  const col = '#7a5a3a';
  const by = gy - 50 * s - Math.abs(Math.sin(a.u.anim)) * 2;
  for (const [dx, k] of [[-26, 1], [-12, -1], [16, -1], [28, 1]] as [number, number][]) line(c, x + f * dx * s, by + 18 * s, x + f * dx * s + Math.sin(swing * k * 0.6) * 6, gy - 4, col, 12 * s);
  ellipse(c, x, by, 46 * s, 32 * s, col);
  c.save(); c.strokeStyle = 'rgba(40,25,10,.35)'; c.lineWidth = 2; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(x + k * 10 * s, by + 10 * s); c.lineTo(x + k * 10 * s + 3, by + 30 * s); c.stroke(); } c.restore();
  const hx = x + f * 40 * s, hy = by - 6 * s;
  circle(c, hx, hy, 22 * s, col);
  c.save(); c.strokeStyle = OUT; c.lineCap = 'round'; c.lineWidth = 12 * s + 2.6;
  const ex = hx + f * (16 + Math.sin(-0.3 + atk * 1.4) * 18) * s, ey = hy + (40 - atk * 28) * s;
  c.beginPath(); c.moveTo(hx + f * 14 * s, hy + 4 * s); c.quadraticCurveTo(hx + f * 26 * s, hy + 22 * s, ex, ey); c.stroke(); c.strokeStyle = col; c.lineWidth = 12 * s; c.stroke(); c.restore();
  c.save(); c.strokeStyle = '#f4ecd8'; c.lineWidth = 5 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx + f * 8 * s, hy + 10 * s); c.quadraticCurveTo(hx + f * 40 * s, hy + 30 * s, hx + f * 36 * s, hy - 4 * s); c.stroke(); c.restore();
  eyes(c, hx + f * 2 * s, hy - 8 * s, 12 * s, f, true);
  const rider: ArtCtx = { ...a, x: x - f * 6 * s, gy: by - 24 * s, swing: 0 };
  human(rider, 40, { ...goblinLook(c, f), noLegs: true, armAng: f > 0 ? 0.1 : Math.PI - 0.1,
    weapon: (hx2, hy2) => { line(c, hx2 - f * 10, hy2, hx2 + f * 30, hy2, '#8b5a2b', 2.5); poly(c, [hx2 + f * 30, hy2 - 4, hx2 + f * 40, hy2, hx2 + f * 30, hy2 + 4], '#cfd6dc', 1.5); } });
}

function dragon(a: ArtCtx) {
  const { c, x, gy, f, t, atk } = a;
  const s = a.u.def.height / 96;
  const y = gy - 10 + Math.sin(t * 2.5 + a.u.uid) * 5;
  const body = '#d98a2b', belly = '#f6d68a', wing = '#a84a1f';
  const flap = Math.sin(t * 5);
  // far wing
  poly(c, [x - f * 6 * s, y - 30 * s, x - f * 50 * s, y - (70 + flap * 30) * s, x - f * 70 * s, y - (30 + flap * 18) * s, x - f * 20 * s, y - 20 * s], shade(wing, -0.15), 2);
  // tail
  c.save(); c.strokeStyle = OUT; c.lineWidth = 12 * s + 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - f * 24 * s, y - 20 * s); c.quadraticCurveTo(x - f * 60 * s, y - 4 * s + Math.sin(t * 3) * 6, x - f * 84 * s, y - 24 * s); c.stroke(); c.strokeStyle = body; c.lineWidth = 12 * s; c.stroke(); c.restore();
  poly(c, [x - f * 82 * s, y - 24 * s, x - f * 96 * s, y - 36 * s, x - f * 94 * s, y - 16 * s], wing, 2);
  // body
  ellipse(c, x, y - 24 * s, 34 * s, 20 * s, body);
  c.fillStyle = belly; c.beginPath(); c.ellipse(x + f * 4 * s, y - 16 * s, 22 * s, 9 * s, 0, 0, Math.PI); c.fill();
  // neck + head
  c.save(); c.strokeStyle = OUT; c.lineWidth = 14 * s + 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + f * 24 * s, y - 30 * s); c.quadraticCurveTo(x + f * 40 * s, y - 56 * s, x + f * 52 * s, y - 58 * s); c.stroke(); c.strokeStyle = body; c.lineWidth = 14 * s; c.stroke(); c.restore();
  const hx = x + f * 58 * s, hy = y - 60 * s;
  ellipse(c, hx, hy, 16 * s, 11 * s, body);
  poly(c, [hx + f * 8 * s, hy - 2 * s, hx + f * 26 * s, hy + 4 * s, hx + f * 8 * s, hy + 9 * s], body, 2);
  for (const k of [-1, 1]) poly(c, [hx - f * 6 * s, hy - 8 * s, hx - f * (16 + k * 3) * s, hy - 24 * s, hx - f * 2 * s, hy - 10 * s], '#f4ecd8', 1.6);
  eyes(c, hx + f * 2 * s, hy - 3 * s, 10 * s, f, true, '#ffe14d');
  if (atk > 0.2) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? 'rgba(255,200,60,.7)' : 'rgba(255,90,30,.6)'; c.beginPath(); c.arc(hx + f * (30 + i * 12) * s, hy + 6 * s + i * 3, (5 + i * 2) * s, 0, 7); c.fill(); } c.restore(); }
  // near wing
  poly(c, [x - f * 2 * s, y - 34 * s, x - f * 30 * s, y - (84 + flap * 34) * s, x - f * 58 * s, y - (40 + flap * 20) * s, x - f * 12 * s, y - 24 * s], wing, 2.2);
  c.save(); c.strokeStyle = 'rgba(40,15,5,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - f * 2 * s, y - 34 * s); c.lineTo(x - f * 44 * s, y - (60 + flap * 26) * s); c.stroke(); c.restore();
  // legs
  for (const k of [-8, 10]) line(c, x + f * k * s, y - 8 * s, x + f * (k + 4) * s, y + 4 * s, body, 5 * s);
}

export function isBossy(id: string) { return ['boss', 'scorpking', 'roc', 'worm', 'titan', 'djinn', 'warlord', 'mummyking', 'cobraqueen', 'phoenix', 'elfqueen', 'ghostking', 'plaguelord', 'dwarfking', 'giantking'].includes(id); }

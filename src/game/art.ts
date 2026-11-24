// Character art for حرب الرمال, v1.0 "Neo" style: slim heroic proportions,
// two-segment tapered limbs with knees and elbows, cel shading with a hard
// light edge (the sun is top-right), colour-matched outlines instead of a
// uniform black line, flowing scarves and capes, and small expressive eyes.
// Everything is still drawn procedurally, so the game ships without image assets.
import type { Unit } from './battle';
import type { RegionId } from '../data/levels';

/** Fallback outline for shapes filled with a gradient or a CSS colour. */
const OUT = 'rgba(26,14,8,.9)';
const SKIN = ['#f1c49a', '#c48a5e'];
const CLOTH = ['#f4b942', '#c8323c'];
const TRIM = ['#1f9e8f', '#3a1520'];

type C = CanvasRenderingContext2D;

export interface ArtCtx { c: C; u: Unit; x: number; gy: number; f: number; t: number; swing: number; atk: number; side: 0 | 1; region: RegionId; flash: boolean; tier?: number; }

/** Armour metal by visual tier (a new look every 5 upgrade levels). */
const METAL = ['', '#c9874a', '#d7e0e8', '#ffcf3d', '#fff0a8'];
let BLADE = '#e9eff5'; // set per unit: gold blades from tier 3
/** Player soldiers that wear tier helmets (robed casters and beasts don't). */
const HELMETED = new Set(['sword', 'archer', 'spear', 'crossbow', 'drummer', 'fire', 'giant', 'hero', 'camel', 'cavalry', 'elephant', 'miner']);
function helmet(c: C, hx: number, hy: number, r: number, tier: number, f: number, t: number) {
  const m = METAL[tier];
  if (tier === 1) { // bronze cap with a rim
    c.beginPath(); c.ellipse(hx, hy - r * 0.2, r * 1.05, r * 0.95, 0, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); fillStroke(c, cel(c, m, hx + r, hy - r, hx - r, hy), 1.3, m);
    c.fillStyle = shade(m, -0.3); c.beginPath(); c.roundRect(hx - r * 1.08, hy - r * 0.3, r * 2.16, r * 0.2, r * 0.1); c.fill();
  } else if (tier === 2) { // silver sallet with nose guard and neck guard
    c.beginPath(); c.ellipse(hx, hy - r * 0.12, r * 1.1, r * 1.02, 0, Math.PI, 0); c.lineTo(hx - f * r * 1.1, hy + r * 0.6); c.lineTo(hx - f * r * 0.62, hy + r * 0.22); c.closePath(); fillStroke(c, cel(c, m, hx + r, hy - r, hx - r, hy + r * 0.5), 1.3, m);
    c.fillStyle = shade(m, -0.3); c.fillRect(hx + f * r * 0.42 - 1.2, hy - r * 0.2, 2.4, r * 0.7);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(hx, hy - r * 0.12, r * 0.85, r * 0.8, 0, Math.PI * 1.55, Math.PI * 1.9); c.stroke();
  } else { // gold crested helm; tier 4 adds wings
    c.beginPath(); c.ellipse(hx, hy - r * 0.12, r * 1.12, r * 1.05, 0, Math.PI, 0); c.lineTo(hx - f * r * 1.12, hy + r * 0.62); c.lineTo(hx - f * r * 0.55, hy + r * 0.25); c.closePath(); fillStroke(c, cel(c, m, hx + r, hy - r, hx - r, hy + r * 0.5), 1.3, m);
    c.fillStyle = '#d33a3a'; c.beginPath(); c.moveTo(hx + f * r * 0.4, hy - r * 1.05); c.quadraticCurveTo(hx - f * r * 0.5, hy - r * 2.2, hx - f * r * 2.1, hy - r * 1.2 + Math.sin(t * 5) * 2); c.quadraticCurveTo(hx - f * r * 0.6, hy - r * 1.35, hx - f * r * 0.4, hy - r * 0.95); c.closePath(); c.fill(); c.strokeStyle = '#7a1616'; c.lineWidth = 1; c.stroke();
    if (tier >= 4) for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.95, hy - r * 0.3, hx + sd * r * 2.0, hy - r * 1.35, hx + sd * r * 1.6, hy - r * 0.6, hx + sd * r * 2.2, hy - r * 0.85, hx + sd * r * 1.1, hy], '#fffaf0', 1.1);
  }
}
/** Outfit colour by tier: richer cloth as a soldier rises. */
function tierCloth(cloth: string, tier: number, side: number) {
  if (!tier || !cloth.startsWith('#')) return cloth;
  if (side === 1) return shade(cloth, -0.08 * tier);
  return ['', cloth, shade(cloth, -0.08), '#f7d77a', '#fbf1d6'][tier];
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
// ---- colour helpers ----
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
/** Outline colour for a fill: a deep, saturated version of the same hue. */
const ink = (fill: string) => (fill.startsWith('#') && fill.length === 7 ? shade(fill, -0.62) : OUT);
/**
 * Cel shading: a hard-edged two-tone gradient from the lit point (x0,y0) to
 * the shadow point (x1,y1), with a thin highlight band and a soft core.
 */
function cel(c: C, fill: string, x0: number, y0: number, x1: number, y1: number): string | CanvasGradient {
  if (LOW || !fill.startsWith('#')) return fill;
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(fill, 0.34)); g.addColorStop(0.16, shade(fill, 0.16)); g.addColorStop(0.17, fill);
  g.addColorStop(0.58, fill); g.addColorStop(0.6, shade(fill, -0.2)); g.addColorStop(1, shade(fill, -0.3));
  return g;
}
/** Vertical cel shade (light on top). */
function vgrad(c: C, fill: string, y0: number, y1: number) { return cel(c, fill, 0, y0, 0, y1); }
/** Round shapes: lit from the top-right, shadow bottom-left. */
function rgrad(c: C, fill: string, x: number, y: number, r: number) { return cel(c, fill, x + r * 0.7, y - r * 0.9, x - r * 0.6, y + r * 0.9); }
function fillStroke(c: C, fill: string | CanvasGradient, lw = 2.6, base?: string) {
  c.fillStyle = fill; c.fill();
  const b = base ?? (typeof fill === 'string' ? fill : undefined);
  if (b) c.strokeStyle = ink(b);
  c.lineWidth = Math.max(1, lw * 0.6); c.stroke();
}
function circle(c: C, x: number, y: number, r: number, fill: string, lw = 2.6) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fillStroke(c, rgrad(c, fill, x, y, r), lw, fill); }
function ellipse(c: C, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, lw = 2.6) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fillStroke(c, cel(c, fill, x + rx * 0.6, y - ry * 0.95, x - rx * 0.5, y + ry * 0.95), lw, fill); }
/** A stick, haft or simple limb: colour-matched outline plus a highlight edge. */
function line(c: C, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  c.save(); c.lineCap = 'round';
  c.strokeStyle = ink(color); c.lineWidth = w + 1.8; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  if (!LOW && color.startsWith('#') && w >= 3) { c.strokeStyle = shade(color, 0.4); c.lineWidth = w * 0.28; c.beginPath(); c.moveTo(x1 + 0.6, y1 - 0.9); c.lineTo(x2 + 0.6, y2 - 0.9); c.stroke(); }
  c.restore();
}
function poly(c: C, pts: number[], fill: string, lw = 2.6) {
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 0; i < pts.length; i += 2) { if (i) c.lineTo(pts[i], pts[i + 1]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); }
  c.closePath(); fillStroke(c, cel(c, fill, x1, y0, x0, y1), lw, fill);
}
/** Tapered capsule from (x1,y1) radius r1 to (x2,y2) radius r2: the basic limb shape. */
function capsule(c: C, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, fill: string, lw = 2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath();
  c.arc(x1, y1, r1, a + Math.PI / 2, a + Math.PI * 1.5);
  c.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  c.closePath();
  const nx = -Math.sin(a), ny = Math.cos(a); // light falls on the upper edge
  const up = ny > 0 ? -1 : 1;
  const r = Math.max(r1, r2);
  fillStroke(c, cel(c, fill, (x1 + x2) / 2 + nx * r * up, (y1 + y2) / 2 + ny * r * up, (x1 + x2) / 2 - nx * r * up, (y1 + y2) / 2 - ny * r * up), lw, fill);
}
/** Two-segment limb with a joint bent toward `bendDir` (±1, relative to the limb direction). */
function limb(c: C, x1: number, y1: number, x2: number, y2: number, bend: number, w1: number, w2: number, colA: string, colB = colA) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const jx = mx + nx * bend, jy = my + ny * bend;
  capsule(c, x1, y1, jx, jy, w1, (w1 + w2) / 2, colA, 1.8);
  capsule(c, jx, jy, x2, y2, (w1 + w2) / 2 * 0.95, w2, colB, 1.8);
  return [jx, jy];
}

/** Small, expressive eyes for a three-quarter view (the near eye toward the facing side). */
function eyes(c: C, x: number, y: number, r: number, f: number, angry: boolean, glow?: string) {
  for (const [k, sc] of [[0.12, 0.82], [0.6, 1]] as [number, number][]) {
    const ex = x + f * r * k;
    if (glow) {
      c.save(); c.fillStyle = glow; c.globalAlpha *= 0.3; c.beginPath(); c.ellipse(ex, y, r * 0.3 * sc, r * 0.22 * sc, 0, 0, 7); c.fill();
      c.globalAlpha /= 0.3; c.beginPath(); c.moveTo(ex - r * 0.2 * sc, y + (angry ? -r * 0.06 * f : 0)); c.quadraticCurveTo(ex, y - r * 0.14 * sc, ex + r * 0.2 * sc, y + (angry ? r * 0.06 * f : 0)); c.quadraticCurveTo(ex, y + r * 0.1 * sc, ex - r * 0.2 * sc, y + (angry ? -r * 0.06 * f : 0)); c.fill();
      c.fillStyle = '#ffffff'; c.globalAlpha *= 0.8; c.beginPath(); c.arc(ex + f * r * 0.04, y - r * 0.02, r * 0.045, 0, 7); c.fill(); c.restore();
      continue;
    }
    // almond white, coloured iris, pupil and a crisp highlight
    const ew = r * 0.2 * sc, eh = r * (angry ? 0.15 : 0.2) * sc;
    c.fillStyle = '#fffaf2'; c.beginPath(); c.ellipse(ex, y, ew, eh, 0, 0, 7); c.fill();
    c.fillStyle = '#3a2416'; c.beginPath(); c.arc(ex + f * r * 0.06, y + r * 0.02, r * 0.12 * sc, 0, 7); c.fill();
    c.fillStyle = '#0e0a08'; c.beginPath(); c.arc(ex + f * r * 0.07, y + r * 0.02, r * 0.06 * sc, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + f * r * 0.1, y - r * 0.05, r * 0.04, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,20,10,.85)'; c.lineWidth = Math.max(0.8, r * 0.06); c.beginPath(); c.ellipse(ex, y, ew, eh, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    // bold brows
    c.strokeStyle = '#2a170c'; c.lineWidth = Math.max(1.4, r * 0.12); c.lineCap = 'round'; c.beginPath();
    const inner = k > 0.3;
    const by = y - r * 0.3;
    if (angry) { const d = (inner === (f > 0) ? 1 : -1) * r * 0.1; c.moveTo(ex - r * 0.2, by - d); c.lineTo(ex + r * 0.2, by + d); }
    else { c.moveTo(ex - r * 0.18, by + r * 0.03); c.quadraticCurveTo(ex, by - r * 0.07, ex + r * 0.18, by + r * 0.03); }
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
  bulk?: number; // >1 for brutes (wider shoulders, thicker limbs)
  noScarf?: boolean;
  rider?: boolean; // seated on a mount: gy is the saddle, legs straddle the beast
}
const BOOT = '#3b2a20';
function human(a: ArtCtx, h: number, o: HumanOpts) {
  const { c, x, f, swing } = a;
  const seat = a.gy;
  const gy = o.rider ? a.gy + h * 0.44 : a.gy; // a rider's hips rest on the saddle
  const bulk = o.bulk ?? (h >= 90 ? 1.25 : 1);
  const R = h * 0.158; // about three heads tall: sleeker than the old chibi build
  const moving = a.u.moving;
  const bob = moving ? Math.abs(Math.sin(a.u.anim)) * h * 0.03 : Math.sin(a.t * 2.4 + a.u.uid) * 0.7; // stride bounce / idle breathing
  const lean = (moving ? 0.07 : 0) + a.atk * 0.1;
  const hip = gy - h * 0.44 - bob;
  const tx = x + f * lean * h * 0.35; // chest leans into the stride and the swing
  const headX = tx + f * lean * h * 0.12, headY = gy - h + R - bob;
  const neck = headY + R * 0.92;
  const sy = neck + R * 0.22; // shoulder line
  const sw = R * 0.98 * bulk, ww = R * 0.66 * bulk; // shoulder / waist half-widths
  const waist = hip - h * 0.02;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT;
  const tier = a.tier ?? 0;
  const helmeted = tier >= 1 && HELMETED.has(a.u.def.id) && a.side === 0;
  if (helmeted) o = { ...o, cloth: tierCloth(o.cloth, tier, a.side), trim: tier >= 3 ? '#c9952a' : o.trim };
  BLADE = tier >= 3 ? '#ffe27a' : tier === 2 ? '#f6fafd' : '#e9eff5';
  const pants = o.robe ? shade(o.cloth, -0.25) : shade(o.cloth === '#f4ecd8' ? '#8a7a60' : o.cloth, -0.42);
  const wind = Math.sin(a.t * 4 + a.u.uid) * 2 + (moving ? 3 : 0);
  // cape (tier 2+) or a flowing scarf in the trim colour
  if (tier >= 2 && !o.noLegs) {
    const capeCol = tier >= 3 ? '#8e1b2b' : shade(o.cloth, -0.32);
    c.beginPath(); c.moveTo(tx - f * sw * 0.7, sy); c.quadraticCurveTo(tx - f * sw * 2.2, (sy + gy) / 2, x - f * (R * 2.4 + wind), gy - h * 0.06); c.lineTo(x - f * R * 0.6, gy - h * 0.1); c.lineTo(tx + f * sw * 0.2, sy); c.closePath();
    fillStroke(c, cel(c, capeCol, x, sy, x - f * R * 2, gy), 1.6, capeCol);
  } else if (!o.noScarf && !o.noLegs && !o.robe) {
    const sc = o.trim;
    c.beginPath(); c.moveTo(tx - f * sw * 0.2, neck + 1); c.bezierCurveTo(tx - f * R * 1.2, neck - 1 + wind * 0.3, tx - f * R * 1.6, neck + R * 0.6, tx - f * (R * 2.4 + wind), neck + R * 0.4 + Math.sin(a.t * 6 + a.u.uid) * 2.5);
    c.lineTo(tx - f * (R * 2.2 + wind), neck + R * 0.95 + Math.sin(a.t * 6 + a.u.uid + 1) * 2.5); c.bezierCurveTo(tx - f * R * 1.4, neck + R * 1.1, tx - f * R * 0.9, neck + R * 0.6, tx - f * sw * 0.1, neck + R * 0.55); c.closePath();
    fillStroke(c, cel(c, sc, tx, neck, tx - f * R * 2, neck + R), 1.4, sc);
  }
  o.back?.(tx - f * R * 0.25, sy + 5);
  // legs: thigh + shin with a knee that bends on the back-swing, boots that lift
  const legW = Math.max(2.2, h * 0.052) * bulk;
  const thigh = h * 0.228, shin = h * 0.218;
  const legs: number[][] = [];
  if (o.rider) { // one visible leg: thigh forward over the flank, shin hanging, boot in the stirrup
    const kx = x + f * h * 0.16, ky = seat + h * 0.06, fx = x + f * h * 0.1, fy = seat + h * 0.3;
    capsule(c, x, seat - 1, kx, ky, legW * 1.15, legW * 0.95, pants, 1.8);
    capsule(c, kx, ky, fx, fy, legW * 0.95, legW * 0.8, pants, 1.8);
    c.beginPath(); c.roundRect(f > 0 ? fx - legW : fx - legW * 2.4, fy - legW * 0.6, legW * 3.4, legW * 1.8, 2); fillStroke(c, BOOT, 1.4);
  } else if (!o.noLegs) {
    for (const [s, back] of [[-swing, true], [swing, false]] as [number, boolean][]) {
      const th = s * 0.72;
      const bend = moving ? 0.12 + Math.max(0, -Math.sin(a.u.anim + (back ? Math.PI : 0))) * 0.55 : 0.1;
      const hx = x - f * (back ? R * 0.18 : -R * 0.12), hy = hip;
      const kx = hx + f * Math.sin(th) * thigh, ky = hy + Math.cos(th) * thigh;
      const sa = th - bend;
      let fx = kx + f * Math.sin(sa) * shin, fy = ky + Math.cos(sa) * shin;
      if (fy > gy - 2) fy = gy - 2;
      legs.push([hx, hy, kx, ky, fx, fy, back ? 1 : 0]);
      void fx;
    }
    for (const [hx, hy, kx, ky, fx, fy, back] of legs) {
      const col = back ? shade(pants, -0.18) : pants;
      capsule(c, hx, hy, kx, ky, legW * 1.15, legW * 0.95, col, 1.8);
      capsule(c, kx, ky, fx, fy, legW * 0.95, legW * 0.8, col, 1.8);
      // boot
      const bc = back ? shade(BOOT, -0.15) : BOOT;
      c.beginPath(); c.moveTo(fx - f * legW, fy - legW * 1.6); c.lineTo(fx + f * legW * 0.9, fy - legW * 1.4); c.quadraticCurveTo(fx + f * legW * 2.8, fy - legW * 0.9, fx + f * legW * 2.9, fy + 1.4); c.lineTo(fx - f * legW * 1.1, fy + 1.4); c.closePath();
      fillStroke(c, cel(c, bc, fx + f * legW * 2, fy - legW * 2, fx, fy + 2), 1.6, bc);
    }
  }
  // back arm (darker, swings opposite the near leg)
  const armW = Math.max(2, h * 0.045) * bulk;
  {
    const bx = tx - f * sw * 0.45, by = sy + R * 0.18;
    const ex = bx - f * Math.sin(swing) * h * 0.16 + f * a.atk * h * 0.05, ey = by + h * 0.25;
    limb(c, bx, by, ex, ey, -f * h * 0.03, armW * 1.05, armW * 0.85, shade(o.cloth, -0.25), shade(o.skin, -0.2));
    circle(c, ex, ey, armW * 0.95, shade(o.skin, -0.2), 1.6);
  }
  // torso: shoulders taper to the waist, chest curves forward
  c.beginPath();
  if (o.robe) {
    c.moveTo(tx - f * sw * 0.85, sy - R * 0.05); c.lineTo(tx + f * sw * 0.9, sy - R * 0.05);
    c.quadraticCurveTo(tx + f * sw * 1.05, waist - h * 0.1, x + f * ww * 1.9, gy - 2); c.lineTo(x - f * ww * 1.8, gy - 2);
    c.quadraticCurveTo(tx - f * sw * 1.05, waist - h * 0.1, tx - f * sw * 0.85, sy - R * 0.05);
  } else {
    c.moveTo(tx - f * sw * 0.85, sy - R * 0.05); c.lineTo(tx + f * sw * 0.9, sy - R * 0.05);
    c.quadraticCurveTo(tx + f * sw * 1.18, (sy + waist) / 2, x + f * ww, waist);
    // tunic skirt flares a little over the hips
    c.lineTo(x + f * ww * 1.35, hip + h * 0.07); c.lineTo(x - f * ww * 1.3, hip + h * 0.07); c.lineTo(x - f * ww, waist);
    c.quadraticCurveTo(tx - f * sw * 1.02, (sy + waist) / 2, tx - f * sw * 0.85, sy - R * 0.05);
  }
  c.closePath();
  fillStroke(c, cel(c, o.cloth, tx + f * sw, sy, tx - f * sw * 0.6, o.robe ? gy : hip + h * 0.07), 2.2, o.cloth);
  // hem band and sash in the trim colour: the army's signature accent
  c.save();
  c.fillStyle = o.trim;
  if (o.robe) { c.beginPath(); c.moveTo(x + f * ww * 1.85, gy - 2); c.lineTo(x - f * ww * 1.75, gy - 2); c.lineTo(x - f * ww * 1.68, gy - 2 - h * 0.05); c.lineTo(x + f * ww * 1.78, gy - 2 - h * 0.05); c.closePath(); c.fill(); }
  else { c.beginPath(); c.moveTo(x + f * ww * 1.35, hip + h * 0.07); c.lineTo(x - f * ww * 1.3, hip + h * 0.07); c.lineTo(x - f * ww * 1.24, hip + h * 0.045); c.lineTo(x + f * ww * 1.29, hip + h * 0.045); c.closePath(); c.fill(); }
  if (!o.noLegs) {
    c.strokeStyle = o.trim; c.lineWidth = Math.max(2, R * 0.34); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(tx - f * sw * 0.55, sy + 1); c.lineTo(x + f * ww * 0.85, waist - 1); c.stroke();
    if (!LOW) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = Math.max(0.8, R * 0.09); c.beginPath(); c.moveTo(tx - f * sw * 0.5, sy - R * 0.08); c.lineTo(x + f * ww * 0.9, waist - R * 0.15); c.stroke(); }
  }
  c.restore();
  // belt
  c.fillStyle = shade(o.trim, -0.35); c.beginPath(); c.roundRect(x - ww * 1.05, waist - h * 0.025, ww * 2.1, h * 0.045, 1.5); c.fill();
  if (tier >= 1) {
    const m = METAL[tier];
    if (tier === 1) { c.save(); c.strokeStyle = m; c.lineWidth = Math.max(1.6, h * 0.035); c.beginPath(); c.moveTo(tx + f * sw * 0.6, sy + 1); c.lineTo(x - f * ww * 0.7, waist - 2); c.stroke(); c.restore(); }
    else { // breastplate following the chest curve
      c.beginPath(); c.moveTo(tx - f * sw * 0.68, sy + R * 0.12); c.lineTo(tx + f * sw * 0.78, sy + R * 0.12);
      c.quadraticCurveTo(tx + f * sw * 1.02, (sy + waist) / 2, x + f * ww * 0.85, waist - 2); c.quadraticCurveTo(x, waist + 2, x - f * ww * 0.85, waist - 2);
      c.quadraticCurveTo(tx - f * sw * 0.88, (sy + waist) / 2, tx - f * sw * 0.68, sy + R * 0.12); c.closePath();
      fillStroke(c, cel(c, m, tx + f * sw, sy, tx - f * sw, waist), 1.4, m);
      c.strokeStyle = shade(m, -0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(tx + f * sw * 0.15, sy + R * 0.25); c.quadraticCurveTo(tx + f * sw * 0.35, (sy + waist) / 2, x + f * ww * 0.2, waist - 3); c.stroke();
    }
    c.fillStyle = tier >= 3 ? '#ffcf3d' : m; c.beginPath(); c.roundRect(x - 2.6, waist - h * 0.03, 5.2, h * 0.055, 1.2); c.fill(); // buckle
  }
  // neck + head
  capsule(c, headX - f * R * 0.08, headY + R * 0.7, tx, sy, R * 0.32, R * 0.36, shade(o.skin, -0.08), 1.4);
  c.beginPath(); c.ellipse(headX, headY, R * 0.93, R, 0, 0, 7);
  fillStroke(c, cel(c, o.skin, headX + R * 0.8, headY - R, headX - R * 0.7, headY + R), 2, o.skin);
  // ear, a hint of a nose on the facing edge, a jaw shadow
  c.fillStyle = shade(o.skin, -0.18); c.beginPath(); c.ellipse(headX - f * R * 0.12, headY + R * 0.08, R * 0.16, R * 0.22, 0, 0, 7); c.fill();
  if (!o.face && !o.mask && !o.glowEyes) {
    c.fillStyle = o.skin; c.strokeStyle = ink(o.skin); c.lineWidth = 1;
    c.beginPath(); c.moveTo(headX + f * R * 0.86, headY - R * 0.08); c.quadraticCurveTo(headX + f * R * 1.14, headY + R * 0.18, headX + f * R * 0.86, headY + R * 0.28); c.fill(); c.stroke();
  }
  if (!LOW) { c.save(); c.fillStyle = 'rgba(60,25,10,.16)'; c.beginPath(); c.ellipse(headX - f * R * 0.1, headY + R * 0.72, R * 0.6, R * 0.2, 0, 0, 7); c.fill(); c.restore(); }
  if (o.mask) { c.save(); c.beginPath(); c.ellipse(headX, headY, R * 0.93 - 0.8, R - 0.8, 0, 0.2, Math.PI - 0.2); c.closePath(); c.fillStyle = o.mask; c.fill(); c.restore(); }
  if (o.face) o.face(headX, headY, R);
  else eyes(c, headX + f * R * 0.08, headY - R * 0.06, R, f, !!o.angry, o.glowEyes);
  if (!o.face && !o.mask && !o.glowEyes) {
    c.strokeStyle = 'rgba(70,30,15,.8)'; c.lineWidth = Math.max(1, R * 0.08);
    c.beginPath();
    if (o.angry) { c.moveTo(headX + f * R * 0.38, headY + R * 0.5); c.lineTo(headX + f * R * 0.68, headY + R * 0.46); }
    else { c.moveTo(headX + f * R * 0.36, headY + R * 0.44); c.quadraticCurveTo(headX + f * R * 0.54, headY + R * 0.56, headX + f * R * 0.7, headY + R * 0.42); }
    c.stroke();
  }
  o.head?.(headX, headY, R);
  if (tier >= 1 && !o.noLegs) { // pauldrons
    for (const [k, d] of [[-0.45, -0.2], [0.55, 0]] as [number, number][]) { const m = shade(METAL[tier], d); c.beginPath(); c.ellipse(tx + f * sw * k, sy + R * 0.12, R * 0.48, R * 0.3, -f * 0.25, Math.PI * 0.95, Math.PI * 2.05); c.closePath(); fillStroke(c, cel(c, m, tx + f * sw * k + R * 0.4, sy - R * 0.2, tx + f * sw * k - R * 0.4, sy + R * 0.4), 1.3, m); }
  }
  if (helmeted) helmet(c, headX, headY, R, tier, f, a.t);
  else if (tier >= 3) { // plume
    c.save(); c.strokeStyle = tier >= 4 ? '#ff4d4d' : a.side ? '#3a3a44' : '#c0392b'; c.lineWidth = R * 0.3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(headX, headY - R * 0.95); c.quadraticCurveTo(headX - f * R * 0.9, headY - R * 1.9, headX - f * R * 1.7, headY - R * 1.1); c.stroke(); c.restore();
  }
  // front arm: shoulder → elbow → hand, then the weapon in the hand
  const ang = o.armAng ?? (f > 0 ? lerp(-0.95, 0.6, a.atk) : Math.PI - lerp(-0.95, 0.6, a.atk));
  const ax = tx + f * sw * 0.32, ay = sy + R * 0.16;
  const al = h * 0.25;
  const hx = ax + Math.cos(ang) * al, hy = ay + Math.sin(ang) * al;
  // elbow bends downward/backward whatever the arm angle
  const bend = (Math.cos(ang) * f >= 0 ? 1 : -1) * f * h * 0.035;
  limb(c, ax, ay, hx, hy, bend, armW * 1.12, armW * 0.85, o.cloth, o.skin);
  if (o.weapon) {
    const ws = 1 + tier * 0.1; // bigger weapons as the soldier rises
    if (ws !== 1) { c.save(); c.translate(hx, hy); c.scale(ws, ws); c.translate(-hx, -hy); o.weapon(hx, hy, ang); c.restore(); } else o.weapon(hx, hy, ang);
  }
  if (tier >= 3 && o.weapon) glowDot(c, hx + Math.cos(ang - f * 1.1) * h * 0.3, hy + Math.sin(ang - f * 1.1) * h * 0.3, 2.5 + Math.sin(a.t * 6) * 0.8, '#fff3b0');
  circle(c, hx, hy, Math.max(2.2, armW * 1.0), o.skin, 1.6);
}

/** A flowing cape with folds that billows in the wind. */
function cape(c: C, sx: number, sy: number, gy: number, f: number, ph: number, col: string, w: number, reach: number) {
  reach *= 1.45; w *= 1.1;
  const wave = Math.sin(ph) * 4, wave2 = Math.sin(ph + 1.3) * 3;
  c.beginPath(); c.moveTo(sx - f * w * 0.9, sy - 3); c.lineTo(sx + f * w * 0.9, sy - 3);
  c.bezierCurveTo(sx - f * reach * 0.2, (sy + gy) * 0.5, sx - f * reach * 0.6, gy - 8, sx - f * (reach * 0.95 + wave), gy - 4);
  c.quadraticCurveTo(sx - f * (reach * 0.7 + wave2), gy - 10, sx - f * reach * 0.45, gy - 3);
  c.quadraticCurveTo(sx - f * reach * 0.3, gy - 9, sx - f * reach * 0.1, gy - 4);
  c.bezierCurveTo(sx - f * reach * 0.1, (sy + gy) * 0.5, sx - f * w, sy + 8, sx - f * w * 0.9, sy - 3); c.closePath();
  fillStroke(c, cel(c, col, sx + f * w, sy, sx - f * reach, gy), 1.8, col);
  c.save(); c.strokeStyle = shade(col, -0.35); c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx - f * w * 0.2, sy + 6); c.quadraticCurveTo(sx - f * reach * 0.4, (sy + gy) * 0.55, sx - f * (reach * 0.7 + wave2), gy - 9); c.stroke(); c.restore();
}

const turban = (c: C, col: string) => (x: number, y: number, r: number) => {
  // wrapped turban: a dome with layered folds and a tail of cloth
  c.beginPath(); c.ellipse(x, y - r * 0.5, r * 1.06, r * 0.66, 0, Math.PI * 0.98, Math.PI * 2.02); c.closePath(); fillStroke(c, cel(c, col, x + r, y - r * 1.2, x - r, y - r * 0.2), 2, col);
  c.save(); c.strokeStyle = shade(col, -0.22); c.lineWidth = Math.max(1, r * 0.12);
  for (const k of [0.62, 0.92]) { c.beginPath(); c.moveTo(x - r * 0.98, y - r * (k - 0.1)); c.quadraticCurveTo(x, y - r * (k + 0.5), x + r * 0.98, y - r * (k - 0.18)); c.stroke(); }
  c.restore();
  c.fillStyle = shade(col, -0.12); c.beginPath(); c.arc(x + r * 0.15, y - r * 1.02, r * 0.18, 0, 7); c.fill();
};
const scimitar = (c: C, f: number, len: number) => (hx: number, hy: number, ang: number) => {
  const bang = ang - f * 1.1;
  c.save(); c.translate(hx, hy); c.rotate(bang);
  c.beginPath(); c.moveTo(0, -1.8); c.quadraticCurveTo(len * 0.62, -len * 0.2 * f, len, -len * 0.08 * f); c.quadraticCurveTo(len * 0.58, len * 0.04 * f, 0, 2.6); c.closePath();
  fillStroke(c, BLADE, 1.8, '#8a96a3');
  if (!LOW) { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1; c.beginPath(); c.moveTo(len * 0.15, -1.2 * f); c.quadraticCurveTo(len * 0.6, -len * 0.16 * f, len * 0.92, -len * 0.08 * f); c.stroke(); }
  c.fillStyle = '#c99a2e'; c.beginPath(); c.roundRect(-2, -5.5, 4, 11, 1.5); c.fill(); // guard
  c.fillStyle = '#5a3a22'; c.fillRect(-7, -1.6, 6, 3.2); // grip
  c.restore();
};

// ---------------- Beasts ----------------
/** Big cats and dogs: a deep chest, tucked waist, jointed legs with paws. */
function quad(a: ArtCtx, size: number, body: string, belly: string, opts: { mane?: string; spots?: boolean; collar?: string; tail?: string }) {
  const { c, x, gy, f, atk } = a;
  const s = size / 46;
  const run = a.u.anim;
  const by = gy - 22 * s - Math.abs(Math.sin(run)) * 2.2 * s;
  const stretch = a.u.moving ? Math.sin(run) * 0.12 : 0;
  // tail
  c.save(); c.strokeStyle = ink(body); c.lineWidth = 3.6 * s + 1.4; c.beginPath(); c.moveTo(x - f * 20 * s, by - 3 * s); c.bezierCurveTo(x - f * 30 * s, by - 4 * s, x - f * 30 * s, by - 18 * s + Math.sin(run * 2) * 4, x - f * 38 * s, by - 20 * s + Math.sin(run * 2) * 4); c.stroke(); c.strokeStyle = body; c.lineWidth = 3.6 * s; c.stroke(); c.restore();
  if (opts.tail) ellipse(c, x - f * 38 * s, by - 20 * s + Math.sin(run * 2) * 4, 3.4 * s, 4.4 * s, opts.tail, f * 0.6, 1.6);
  // legs: far pair darker, near pair bright; each has a knee and a paw
  const leg = (dx: number, ph: number, far: boolean) => {
    const col = far ? shade(body, -0.22) : body;
    const sw = a.u.moving ? Math.sin(run + ph) : 0;
    const top = [x + f * dx * s, by + 4 * s] as const;
    const knee = [top[0] + f * sw * 6 * s, by + 12 * s] as const;
    const paw = [knee[0] + f * (sw * 4 - 1) * s, gy - 2.5 * s - Math.max(0, sw) * 3 * s] as const;
    capsule(c, top[0], top[1], knee[0], knee[1], 4.2 * s, 3 * s, col, 1.6);
    capsule(c, knee[0], knee[1], paw[0], paw[1], 3 * s, 2.4 * s, col, 1.6);
    ellipse(c, paw[0] + f * 1.6 * s, paw[1] + 0.6 * s, 3.6 * s, 2.2 * s, shade(col, -0.1), 0, 1.4);
  };
  leg(-15, 0, true); leg(12, Math.PI, true);
  // torso silhouette: chest high and deep, hips lower and narrower
  c.beginPath();
  c.moveTo(x - f * 22 * s, by - 4 * s);
  c.bezierCurveTo(x - f * 16 * s, by - (13 + stretch * 10) * s, x + f * 12 * s, by - 15 * s, x + f * 22 * s, by - 9 * s);
  c.bezierCurveTo(x + f * 28 * s, by - 2 * s, x + f * 22 * s, by + 10 * s, x + f * 12 * s, by + 10 * s);
  c.bezierCurveTo(x + f * 2 * s, by + 8 * s, x - f * 8 * s, by + 5 * s, x - f * 18 * s, by + 7 * s);
  c.quadraticCurveTo(x - f * 26 * s, by + 4 * s, x - f * 22 * s, by - 4 * s);
  c.closePath(); fillStroke(c, cel(c, body, x + f * 10 * s, by - 16 * s, x - f * 10 * s, by + 10 * s), 2.4, body);
  c.fillStyle = belly; c.beginPath(); c.ellipse(x + f * 6 * s, by + 6 * s, 12 * s, 3.4 * s, f * 0.1, 0, Math.PI); c.fill();
  if (opts.spots) { c.fillStyle = 'rgba(60,35,15,.5)'; for (const [dx, dy, r] of [[-12, -4, 2.6], [-2, -8, 2.2], [8, -5, 2.8], [-6, 1, 2], [14, -1, 2]]) { c.beginPath(); c.ellipse(x + f * dx * s, by + dy * s, r * s, r * 0.8 * s, 0.4, 0, 7); c.fill(); } }
  leg(-11, Math.PI, false); leg(16, 0, false);
  // head: skull, muzzle, jaw that opens on the bite, ear, eye
  const hx = x + f * (25 + atk * 7) * s, hy = by - 12 * s;
  if (opts.mane) { c.beginPath(); for (let i = 0; i <= 10; i++) { const an = -Math.PI * 0.2 + (i / 10) * Math.PI * 1.55; const rr = (i % 2 ? 13 : 16) * s; c.lineTo(hx - f * 4 * s + Math.cos(an) * rr * -f, hy + 1 * s + Math.sin(an) * rr * 0.95 - 2 * s); } c.closePath(); fillStroke(c, cel(c, opts.mane, hx, hy - 14 * s, hx - f * 10 * s, hy + 12 * s), 2.2, opts.mane); }
  c.beginPath(); c.ellipse(hx, hy, 9.5 * s, 8.5 * s, 0, 0, 7); fillStroke(c, rgrad(c, body, hx, hy, 9 * s), 2, body);
  // muzzle
  c.beginPath(); c.moveTo(hx + f * 4 * s, hy - 3 * s); c.quadraticCurveTo(hx + f * 15 * s, hy - 2 * s, hx + f * 15 * s, hy + 3 * s); c.lineTo(hx + f * 5 * s, hy + 5 * s); c.closePath(); fillStroke(c, cel(c, belly, hx + f * 12 * s, hy - 3 * s, hx, hy + 5 * s), 1.6, belly);
  const jaw = 0.15 + atk * 0.55;
  c.save(); c.translate(hx + f * 5 * s, hy + 4 * s); c.rotate(f * jaw);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(f * 9 * s, 0); c.quadraticCurveTo(f * 8 * s, 3.5 * s, 0, 3 * s); c.closePath(); fillStroke(c, belly, 1.4);
  if (atk > 0.2) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(f * 6 * s, 0); c.lineTo(f * 7 * s, -2.4 * s); c.lineTo(f * 8 * s, 0); c.fill(); }
  c.restore();
  if (atk > 0.2) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx + f * 11 * s, hy + 3 * s); c.lineTo(hx + f * 12 * s, hy + 5.5 * s); c.lineTo(hx + f * 13 * s, hy + 3 * s); c.fill(); }
  c.fillStyle = '#1b1210'; c.beginPath(); c.ellipse(hx + f * 14.6 * s, hy - 1.4 * s, 1.8 * s, 1.4 * s, 0, 0, 7); c.fill(); // nose
  poly(c, [hx - f * 3 * s, hy - 6 * s, hx - f * 7 * s, hy - 14 * s, hx + f * 1 * s, hy - 8 * s], body, 1.6); // ear
  eyes(c, hx + f * 1 * s, hy - 3 * s, 8.5 * s, f, true);
  if (opts.collar) { c.save(); c.strokeStyle = opts.collar; c.lineWidth = 3 * s; c.beginPath(); c.arc(hx - f * 6 * s, hy + 2 * s, 7 * s, f > 0 ? 0.6 : Math.PI - 2.4, f > 0 ? 2.4 : Math.PI - 0.6); c.stroke(); c.restore(); }
}

/** Birds of prey: layered primary feathers that sweep with each beat. */
function bird(a: ArtCtx, y: number, size: number, body: string, wing: string, opts: { crest?: string; band?: string; beak?: string }) {
  const { c, x, f } = a;
  const s = size / 40;
  const flap = Math.sin(a.u.anim * 1.6);
  const wingShape = (far: boolean) => {
    const col = far ? shade(wing, -0.2) : wing;
    const lift = (far ? 14 : 20) + flap * (far ? 14 : 20);
    const rx = x - f * 2 * s, ry = y - 3 * s;
    c.beginPath(); c.moveTo(rx + f * 8 * s, ry);
    c.quadraticCurveTo(rx - f * 4 * s, ry - lift * s * 0.6, rx - f * 14 * s, ry - lift * s);
    for (let k = 0; k < 4; k++) { const fx = rx - f * (14 + k * 4) * s, fy = ry - (lift - k * 5) * s; c.lineTo(fx - f * 5 * s, fy + 3 * s); c.lineTo(fx - f * 2 * s, fy + 6 * s); }
    c.quadraticCurveTo(rx - f * 10 * s, ry + 2 * s, rx + f * 8 * s, ry);
    c.closePath(); fillStroke(c, cel(c, col, rx, ry - lift * s, rx - f * 20 * s, ry), 2, col);
  };
  wingShape(true);
  // tail fan
  poly(c, [x - f * 12 * s, y - 1 * s, x - f * 27 * s, y - 7 * s, x - f * 29 * s, y + 1 * s, x - f * 26 * s, y + 7 * s], shade(wing, -0.08), 2);
  // body: teardrop
  c.beginPath(); c.moveTo(x + f * 16 * s, y - 6 * s); c.bezierCurveTo(x + f * 10 * s, y - 12 * s, x - f * 10 * s, y - 9 * s, x - f * 16 * s, y); c.bezierCurveTo(x - f * 8 * s, y + 8 * s, x + f * 10 * s, y + 9 * s, x + f * 16 * s, y - 6 * s); c.closePath();
  fillStroke(c, cel(c, body, x + f * 8 * s, y - 10 * s, x - f * 6 * s, y + 8 * s), 2.2, body);
  c.fillStyle = shade(body, 0.35); c.beginPath(); c.ellipse(x + f * 6 * s, y + 3 * s, 7 * s, 3.6 * s, f * -0.3, 0, 7); c.fill();
  // talons reach on the dive
  line(c, x + f * 1 * s, y + 7 * s, x + f * (5 + a.atk * 5) * s, y + (13 + a.atk * 6) * s, '#e0a43a', 2.2 * s);
  line(c, x - f * 3 * s, y + 7 * s, x + f * (0 + a.atk * 4) * s, y + (12 + a.atk * 5) * s, '#c98e2e', 2 * s);
  const hx = x + f * 16 * s, hy = y - 7 * s;
  c.beginPath(); c.ellipse(hx, hy, 7.5 * s, 7 * s, 0, 0, 7); fillStroke(c, rgrad(c, body, hx, hy, 7 * s), 2, body);
  // hooked beak
  const bk = opts.beak ?? '#f3b23a';
  c.beginPath(); c.moveTo(hx + f * 5 * s, hy - 3 * s); c.quadraticCurveTo(hx + f * 14 * s, hy - 3 * s, hx + f * 13 * s, hy + 4 * s); c.lineTo(hx + f * 5 * s, hy + 2.5 * s); c.closePath(); fillStroke(c, bk, 1.4);
  eyes(c, hx - f * 0.5 * s, hy - 2 * s, 7 * s, f, true);
  if (opts.crest) poly(c, [hx - f * 3 * s, hy - 6 * s, hx - f * 15 * s, hy - 15 * s, hx - f * 9 * s, hy - 8 * s, hx - f * 16 * s, hy - 9 * s, hx - f * 2 * s, hy - 3 * s], opts.crest, 1.6);
  if (opts.band) { c.save(); c.strokeStyle = opts.band; c.lineWidth = 3.2 * s; c.beginPath(); c.ellipse(x + f * 9 * s, y - 4 * s, 4 * s, 7 * s, f * 0.5, 0, 7); c.stroke(); c.restore(); }
  wingShape(false);
}

function smokeTail(c: C, x: number, top: number, gy: number, f: number, col: string, t: number) {
  // a tapering wisp: overlapping translucent lobes that ripple
  c.save(); c.globalAlpha *= 0.8;
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    const px = x - f * k * 22 + Math.sin(t * 3 + i) * 4, py = lerp(top, gy - 8, k), r = lerp(13, 3.5, k);
    c.fillStyle = cel(c, col, px + r, py - r, px - r, py + r); c.beginPath(); c.ellipse(px, py, r, r * 1.2, 0, 0, 7); c.fill();
  }
  c.restore();
}

/** Golems: faceted low-poly stone with glowing seams (titan, colossus, guardians). */
function rocks(c: C, x: number, gy: number, s: number, f: number, swing: number, atk: number, col: string, crown: boolean, runes?: string) {
  const glow = runes ?? '#ffb347';
  const gem = (pts: number[], fill: string) => {
    poly(c, pts, fill, 2.4);
    // one lit facet per chunk
    if (!LOW) { c.save(); c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(pts[0], pts[1]); c.lineTo(pts[2], pts[3]); c.lineTo((pts[0] + pts[4]) / 2, (pts[1] + pts[5]) / 2); c.closePath(); c.fill(); c.restore(); }
  };
  const X = (dx: number) => x + f * dx * s, Y = (dy: number) => gy + dy * s;
  // legs
  for (const [dx, k] of [[-10, 1], [10, -1]] as [number, number][]) { const o = swing * 6 * k; gem([X(dx - 7 + o), Y(-24), X(dx + 7 + o), Y(-26), X(dx + 8 + o * 1.4), Y(-1), X(dx - 8 + o * 1.4), Y(-1)], shade(col, k > 0 ? -0.15 : 0)); }
  // back arm
  gem([X(-20), Y(-56), X(-28), Y(-48), X(-30), Y(-24), X(-18), Y(-26)], shade(col, -0.2));
  // torso: a heavy cut stone
  gem([X(-19), Y(-68), X(14), Y(-72), X(22), Y(-50), X(16), Y(-26), X(-16), Y(-24), X(-22), Y(-46)], col);
  // glowing seams
  c.save(); c.strokeStyle = glow; c.lineWidth = 2 * s; c.globalAlpha *= 0.85; c.beginPath(); c.moveTo(X(-10), Y(-64)); c.lineTo(X(-2), Y(-50)); c.lineTo(X(-8), Y(-36)); c.moveTo(X(6), Y(-66)); c.lineTo(X(2), Y(-50)); c.lineTo(X(10), Y(-32)); c.stroke(); c.restore();
  // head
  gem([X(-9), Y(-86), X(10), Y(-88), X(13), Y(-72), X(-11), Y(-70)], shade(col, 0.05));
  c.fillStyle = glow; c.beginPath(); c.moveTo(X(2), Y(-81)); c.lineTo(X(10), Y(-80)); c.lineTo(X(8), Y(-77)); c.lineTo(X(1), Y(-78)); c.closePath(); c.fill();
  if (!LOW) glowDot(c, X(6), Y(-79), 1.8 * s, glow);
  // front arm: a fist that rises and slams
  const ax = 24 + atk * 12, ay = -50 - atk * 10;
  gem([X(14), Y(-66), X(24), Y(-62), X(ax + 6), Y(ay + 18), X(ax - 4), Y(ay + 20)], shade(col, 0.08));
  gem([X(ax - 7), Y(ay + 16), X(ax + 9), Y(ay + 14), X(ax + 10), Y(ay + 30), X(ax - 8), Y(ay + 31)], col);
  if (runes) { c.save(); c.fillStyle = runes; c.fillRect(X(-6), Y(-48), 12 * s * f, 2.4 * s); c.fillRect(X(0) - 1.2 * s, Y(-54), 2.4 * s, 13 * s); c.restore(); }
  if (crown) crownAt(c, X(1), Y(-87), 10 * s);
}

function crownAt(c: C, x: number, y: number, w: number) {
  poly(c, [x - w, y, x - w * 1.05, y - w * 0.95, x - w * 0.5, y - w * 0.42, x, y - w * 1.2, x + w * 0.5, y - w * 0.42, x + w * 1.05, y - w * 0.95, x + w, y], '#ffd34d', 1.6);
  c.fillStyle = '#e0453a'; c.beginPath(); c.arc(x, y - w * 0.3, w * 0.16, 0, 7); c.fill();
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
        back: (sx, sy) => cape(c, sx, sy, gy, f, t * 4, cloth, 8, 26),
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
        back: (sx, sy) => cape(c, sx, sy, gy, f, t * 3, '#7a1f16', 10, 34),
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
      back: (sx, sy) => cape(c, sx, sy, gy, f, t * 3, '#c0392b', 10, 32),
      head: (hx, hy, r) => { c.beginPath(); c.ellipse(hx, hy - r * 0.55, r * 1.2, r * 0.75, 0, Math.PI, 0); c.closePath(); fillStroke(c, vgrad(c, '#fff6e0', hy - r * 1.3, hy)); c.save(); c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - r * 1.1, hy - r * 0.6); c.quadraticCurveTo(hx, hy - r * 1.2, hx + r * 1.1, hy - r * 0.6); c.stroke(); c.restore(); glowDot(c, hx + f * r * 0.1, hy - r * 0.95, r * 0.2, '#e0453a', '#ffd0d0'); c.save(); c.strokeStyle = '#3a2210'; c.lineWidth = r * 0.25; c.beginPath(); c.moveTo(hx + f * r * 0.1, hy + r * 0.55); c.quadraticCurveTo(hx + f * r * 0.4, hy + r * 0.75, hx + f * r * 0.75, hy + r * 0.5); c.stroke(); c.restore(); },
      weapon: (hx, hy, ang) => { scimitar(c, f, h * 0.55)(hx, hy, ang); glowDot(c, hx, hy, 3, '#ffd34d'); } });
    case 'dragon': return dragon(a);
    case 'shadowqueen': return human(a, h, { skin: '#e8c0a0', cloth: '#2a1a3a', trim: '#c9a6ff', angry: true,
      back: (sx, sy) => cape(c, sx, sy, gy, f, t * 5, '#4a1f6a', 9, 30),
      head: (hx, hy, r) => { c.save(); c.strokeStyle = '#1a0f24'; c.lineWidth = r * 0.5; c.beginPath(); c.moveTo(hx, hy - r); c.quadraticCurveTo(hx - f * r * 2.2, hy - r * 0.2, hx - f * r * 1.7, hy + r * 1.9); c.stroke(); c.restore(); crownAt(c, hx, hy - r * 0.95, r * 0.5); c.fillStyle = '#1a0f24'; c.beginPath(); c.arc(hx, hy + r * 0.25, r * 0.95, 0.25, Math.PI - 0.25); c.closePath(); c.globalAlpha *= 0.85; c.fill(); c.globalAlpha /= 0.85; },
      weapon: (hx, hy, ang) => { const b2 = ang - f * 0.9; line(c, hx, hy, hx + Math.cos(b2) * h * 0.32, hy + Math.sin(b2) * h * 0.32, '#e0ccff', 2.6); glowDot(c, hx + Math.cos(b2) * h * 0.32, hy + Math.sin(b2) * h * 0.32, 3, '#b48cff'); },
      armAng: f > 0 ? lerp(-1.4, 0.7, a.atk) : Math.PI - lerp(-1.4, 0.7, a.atk) });
    case 'guardian': { rocks(c, x, gy, h / 84, f, a.swing, a.atk, '#c9a24a', true, '#7fe0ff'); glowDot(c, x, gy - h * 0.48, 6 + Math.sin(t * 3) * 1.5, '#7fe0ff'); return; }
    case 'firebird': { c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(255,${140 + i * 15},40,${0.28 - i * 0.03})`; c.beginPath(); c.arc(x - f * (24 + i * 13), gy - 18 + Math.sin(t * 8 + i) * 5, 13 - i, 0, 7); c.fill(); } c.restore();
      bird(a, gy - 10, h, '#ffb02e', '#ff5a1f', { crest: '#fff07a', beak: '#ffe08a' });
      const rider: ArtCtx = { ...a, gy: gy - h * 0.36, swing: 0 };
      human(rider, 36, { skin: '#f2d2b0', cloth: '#c0392b', trim: '#ffd34d', rider: true, head: turban(c, '#ffd34d'), armAng: f > 0 ? -0.3 : Math.PI + 0.3, weapon: (hx, hy) => glowDot(c, hx, hy, 4 + a.atk * 3, '#ff9a3d', '#fff0b0') });
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
      back: (sx, sy) => cape(c, sx, sy, gy, f, t * 3, '#1e3a6e', 8, 24),
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

/**
 * A ridden quadruped (camel, horse, elk): jointed legs with hooves, a shaped
 * barrel, an arched neck and a long head. Returns the saddle point.
 */
function steed(a: ArtCtx, o: { body: string; mane?: string; hump?: boolean; neckLen?: number; headLen?: number; leg?: number; antlers?: boolean; blanket?: string; trim?: string }) {
  const { c, x, gy, f } = a;
  const run = a.u.anim;
  const legH = o.leg ?? 30;
  const by = gy - legH - 4 - Math.abs(Math.sin(run)) * 3;
  const body = o.body;
  const leg = (dx: number, ph: number, far: boolean) => {
    const col = far ? shade(body, -0.22) : body;
    const sw = a.u.moving ? Math.sin(run * 1.2 + ph) : 0;
    const tx = x + f * dx, ty = by + 6;
    const kx = tx + f * sw * 8, ky = ty + legH * 0.5;
    const hx = kx + f * (sw * 6 - Math.max(0, -sw) * 5), hy = gy - 3 - Math.max(0, sw) * 5;
    capsule(c, tx, ty, kx, ky, 5.2, 3.4, col, 1.6);
    capsule(c, kx, ky, hx, hy, 3.2, 2.6, col, 1.6);
    c.fillStyle = shade(col, -0.45); c.beginPath(); c.roundRect(hx - 3.4, hy - 1, 6.8, 4, 1.5); c.fill();
  };
  leg(-16, 0, true); leg(14, Math.PI, true);
  // tail
  c.save(); c.strokeStyle = o.mane ?? shade(body, -0.3); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - f * 24, by - 3); c.quadraticCurveTo(x - f * 34, by + 2 + Math.sin(a.t * 6) * 3, x - f * 31, by + 18); c.stroke(); c.restore();
  // barrel
  c.beginPath();
  c.moveTo(x - f * 25, by);
  c.bezierCurveTo(x - f * 24, by - 13, x + f * 14, by - 15, x + f * 24, by - 6);
  c.bezierCurveTo(x + f * 30, by + 2, x + f * 24, by + 13, x + f * 12, by + 12);
  c.lineTo(x - f * 14, by + 12);
  c.bezierCurveTo(x - f * 26, by + 12, x - f * 28, by + 5, x - f * 25, by);
  c.closePath(); fillStroke(c, cel(c, body, x + f * 12, by - 15, x - f * 8, by + 12), 2.4, body);
  if (o.hump) { c.beginPath(); c.moveTo(x - f * 16, by - 8); c.quadraticCurveTo(x - f * 4, by - 30, x + f * 10, by - 10); c.closePath(); fillStroke(c, cel(c, body, x + f * 6, by - 26, x - f * 10, by - 6), 2.2, body); }
  if (o.blanket) {
    c.beginPath(); c.moveTo(x - f * 13, by - 10); c.lineTo(x + f * 11, by - 11); c.lineTo(x + f * 13, by + 5); c.lineTo(x - f * 15, by + 6); c.closePath(); fillStroke(c, cel(c, o.blanket, x + f * 10, by - 12, x - f * 10, by + 6), 1.8, o.blanket);
    if (o.trim) { c.fillStyle = o.trim; c.fillRect(x - 14, by + 3, 27, 3); for (let i = -12; i <= 10; i += 5) { c.beginPath(); c.arc(x + i, by + 7.5, 1.4, 0, 7); c.fill(); } }
  }
  leg(-12, Math.PI, false); leg(18, 0, false);
  // neck + head
  const nl = o.neckLen ?? 22, hl = o.headLen ?? 13;
  const nx = x + f * 20, ny = by - 6;
  const hx = nx + f * nl * 0.75, hy = ny - nl;
  c.beginPath();
  c.moveTo(nx - f * 4, ny + 4); c.quadraticCurveTo(nx + f * nl * 0.1, ny - nl * 0.75, hx - f * 4, hy - 4);
  c.lineTo(hx + f * 4, hy + 4); c.quadraticCurveTo(nx + f * nl * 0.6, ny - nl * 0.2, nx + f * 10, ny + 6); c.closePath();
  fillStroke(c, cel(c, body, hx, hy, nx, ny + 6), 2.2, body);
  if (o.mane) { c.save(); c.strokeStyle = o.mane; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(nx - f * 3, ny + 1); c.quadraticCurveTo(nx + f * nl * 0.05, ny - nl * 0.7, hx - f * 4, hy - 5); c.stroke(); c.restore(); }
  c.beginPath(); c.moveTo(hx - f * 4, hy - 5); c.quadraticCurveTo(hx + f * hl * 0.6, hy - 7, hx + f * hl, hy + 1); c.quadraticCurveTo(hx + f * hl * 1.05, hy + 5, hx + f * hl * 0.7, hy + 5); c.quadraticCurveTo(hx, hy + 6, hx - f * 4, hy + 3); c.closePath();
  fillStroke(c, cel(c, body, hx + f * hl, hy - 6, hx, hy + 6), 2, body);
  c.fillStyle = shade(body, -0.5); c.beginPath(); c.arc(hx + f * hl * 0.85, hy + 1.5, 1.3, 0, 7); c.fill(); // nostril
  poly(c, [hx - f * 2, hy - 4, hx - f * 5, hy - 11, hx + f * 1, hy - 5], body, 1.4); // ear
  eyes(c, hx + f * 1, hy - 1.5, 5.5, f, false);
  if (o.antlers) { c.save(); c.strokeStyle = '#efe3c4'; c.lineWidth = 2.3; c.lineCap = 'round'; for (const off of [-3, 3]) { const bx = hx - f * (1 + off * 0.3), byy = hy - 6; c.beginPath(); c.moveTo(bx, byy); c.lineTo(bx - f * 6, byy - 15); c.moveTo(bx - f * 3, byy - 7); c.lineTo(bx - f * 12, byy - 9); c.moveTo(bx - f * 5, byy - 12); c.lineTo(bx + f * 2, byy - 21); c.stroke(); } c.restore(); }
  // reins
  c.save(); c.strokeStyle = '#3a2416'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx + f * hl * 0.6, hy + 3); c.quadraticCurveTo(nx + f * 2, ny - 6, x + f * 4, by - 14); c.stroke(); c.restore();
  return { sx: x - f * 2, sy: o.hump ? by - 16 : by - 10 };
}

function camel(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, f } = a;
  const { sx, sy } = steed(a, { body: '#d8a861', hump: true, neckLen: 26, headLen: 14, leg: 33, blanket: cloth, trim });
  const rider: ArtCtx = { ...a, x: sx, gy: sy, swing: 0 };
  human(rider, 40, { skin, cloth, trim, rider: true, noScarf: true, head: turban(c, a.side ? '#7a1f16' : '#fff3d6'), weapon: scimitar(c, f, 22) });
}

function catapult(a: ArtCtx, cloth: string) {
  const { c, x, gy, f, atk } = a;
  const wood = '#a8713a';
  // chassis with iron bands
  c.beginPath(); c.roundRect(x - 30, gy - 24, 60, 11, 3); fillStroke(c, vgrad(c, wood, gy - 24, gy - 13), 2.2, wood);
  c.fillStyle = '#5a5f66'; for (const dx of [-22, 0, 22]) c.fillRect(x + dx - 1.5, gy - 24, 3, 11);
  // spoked wheels
  for (const dx of [-19, 19]) {
    circle(c, x + dx, gy - 9.5, 9.5, '#6b4423', 2.2);
    c.save(); c.strokeStyle = '#3b2414'; c.lineWidth = 1.4; for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + a.u.anim * 0.4; c.beginPath(); c.moveTo(x + dx, gy - 9.5); c.lineTo(x + dx + Math.cos(an) * 8, gy - 9.5 + Math.sin(an) * 8); c.stroke(); } c.restore();
    circle(c, x + dx, gy - 9.5, 2.6, '#9aa3ad', 1);
  }
  // A-frame
  poly(c, [x - f * 8, gy - 24, x + f * 5, gy - 50, x + f * 9, gy - 50, x + f * 18, gy - 24], shade(wood, -0.08), 2);
  const arm = f > 0 ? -2.6 + atk * 1.8 : -0.54 - atk * 1.8;
  const px = x + f * 7, py = gy - 47;
  const ex = px + Math.cos(arm) * 36, ey = py + Math.sin(arm) * 36;
  line(c, px - Math.cos(arm) * 8, py - Math.sin(arm) * 8, ex, ey, '#8b5a2b', 4.2);
  // sling cup + stone
  c.beginPath(); c.ellipse(ex, ey, 6.5, 4, arm, 0, Math.PI); fillStroke(c, '#5a3a22', 1.6);
  if (atk < 0.5) circle(c, ex, ey - 3, 5.5, '#8d8578', 1.6);
  // counterweight box
  const cx2 = px - Math.cos(arm) * 10, cy2 = py - Math.sin(arm) * 10;
  c.beginPath(); c.roundRect(cx2 - 6, cy2 - 3, 12, 11, 2); fillStroke(c, vgrad(c, '#4a4f56', cy2 - 3, cy2 + 8), 1.6, '#4a4f56');
  c.fillStyle = cloth; c.beginPath(); c.moveTo(x - f * 10, gy - 24); c.lineTo(x - f * 10, gy - 42); c.lineTo(x - f * 22, gy - 38); c.lineTo(x - f * 10, gy - 34); c.fill(); // banner
}

function scorpion(a: ArtCtx, s: number, king: boolean) {
  const { c, x, gy, f, swing, atk, t } = a;
  const col = king ? '#2f2a3a' : '#a8402a';
  // legs: four jointed pairs
  for (let i = 0; i < 4; i++) for (const far of [true, false]) {
    const ph = swing * 3 + i * 1.3 + (far ? Math.PI : 0);
    const bx = x - f * (18 - i * 12) * s, byy = gy - 22 * s;
    const kx = bx - f * (6 - i * 2) * s + Math.sin(ph) * 4 * s, ky = gy - (30 - (far ? 2 : 0)) * s;
    const fx = kx - f * (6 - i * 3) * s + Math.sin(ph) * 5 * s, fy = gy - 2;
    const lc = far ? shade(col, -0.25) : col;
    capsule(c, bx, byy, kx, ky, 3.2 * s, 2.6 * s, lc, 1.4); capsule(c, kx, ky, fx, fy, 2.6 * s, 1.4 * s, lc, 1.4);
  }
  // segmented tail arching over the back
  const segs = 7;
  const tx = x - f * 20 * s + f * atk * 50 * s, ty = gy - 108 * s + atk * 50 * s;
  for (let i = 0; i <= segs; i++) {
    const k = i / segs;
    const p0x = x - f * 40 * s, p0y = gy - 30 * s, cx = x - f * 82 * s, cy = gy - 104 * s;
    const px = (1 - k) * (1 - k) * p0x + 2 * (1 - k) * k * cx + k * k * tx, py = (1 - k) * (1 - k) * p0y + 2 * (1 - k) * k * cy + k * k * ty;
    ellipse(c, px, py, lerp(11, 7, k) * s, lerp(9, 6, k) * s, i % 2 ? col : shade(col, 0.08), 0, 2);
  }
  // stinger
  c.beginPath(); c.moveTo(tx - 6 * s, ty - 3 * s); c.quadraticCurveTo(tx + f * 18 * s, ty + 2 * s, tx + f * 10 * s, ty + 16 * s); c.quadraticCurveTo(tx + f * 4 * s, ty + 6 * s, tx - 5 * s, ty + 7 * s); c.closePath(); fillStroke(c, cel(c, '#ffd34d', tx, ty - 3 * s, tx, ty + 14 * s), 2, '#ffd34d');
  if (!LOW) glowDot(c, tx + f * 10 * s, ty + 15 * s, 2.2 * s, king ? '#c77dff' : '#9dff6a');
  // armoured body: overlapping plates
  ellipse(c, x, gy - 27 * s, 46 * s, 18 * s, col);
  c.save(); c.strokeStyle = shade(col, -0.4); c.lineWidth = 1.6 * s; for (let k = -3; k <= 3; k++) { c.beginPath(); c.arc(x + k * 11 * s, gy - 27 * s, 17 * s, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); } c.restore();
  // pincers
  for (const k of [1, -1]) {
    const cx = x + f * (56 + atk * 12) * s, cy = gy - (30 + k * 9) * s;
    limb(c, x + f * 34 * s, gy - 28 * s, cx, cy, -k * 6 * s, 5 * s, 4 * s, k > 0 ? col : shade(col, -0.2));
    const open = 0.35 + Math.sin(t * 6 + k) * 0.1 + atk * 0.4;
    for (const j of [-1, 1]) { c.save(); c.translate(cx, cy); c.rotate(j * open * f); c.beginPath(); c.moveTo(0, -3 * s * j); c.quadraticCurveTo(f * 16 * s, -6 * s * j, f * 20 * s, 0); c.quadraticCurveTo(f * 10 * s, 1 * s * j, 0, 3 * s * j); c.closePath(); fillStroke(c, cel(c, col, 0, -6 * s, f * 18 * s, 4 * s), 1.8, col); c.restore(); }
  }
  eyes(c, x + f * 28 * s, gy - 36 * s, 12 * s, f, true, king ? '#ff5c5c' : '#ffe14d');
  if (king) crownAt(c, x + f * 18 * s, gy - 44 * s, 12 * s);
}

function worm(a: ArtCtx, h: number) {
  const { c, x, gy, f, t, atk } = a;
  const col = '#c98a4a';
  // sand mound behind the body
  c.fillStyle = '#c9a46a'; c.beginPath(); c.ellipse(x - f * 30, gy + 2, 74, 14, 0, Math.PI, 0); c.fill();
  const seg = 10;
  for (let i = seg; i >= 0; i--) {
    const k = i / seg;
    const sx = x - f * k * 74 + Math.sin(t * 3 + i * 0.7) * 6;
    const sy = gy - (1 - k) * h * 0.85 - Math.sin(k * Math.PI) * 12;
    const r = lerp(27, 13, k);
    ellipse(c, sx, sy, r, r * 0.92, i % 2 ? col : '#b57638', 0, 2.6);
    // armour ridge on each ring
    c.save(); c.strokeStyle = shade(col, -0.35); c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, r * 0.8, Math.PI * 1.15, Math.PI * 1.75); c.stroke(); c.restore();
  }
  const hx = x + Math.sin(t * 3) * 6, hy = gy - h * 0.85;
  // ring of teeth inside an opening maw
  const open = 0.3 + atk * 0.6;
  c.save(); c.translate(hx + f * 18, hy);
  for (const k of [-1, 1]) { c.save(); c.rotate(k * open * f); c.beginPath(); c.moveTo(0, -5 * k); c.quadraticCurveTo(f * 24, -10 * k, f * 34, -2 * k); c.lineTo(f * 26, 9 * k); c.closePath(); fillStroke(c, cel(c, '#e9d7b0', 0, -8 * k, f * 30, 8 * k), 2, '#e9d7b0'); c.fillStyle = '#fff'; for (let j = 1; j <= 3; j++) { c.beginPath(); c.moveTo(f * j * 7, 2 * k); c.lineTo(f * (j * 7 + 2), 7 * k); c.lineTo(f * (j * 7 + 4), 2 * k); c.fill(); } c.restore(); }
  c.fillStyle = '#4a1a10'; c.beginPath(); c.ellipse(f * 8, 0, 6, 4 + open * 8, 0, 0, 7); c.fill();
  c.restore();
  eyes(c, hx - f * 8, hy - 12, 16, f, true, '#ffef5c');
}

function horseRider(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, f } = a;
  const { sx, sy } = steed(a, { body: a.side ? '#5a3a2a' : '#8b5a33', mane: '#2a1a10', neckLen: 22, headLen: 14, leg: 30, blanket: cloth, trim });
  const rider: ArtCtx = { ...a, x: sx, gy: sy + 4, swing: 0 };
  human(rider, 42, {
    skin, cloth: '#c9d2dc', trim, noScarf: true,
    head: (hx, hy, r) => { c.beginPath(); c.ellipse(hx, hy - r * 0.12, r * 1.06, r * 1.0, 0, Math.PI, 0); c.closePath(); fillStroke(c, cel(c, '#c9d2dc', hx + r, hy - r, hx - r, hy), 1.5, '#c9d2dc'); poly(c, [hx - 2, hy - r * 1.05, hx, hy - r * 1.75, hx + 2, hy - r * 1.05], cloth, 1.2); },
    rider: true, armAng: f > 0 ? 0.25 - a.atk * 0.25 : Math.PI - 0.25 + a.atk * 0.25,
    weapon: (hx, hy) => { const push = a.atk * 10 * f; line(c, hx - f * 14 + push, hy, hx + f * 40 + push, hy - 4, '#8b5a2b', 2.5); poly(c, [hx + f * 40 + push, hy - 8, hx + f * 54 + push, hy - 5, hx + f * 40 + push, hy - 1], '#dfe6ec', 1.2); c.fillStyle = cloth; c.beginPath(); c.moveTo(hx + f * 34 + push, hy - 4); c.lineTo(hx + f * 26 + push, hy - 12); c.lineTo(hx + f * 22 + push, hy - 4); c.fill(); },
  });
}

/** Elephants and mammoths: pillar legs, a domed back, ears, a curling trunk and tusks. */
function pachyderm(a: ArtCtx, o: { col: string; s: number; fur?: boolean; ear: number }) {
  const { c, x, gy, f, swing, atk } = a;
  const { col, s } = o;
  const by = gy - 50 * s - Math.abs(Math.sin(a.u.anim)) * 2;
  const leg = (dx: number, k: number, far: boolean) => {
    const lc = far ? shade(col, -0.22) : col;
    const off = Math.sin(swing * k * 0.6) * 6;
    capsule(c, x + f * dx * s, by + 14 * s, x + f * dx * s + off, gy - 6, 11 * s, 9.5 * s, lc, 2);
    c.fillStyle = shade(lc, 0.25); for (let n = -1; n <= 1; n++) { c.beginPath(); c.arc(x + f * dx * s + off + n * 4 * s + f * 3 * s, gy - 4, 2 * s, 0, 7); c.fill(); }
  };
  leg(-26, 1, true); leg(18, -1, true);
  // body: high domed back sloping to the rump
  c.beginPath(); c.moveTo(x - f * 46 * s, by + 8 * s);
  c.bezierCurveTo(x - f * 46 * s, by - 26 * s, x + f * 10 * s, by - 40 * s, x + f * 34 * s, by - 18 * s);
  c.bezierCurveTo(x + f * 46 * s, by - 4 * s, x + f * 40 * s, by + 26 * s, x + f * 20 * s, by + 26 * s);
  c.lineTo(x - f * 30 * s, by + 26 * s); c.quadraticCurveTo(x - f * 48 * s, by + 24 * s, x - f * 46 * s, by + 8 * s); c.closePath();
  fillStroke(c, cel(c, col, x + f * 20 * s, by - 34 * s, x - f * 20 * s, by + 26 * s), 2.6, col);
  if (o.fur) { c.save(); c.strokeStyle = shade(col, -0.32); c.lineWidth = 1.8; for (let k = -4; k <= 3; k++) { c.beginPath(); c.moveTo(x + k * 10 * s, by + 8 * s); c.quadraticCurveTo(x + k * 10 * s + 3, by + 22 * s, x + k * 10 * s - 1, by + 32 * s); c.stroke(); } c.restore(); }
  leg(-20, -1, false); leg(26, 1, false);
  // head, ear, trunk, tusk
  const hx = x + f * 40 * s, hy = by - 10 * s;
  ellipse(c, hx - f * 10 * s, hy + 4 * s, o.ear * s, (o.ear + 7) * s, shade(col, -0.1), f * 0.25, 2);
  c.beginPath(); c.ellipse(hx, hy - 4 * s, 19 * s, 18 * s, 0, 0, 7); fillStroke(c, rgrad(c, col, hx, hy - 4 * s, 18 * s), 2.4, col);
  if (o.fur) { c.fillStyle = shade(col, -0.25); c.beginPath(); c.ellipse(hx - f * 2 * s, hy - 20 * s, 10 * s, 6 * s, 0, 0, 7); c.fill(); }
  const tr = -0.3 + atk * 1.4;
  const ex = hx + f * (16 + Math.sin(tr) * 20) * s, ey = hy + (38 - atk * 30) * s;
  // trunk: tapered with ring creases
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) { const k = i / 8; const p0x = hx + f * 12 * s, p0y = hy + 2 * s, cx = hx + f * 26 * s, cy = hy + 20 * s; pts.push([(1 - k) * (1 - k) * p0x + 2 * (1 - k) * k * cx + k * k * ex, (1 - k) * (1 - k) * p0y + 2 * (1 - k) * k * cy + k * k * ey]); }
  for (let i = 0; i < 8; i++) capsule(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(7, 3.6, i / 8) * s, lerp(7, 3.6, (i + 1) / 8) * s, col, 1.4);
  // tusk
  c.beginPath(); c.moveTo(hx + f * 8 * s, hy + 8 * s); c.quadraticCurveTo(hx + f * (o.fur ? 44 : 30) * s, hy + (o.fur ? 34 : 18) * s, hx + f * (o.fur ? 38 : 32) * s, hy + (o.fur ? -2 : 8) * s); c.quadraticCurveTo(hx + f * 22 * s, hy + 16 * s, hx + f * 10 * s, hy + 13 * s); c.closePath(); fillStroke(c, cel(c, '#f4ecd8', hx + f * 30 * s, hy, hx, hy + 16 * s), 1.6, '#f4ecd8');
  eyes(c, hx + f * 4 * s, hy - 10 * s, 11 * s, f, a.side === 1);
  return { by, hx, hy };
}

function elephant(a: ArtCtx, cloth: string, trim: string, skin: string) {
  const { c, x, f } = a;
  const s = a.u.def.height / 105;
  const { by } = pachyderm(a, { col: '#8f8a86', s, ear: 16 });
  // howdah: canopy over a carved seat
  c.beginPath(); c.roundRect(x - 26 * s, by - 52 * s, 46 * s, 22 * s, 4); fillStroke(c, cel(c, cloth, x + 20 * s, by - 52 * s, x - 20 * s, by - 30 * s), 2, cloth);
  c.fillStyle = trim; c.fillRect(x - 30 * s, by - 32 * s, 54 * s, 6 * s);
  for (let i = -24; i <= 20; i += 8) { c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x + i * s, by - 26 * s, 1.6 * s, 0, 7); c.fill(); }
  poly(c, [x - 30 * s, by - 52 * s, x - 3 * s, by - 70 * s, x + 24 * s, by - 52 * s], trim, 1.8);
  void skin; void f;
}

function mummy(a: ArtCtx, h: number, king: boolean) {
  const { c } = a;
  human(a, h, {
    skin: '#d8ccaa', cloth: '#cbbd98', trim: king ? '#ffd34d' : '#9c8d6a', glowEyes: king ? '#ff4d4d' : '#9effa0', angry: true, noScarf: true,
    armAng: a.f > 0 ? -0.1 + a.atk * 0.3 : Math.PI + 0.1 - a.atk * 0.3,
    head: (hx, hy, r) => {
      c.save(); c.strokeStyle = 'rgba(110,95,60,.55)'; c.lineWidth = 1.3;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx - r * 0.9, hy + i * r * 0.32); c.lineTo(hx + r * 0.9, hy + i * r * 0.32 - r * 0.2); c.stroke(); }
      c.restore();
      if (king) {
        c.beginPath(); c.arc(hx, hy, r * 1.08, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(hx + r * 0.9, hy - r * 0.45); c.quadraticCurveTo(hx, hy - r * 0.75, hx - r * 0.9, hy - r * 0.45); c.closePath(); fillStroke(c, '#ffd34d', 2);
        for (const sd of [-1, 1]) {
          poly(c, [hx + sd * r * 0.85, hy - r * 0.5, hx + sd * r * 1.25, hy - r * 0.2, hx + sd * r * 1.2, hy + r * 1.1, hx + sd * r * 0.8, hy + r * 0.9], '#ffd34d', 2);
          c.fillStyle = '#2a6fb5'; for (let i = 0; i < 3; i++) c.fillRect(hx + sd * r * 1.02 - r * 0.18, hy - r * 0.05 + i * r * 0.35, r * 0.36, r * 0.12);
        }
        crownAt(c, hx, hy - r * 0.95, r * 0.5);
      }
    },
    weapon: king ? scimitar(c, a.f, h * 0.5) : undefined,
  });
  // wrappings over the body and a loose strip in the wind
  c.save(); c.strokeStyle = 'rgba(120,104,70,.45)'; c.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) { const yy = a.gy - h * (0.62 - k * 0.09); c.beginPath(); c.moveTo(a.x - h * 0.1, yy); c.lineTo(a.x + h * 0.11, yy - h * 0.04); c.stroke(); }
  c.strokeStyle = '#cbbd98'; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x - a.f * 6, a.gy - h * 0.45); c.quadraticCurveTo(a.x - a.f * 20, a.gy - h * 0.35 + Math.sin(a.t * 4) * 4, a.x - a.f * 26, a.gy - h * 0.2); c.stroke(); c.restore();
}

function skeleton(a: ArtCtx, h: number, archer = false) {
  const { c, x, gy, f, swing } = a;
  const bone = '#ece6d6';
  const R = h * 0.15, headY = gy - h + R, hip = gy - h * 0.4;
  const bob = a.u.moving ? Math.abs(Math.sin(a.u.anim)) * 1.5 : 0;
  // legs with knee knobs
  for (const sw of [-swing, swing]) {
    const kx = x + f * Math.sin(sw) * h * 0.2, ky = hip - bob + h * 0.2;
    line(c, x, hip - bob, kx, ky, bone, 2.4); line(c, kx, ky, kx + f * Math.sin(sw - 0.3) * h * 0.18, gy - 2, bone, 2.2);
    circle(c, kx, ky, 2, bone, 1);
  }
  // pelvis, spine and ribs
  ellipse(c, x, hip - bob, h * 0.08, h * 0.04, bone, 0, 1.4);
  line(c, x, hip - bob, x + f * 1, headY + R - bob, bone, 2.6);
  for (let i = 0; i < 4; i++) { const yy = headY + R * 1.5 + i * h * 0.055 - bob; c.save(); c.strokeStyle = ink(bone); c.lineWidth = 3.4; c.beginPath(); c.arc(x + f * 1, yy, R * (0.75 - i * 0.08), Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.strokeStyle = bone; c.lineWidth = 1.8; c.stroke(); c.restore(); }
  line(c, x, headY + R * 1.3 - bob, x - f * Math.sin(swing) * h * 0.18, headY + R + h * 0.22 - bob, bone, 2);
  // skull with cheekbones and a jaw
  c.beginPath(); c.ellipse(x + f * 1, headY - bob, R, R * 0.95, 0, 0, 7); fillStroke(c, rgrad(c, bone, x, headY - bob, R), 2, bone);
  c.beginPath(); c.roundRect(x + f * R * 0.1 - R * 0.45, headY + R * 0.6 - bob, R * 0.9, R * 0.4, 2); fillStroke(c, bone, 1.4);
  c.fillStyle = '#1b1b1b';
  for (const k of [0.15, 0.6]) { c.beginPath(); c.ellipse(x + f * R * k, headY - R * 0.05 - bob, R * 0.2, R * 0.24, 0, 0, 7); c.fill(); }
  c.fillStyle = '#ff5c3d'; for (const k of [0.15, 0.6]) { c.beginPath(); c.arc(x + f * R * k, headY - R * 0.02 - bob, R * 0.07, 0, 7); c.fill(); }
  c.fillStyle = '#1b1b1b'; for (let k = 0; k < 4; k++) c.fillRect(x + f * R * (k * 0.2 - 0.25), headY + R * 0.65 - bob, f * R * 0.06, R * 0.28);
  const ang = archer ? (f > 0 ? -0.15 : Math.PI + 0.15) : f > 0 ? lerp(-1.25, 0.55, a.atk) : Math.PI - lerp(-1.25, 0.55, a.atk);
  const sx = x + f * R * 0.3, sy = headY + R * 1.3 - bob;
  const hx = sx + Math.cos(ang) * h * 0.24, hy = sy + Math.sin(ang) * h * 0.24;
  line(c, sx, sy, hx, hy, bone, 2);
  if (archer) bow(c, hx, hy, h * 0.3, f, a.atk, '#5a4a3a');
  else scimitar(c, f, h * 0.38)(hx, hy, ang);
}

function cobra(a: ArtCtx, h: number, queen: boolean) {
  const { c, x, gy, f, t, atk } = a;
  const col = queen ? '#3f7d4a' : '#6f8f3a';
  const belly = queen ? '#e8d27a' : '#d9c98a';
  const s = h / 40;
  // body: tapered coil drawn as a chain of capsules
  const pts: [number, number][] = [];
  const hx = x + f * (6 + atk * 14) * s, hy = gy - 38 * s;
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    if (k < 0.5) { const q = k / 0.5; pts.push([x - f * (32 - q * 28) * s, gy - 5 * s + Math.sin(t * 5 + q * 6) * 2 * s - Math.sin(q * Math.PI) * 3 * s]); }
    else { const q = (k - 0.5) / 0.5; pts.push([lerp(x - f * 4 * s, hx, q) + f * Math.sin(q * Math.PI) * 6 * s, lerp(gy - 6 * s, hy + 10 * s, q)]); }
  }
  for (let i = 0; i < pts.length - 1; i++) capsule(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(3, 6, i / 14) * s, lerp(3, 6, (i + 1) / 14) * s, i % 3 ? col : shade(col, -0.15), 1.4);
  // hood with markings
  c.beginPath(); c.moveTo(hx - f * 2 * s, hy - 6 * s); c.bezierCurveTo(hx - f * 16 * s, hy - 4 * s, hx - f * 14 * s, hy + 16 * s, hx - f * 2 * s, hy + 18 * s); c.bezierCurveTo(hx + f * 8 * s, hy + 16 * s, hx + f * 10 * s, hy, hx - f * 2 * s, hy - 6 * s); c.closePath(); fillStroke(c, cel(c, col, hx + f * 6 * s, hy - 6 * s, hx - f * 10 * s, hy + 18 * s), 2, col);
  c.fillStyle = belly; c.beginPath(); c.ellipse(hx - f * 1 * s, hy + 7 * s, 4.5 * s, 9 * s, 0, 0, 7); c.fill();
  c.strokeStyle = shade(col, -0.4); c.lineWidth = 1.2; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(hx - f * 5 * s, hy + (2 + k * 3.5) * s); c.lineTo(hx + f * 3 * s, hy + (2 + k * 3.5) * s); c.stroke(); }
  // head
  c.beginPath(); c.moveTo(hx - f * 3 * s, hy - 8 * s); c.quadraticCurveTo(hx + f * 10 * s, hy - 10 * s, hx + f * 11 * s, hy - 3 * s); c.quadraticCurveTo(hx + f * 6 * s, hy + 1 * s, hx - f * 3 * s, hy - 1 * s); c.closePath(); fillStroke(c, cel(c, col, hx + f * 8 * s, hy - 10 * s, hx, hy), 1.6, col);
  eyes(c, hx + f * 1.5 * s, hy - 5 * s, 6.5 * s, f, true, queen ? '#ff4d4d' : '#ffe14d');
  if (atk > 0.3) { c.strokeStyle = '#e0453a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx + f * 10 * s, hy - 3 * s); c.lineTo(hx + f * 16 * s, hy - 2 * s); c.lineTo(hx + f * 18 * s, hy - 4 * s); c.moveTo(hx + f * 16 * s, hy - 2 * s); c.lineTo(hx + f * 18 * s, hy); c.stroke(); }
  if (queen) crownAt(c, hx + f * 1 * s, hy - 9 * s, 6 * s);
}

// ---------------- civilization helpers ----------------
function elfEars(c: C, hx: number, hy: number, r: number, f: number, skin: string) {
  poly(c, [hx - f * r * 0.7, hy - r * 0.05, hx - f * r * 1.65, hy - r * 0.8, hx - f * r * 0.8, hy + r * 0.3], skin, 1.2);
  // long flowing hair for elves
  c.save(); c.fillStyle = '#e8d9a0'; c.beginPath(); c.moveTo(hx + f * r * 0.7, hy - r * 0.75); c.quadraticCurveTo(hx, hy - r * 1.3, hx - f * r * 0.9, hy - r * 0.5); c.quadraticCurveTo(hx - f * r * 1.2, hy + r * 0.6, hx - f * r * 1.0, hy + r * 1.3); c.lineTo(hx - f * r * 0.55, hy + r * 0.4); c.quadraticCurveTo(hx - f * r * 0.2, hy - r * 0.5, hx + f * r * 0.7, hy - r * 0.75); c.fill(); c.restore();
}
function bow(c: C, hx: number, hy: number, r: number, f: number, atk: number, col: string) {
  // recurve bow: thick grip, thinning limbs that curl at the tips
  c.save(); c.lineCap = 'round';
  const cx = hx - f * r * 0.3;
  for (const [w, colr] of [[4.2, ink(col)], [2.8, col]] as [number, string][]) { c.lineWidth = w; c.strokeStyle = colr; c.beginPath(); if (f > 0) c.arc(cx, hy, r, -1.15, 1.15); else c.arc(hx + r * 0.3, hy, r, Math.PI - 1.15, Math.PI + 1.15); c.stroke(); }
  const tipX = cx + f * Math.cos(1.15) * r;
  c.lineWidth = 2; c.strokeStyle = col; for (const k of [-1, 1]) { c.beginPath(); c.moveTo(tipX, hy + k * Math.sin(1.15) * r); c.lineTo(tipX - f * 3, hy + k * (Math.sin(1.15) * r + 3)); c.stroke(); }
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(tipX, hy - Math.sin(1.15) * r); c.lineTo(hx - f * (6 + atk * 10), hy); c.lineTo(tipX, hy + Math.sin(1.15) * r); c.stroke();
  if (atk < 0.4) { c.strokeStyle = '#8b5a2b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx - f * (6 + atk * 10), hy); c.lineTo(hx + f * r * 0.7, hy); c.stroke(); }
  c.restore();
}
function beard(c: C, hx: number, hy: number, r: number, f: number, col: string, long = false) {
  c.beginPath(); c.moveTo(hx - f * r * 0.3, hy + r * 0.05); c.quadraticCurveTo(hx - f * r * 0.1, hy + r * (long ? 2.3 : 1.7), hx + f * r * 0.55, hy + r * (long ? 1.9 : 1.3));
  c.quadraticCurveTo(hx + f * r * 1.05, hy + r * 0.8, hx + f * r * 0.95, hy + r * 0.15); c.quadraticCurveTo(hx + f * r * 0.4, hy + r * 0.55, hx - f * r * 0.3, hy + r * 0.05); c.closePath(); fillStroke(c, cel(c, col, hx + f * r, hy, hx, hy + r * 2), 1.4, col);
  c.save(); c.strokeStyle = shade(col, -0.25); c.lineWidth = 1; for (const k of [0.1, 0.4]) { c.beginPath(); c.moveTo(hx + f * r * k, hy + r * 0.6); c.lineTo(hx + f * r * (k + 0.05), hy + r * (long ? 1.8 : 1.3)); c.stroke(); } c.restore();
}
function axe(c: C, hx: number, hy: number, ang: number, len: number, f: number) {
  const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
  line(c, hx, hy, ex, ey, '#7a4f28', 3);
  c.save(); c.translate(ex, ey); c.rotate(ang); c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(5, -13 * f, -9, -15 * f); c.quadraticCurveTo(-6, -6 * f, -11, 2 * f); c.closePath(); fillStroke(c, cel(c, '#c9d2dc', 0, -14 * f, -8, 2 * f), 1.6, '#8a96a3'); c.restore();
}
function zombieLook(c: C, f: number, cloth: string): HumanOpts {
  return {
    skin: '#8fae6a', cloth, trim: '#3a2a1a', angry: true, noScarf: true,
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
  return { skin: '#e6b48a', cloth, trim: '#c9a24a', bulk: 1.25 };
}
function goblinLook(c: C, f: number): HumanOpts {
  return {
    skin: '#7fae4a', cloth: '#6b4a2a', trim: '#3a2a1a', angry: true, noScarf: true,
    head: (hx, hy, r) => { for (const sd of [-1, 1]) poly(c, [hx + sd * r * 0.8, hy - r * 0.2, hx + sd * r * 1.9, hy - r * 0.6, hx + sd * r * 0.9, hy + r * 0.3], '#7fae4a', 1.3); c.fillStyle = '#5f8a3a'; c.beginPath(); c.ellipse(hx + f * r * 0.95, hy + r * 0.15, r * 0.22, r * 0.14, 0, 0, 7); c.fill(); },
  };
}

function treant(a: ArtCtx, h: number) {
  const { c, x, gy, f, swing, atk, t } = a;
  const bark = '#6b4a2a';
  // root legs
  for (const sw of [-swing, swing]) { const kx = x + Math.sin(sw) * h * 0.12, ky = gy - h * 0.16; capsule(c, x, gy - h * 0.3, kx, ky, h * 0.06, h * 0.05, shade(bark, -0.12), 2); capsule(c, kx, ky, kx + f * h * 0.06, gy - 3, h * 0.05, h * 0.035, shade(bark, -0.12), 2); }
  // trunk with bark grooves and a knot
  c.beginPath(); c.moveTo(x - h * 0.18, gy - h * 0.28); c.quadraticCurveTo(x - h * 0.24, gy - h * 0.7, x - h * 0.1, gy - h * 0.86); c.lineTo(x + h * 0.12, gy - h * 0.86); c.quadraticCurveTo(x + h * 0.25, gy - h * 0.6, x + h * 0.18, gy - h * 0.28); c.closePath();
  fillStroke(c, cel(c, bark, x + h * 0.2, gy - h * 0.86, x - h * 0.2, gy - h * 0.3), 2.4, bark);
  c.strokeStyle = 'rgba(40,25,10,.5)'; c.lineWidth = 1.5; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * h * 0.07, gy - h * 0.8); c.quadraticCurveTo(x + k * h * 0.1, gy - h * 0.55, x + k * h * 0.06, gy - h * 0.32); c.stroke(); }
  c.fillStyle = shade(bark, -0.3); c.beginPath(); c.ellipse(x - f * h * 0.05, gy - h * 0.45, h * 0.035, h * 0.05, 0, 0, 7); c.fill();
  // branch arms
  limb(c, x - f * h * 0.1, gy - h * 0.7, x - f * h * 0.36, gy - h * 0.42, f * h * 0.05, 5, 3, shade(bark, -0.15));
  const ax = x + f * (h * 0.36 + atk * 10), ay = gy - h * (0.6 - atk * 0.2);
  limb(c, x + f * h * 0.1, gy - h * 0.72, ax, ay, -f * h * 0.05, 6, 4, bark);
  line(c, ax, ay, ax + f * 11, ay - 8, bark, 3); line(c, ax, ay, ax + f * 13, ay + 4, bark, 3);
  // layered leafy crown with blossoms
  for (const [dx, dy, r, d] of [[-0.18, -0.88, 0.17, -0.12], [0.19, -0.9, 0.18, -0.06], [0, -0.96, 0.23, 0], [0.02, -1.1, 0.16, 0.08]] as [number, number, number, number][]) circle(c, x + dx * h, gy + dy * h + Math.sin(t * 1.5 + dx * 10) * 1.5, r * h, shade('#3f8f3a', d), 2);
  for (const [dx, dy] of [[-0.1, -1.02], [0.14, -0.98], [0.02, -1.14]]) { c.fillStyle = '#ffd1e8'; c.beginPath(); c.arc(x + dx * h, gy + dy * h, 2.2, 0, 7); c.fill(); }
  eyes(c, x + f * h * 0.02, gy - h * 0.66, h * 0.12, f, true, '#d8ff7a');
}

function elkRider(a: ArtCtx) {
  const { c, f } = a;
  const { sx, sy } = steed(a, { body: '#9a6a3a', mane: '#e8dcc0', neckLen: 22, headLen: 13, leg: 30, antlers: true, blanket: '#2f8f4e', trim: '#d9c36a' });
  const rider: ArtCtx = { ...a, x: sx, gy: sy + 4, swing: 0 };
  human(rider, 42, { skin: '#f2d2b0', cloth: '#2f8f4e', trim: '#d9c36a', rider: true, noScarf: true, head: (hx, hy, r) => elfEars(c, hx, hy, r, f, '#f2d2b0'),
    armAng: f > 0 ? 0.25 - a.atk * 0.25 : Math.PI - 0.25 + a.atk * 0.25,
    weapon: (hx, hy) => { const push = a.atk * 10 * f; line(c, hx - f * 14 + push, hy, hx + f * 40 + push, hy - 4, '#d9c36a', 2.5); poly(c, [hx + f * 40 + push, hy - 8, hx + f * 52 + push, hy - 5, hx + f * 40 + push, hy - 1], '#dfe6ec', 1.2); } });
}

function mammoth(a: ArtCtx) {
  const { c, x, f } = a;
  const s = a.u.def.height / 110;
  const { by } = pachyderm(a, { col: '#7a5a3a', s, fur: true, ear: 10 });
  const rider: ArtCtx = { ...a, x: x - f * 6 * s, gy: by - 28 * s, swing: 0 };
  human(rider, 40, { ...goblinLook(c, f), rider: true, armAng: f > 0 ? 0.1 : Math.PI - 0.1,
    weapon: (hx2, hy2) => { line(c, hx2 - f * 10, hy2, hx2 + f * 30, hy2, '#8b5a2b', 2.5); poly(c, [hx2 + f * 30, hy2 - 4, hx2 + f * 40, hy2, hx2 + f * 30, hy2 + 4], '#cfd6dc', 1.2); } });
}

function dragon(a: ArtCtx) {
  const { c, x, gy, f, t, atk } = a;
  const s = a.u.def.height / 96;
  const y = gy - 10 + Math.sin(t * 2.5 + a.u.uid) * 5;
  const body = '#d98a2b', belly = '#f6d68a', wing = '#a84a1f';
  const flap = Math.sin(t * 5);
  // bat-like membrane wing with finger bones
  const wingShape = (far: boolean) => {
    const col = far ? shade(wing, -0.22) : wing;
    const lift = (far ? 70 : 84) + flap * (far ? 30 : 34);
    const rx = x - f * (far ? 6 : 2) * s, ry = y - (far ? 30 : 34) * s;
    const tipx = rx - f * 34 * s, tipy = y - lift * s;
    const pts = [[rx - f * 62 * s, y - (32 + flap * 18) * s], [rx - f * 46 * s, y - (24 + flap * 10) * s], [rx - f * 26 * s, y - 18 * s]];
    c.beginPath(); c.moveTo(rx, ry); c.lineTo(tipx, tipy);
    for (const [px, py] of pts) c.quadraticCurveTo((tipx + px) / 2 + f * 4 * s, (tipy + py) / 2 + 8 * s, px, py);
    c.quadraticCurveTo(rx - f * 12 * s, y - 14 * s, rx + f * 8 * s, y - 20 * s); c.closePath();
    fillStroke(c, cel(c, col, tipx, tipy, rx, y - 14 * s), 2, col);
    c.save(); c.strokeStyle = shade(col, -0.45); c.lineWidth = 1.6; for (const [px, py] of pts) { c.beginPath(); c.moveTo(tipx, tipy); c.lineTo(px, py); c.stroke(); } c.beginPath(); c.moveTo(rx, ry); c.lineTo(tipx, tipy); c.lineWidth = 3; c.stroke(); c.restore();
  };
  wingShape(true);
  // tail with spade tip
  const tpts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) { const k = i / 8; tpts.push([x - f * (24 + k * 60) * s, y - 20 * s + Math.sin(k * Math.PI) * 14 * s + Math.sin(t * 3 + k * 3) * 4 * k]); }
  for (let i = 0; i < 8; i++) capsule(c, tpts[i][0], tpts[i][1], tpts[i + 1][0], tpts[i + 1][1], lerp(9, 3, i / 8) * s, lerp(9, 3, (i + 1) / 8) * s, body, 1.4);
  const [ex, ey] = tpts[8];
  poly(c, [ex, ey, ex - f * 12 * s, ey - 9 * s, ex - f * 15 * s, ey + 3 * s, ex - f * 6 * s, ey + 8 * s], wing, 1.6);
  // body + belly plates
  ellipse(c, x, y - 24 * s, 34 * s, 20 * s, body);
  c.fillStyle = belly; c.beginPath(); c.ellipse(x + f * 4 * s, y - 15 * s, 22 * s, 9 * s, 0, 0, Math.PI); c.fill();
  c.strokeStyle = shade(belly, -0.3); c.lineWidth = 1; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + f * (4 + k * 7) * s, y - 15 * s); c.lineTo(x + f * (4 + k * 7) * s, y - 7 * s); c.stroke(); }
  // back spikes
  for (let k = 0; k < 5; k++) { const px = x - f * (20 - k * 9) * s, py = y - (40 + Math.sin(k) * 2) * s; poly(c, [px - 3 * s, py + 4 * s, px - f * 1 * s, py - 6 * s, px + 3 * s, py + 4 * s], '#f4ecd8', 1); }
  // neck + head
  const npts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) { const k = i / 6; npts.push([x + f * (24 + k * 30) * s, y - (30 + Math.sin(k * Math.PI * 0.6) * 26 + k * 4) * s]); }
  for (let i = 0; i < 6; i++) capsule(c, npts[i][0], npts[i][1], npts[i + 1][0], npts[i + 1][1], lerp(10, 7, i / 6) * s, lerp(10, 7, (i + 1) / 6) * s, body, 1.4);
  const hx = x + f * 58 * s, hy = y - 60 * s;
  c.beginPath(); c.moveTo(hx - f * 12 * s, hy - 6 * s); c.quadraticCurveTo(hx + f * 4 * s, hy - 14 * s, hx + f * 24 * s, hy - 2 * s); c.lineTo(hx + f * 26 * s, hy + 3 * s); c.quadraticCurveTo(hx + f * 6 * s, hy + 12 * s, hx - f * 10 * s, hy + 8 * s); c.closePath();
  fillStroke(c, cel(c, body, hx + f * 18 * s, hy - 12 * s, hx - f * 6 * s, hy + 10 * s), 2, body);
  // jaw opens to breathe fire
  c.save(); c.translate(hx + f * 2 * s, hy + 6 * s); c.rotate(f * atk * 0.5); c.beginPath(); c.moveTo(0, 0); c.lineTo(f * 22 * s, -1 * s); c.quadraticCurveTo(f * 10 * s, 6 * s, 0, 5 * s); c.closePath(); fillStroke(c, belly, 1.4); c.restore();
  for (const k of [-1, 1]) poly(c, [hx - f * 6 * s, hy - 8 * s, hx - f * (18 + k * 3) * s, hy - 24 * s, hx - f * 2 * s, hy - 11 * s], '#f4ecd8', 1.2);
  eyes(c, hx + f * 6 * s, hy - 4 * s, 9 * s, f, true, '#ffe14d');
  if (atk > 0.2) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? 'rgba(255,200,60,.7)' : 'rgba(255,90,30,.6)'; c.beginPath(); c.arc(hx + f * (30 + i * 12) * s, hy + 6 * s + i * 3, (5 + i * 2) * s, 0, 7); c.fill(); } c.restore(); }
  wingShape(false);
  // legs with claws
  for (const k of [-8, 10]) { limb(c, x + f * k * s, y - 10 * s, x + f * (k + 6) * s, y + 6 * s, f * 3 * s, 5 * s, 3 * s, body); c.fillStyle = '#f4ecd8'; c.beginPath(); c.moveTo(x + f * (k + 6) * s, y + 6 * s); c.lineTo(x + f * (k + 11) * s, y + 9 * s); c.lineTo(x + f * (k + 5) * s, y + 9 * s); c.fill(); }
}

export function isBossy(id: string) { return ['boss', 'scorpking', 'roc', 'worm', 'titan', 'djinn', 'warlord', 'mummyking', 'cobraqueen', 'phoenix', 'elfqueen', 'ghostking', 'plaguelord', 'dwarfking', 'giantking'].includes(id); }

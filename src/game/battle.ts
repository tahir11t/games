import { UNITS, MINER_GOLD, MINER_INTERVAL, MAX_MINERS, MAX_ARMY, CONTROL_BONUS, COUNTER_BONUS, FLY_HEIGHT, upgradeMult, type EnemyId, type UnitId, type UnitDef } from '../data/units';
import type { LevelDef } from '../data/levels';
import { ABILITIES, passiveFx, type Perks } from '../data/skills';
import { survivalWave } from '../data/challenges';
import { sfx } from './audio';

export const W = 2400;
export const H = 540;
export const GROUND = 385;
export const CASTLE_X = [130, W - 130];
export const MINE_X = [340, W - 340];

export type Mode = 'defend' | 'hold' | 'attack';
export type Side = 0 | 1;

export interface Unit {
  uid: number;
  def: UnitDef;
  side: Side;
  x: number;
  lane: number; // depth offset
  hp: number;
  maxHp: number;
  dmg: number;
  cd: number;
  anim: number;
  moving: boolean;
  attacking: number; // attack anim timer
  chargeReady: boolean;
  mineTimer: number;
  dead: number; // >0 while playing death anim
  hitFlash: number;
  healFx: number;
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  side: Side; dmg: number; splash: number; kind: 'arrow' | 'rock' | 'magic' | 'fire' | 'meteor';
  bonusVs?: EnemyId[]; life: number;
  target?: Unit; // homing shot (used against flying units)
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
export interface FloatText { x: number; y: number; text: string; life: number; color: string; }
export interface QueueItem { id: UnitId; left: number; }

export interface BattleEvents {
  onEnd(win: boolean): void;
  onUnitTrained(id: UnitId): void;
  onWave?(n: number): void;
}

const DEFAULT_PERKS: Perks = {
  unitLevels: { miner: 1, sword: 1, archer: 1, spear: 1, camel: 1, catapult: 1, healer: 1, falcon: 1, fire: 1, lion: 1, assassin: 1, giant: 1, genie: 1, hero: 1 },
  ability: 'volley',
  passives: { mining: 0, walls: 0, treasury: 0, eagle: 0, wisdom: 0 },
};

let UID = 1;

export class Battle {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  castleHp: [number, number];
  castleMax: [number, number];
  gold: number;
  queue: QueueItem[] = [];
  mode: Mode = 'defend';
  ability = 0; // 0..1
  abilityFx = 0;
  buff = 0; // war cry timer
  debuff = 0; // sandstorm timer
  controlled: Unit | null = null;
  ctrlDir = 0;
  ctrlAttack = false;
  time = 0;
  over = false;
  paused = false;
  revived = false;
  shake = 0;
  waveIdx = 0;
  loopCount = 0;
  producedCounts: Partial<Record<UnitId, number>> = {};
  enemyAlert = 0;
  counterTimer = 25;
  storm = 0;
  survivalWave = 0;
  private survivalNext = 8;
  private passiveIncome = 0;
  private heroes: Unit[] = [];
  readonly perks: Perks;
  readonly allowed: UnitId[] | null;

  constructor(public level: LevelDef, perks: Partial<Perks> | Record<UnitId, number>, startGold: number, private ev: BattleEvents) {
    // Accept a bare unitLevels map (balance scripts) or full perks.
    const p = 'unitLevels' in perks ? (perks as Partial<Perks>) : { unitLevels: perks as Record<UnitId, number> };
    this.perks = { ...DEFAULT_PERKS, ...p, unitLevels: { ...DEFAULT_PERKS.unitLevels, ...p.unitLevels }, passives: { ...DEFAULT_PERKS.passives, ...p.passives } };
    this.allowed = level.allowed ?? null;
    const fort = 1500 * passiveFx.walls(this.perks.passives.walls);
    this.castleMax = [fort, level.castleHp];
    this.castleHp = [fort, level.castleHp];
    this.gold = Math.max(startGold, level.startGold ?? 0) + passiveFx.treasury(this.perks.passives.treasury);
    if (!level.mods?.noMiners) {
      this.spawn('miner', 0);
      this.spawn('miner', 0);
      this.units[0].x += 20;
    }
  }

  get survival() { return this.level.kind === 'survival'; }
  get playerArmy() { return this.units.filter((u) => u.side === 0 && !u.dead); }
  get goldMult() { return (this.level.mods?.goldMult ?? 1) * passiveFx.mining(this.perks.passives.mining); }
  minerCount() { return this.units.filter((u) => u.side === 0 && !u.dead && u.def.id === 'miner').length + this.queue.filter((q) => q.id === 'miner').length; }
  armyCount() { return this.playerArmy.length + this.queue.length; }

  isAllowed(id: UnitId) {
    if (id === 'miner' && this.level.mods?.noMiners) return false;
    return !this.allowed || this.allowed.includes(id);
  }

  canTrain(id: UnitId) {
    const d = UNITS[id];
    if (!this.isAllowed(id)) return false;
    if (this.gold < d.cost) return false;
    if (id === 'miner' && this.minerCount() >= MAX_MINERS) return false;
    if (this.armyCount() >= MAX_ARMY) return false;
    if (d.maxCount && this.units.filter((u) => u.side === 0 && !u.dead && u.def.id === id).length + this.queue.filter((q) => q.id === id).length >= d.maxCount) return false;
    return true;
  }

  train(id: UnitId) {
    if (!this.canTrain(id)) return false;
    this.gold -= UNITS[id].cost;
    this.queue.push({ id, left: UNITS[id].train });
    sfx('click');
    return true;
  }

  spawn(id: EnemyId, side: Side, mult = 1) {
    const def = UNITS[id];
    const lvlMult = side === 0 ? upgradeMult(this.perks.unitLevels[id as UnitId] ?? 1) : mult;
    const dmgMod = side === 1 ? this.level.mods?.enemyDmg ?? 1 : def.ranged ? passiveFx.eagle(this.perks.passives.eagle) : 1;
    const u: Unit = {
      uid: UID++, def, side,
      x: CASTLE_X[side] + (side === 0 ? 40 : -40),
      lane: (Math.random() - 0.5) * 26,
      hp: def.hp * lvlMult, maxHp: def.hp * lvlMult, dmg: def.dmg * lvlMult * dmgMod,
      cd: Math.random() * 0.5, anim: Math.random() * 10, moving: false, attacking: 0,
      chargeReady: !!def.charge, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0,
    };
    this.units.push(u);
    return u;
  }

  setMode(m: Mode) { this.mode = m; sfx('click'); }

  // ---------------- Commander abilities ----------------
  useAbility() {
    if (this.ability < 1) return false;
    this.ability = 0;
    this.abilityFx = 1.2;
    const enemies = this.units.filter((u) => u.side === 1 && !u.dead).sort((a, b) => a.x - b.x);
    const front = enemies.length ? enemies[0].x : W * 0.6;
    switch (this.perks.ability) {
      case 'volley':
        sfx('volley');
        for (let i = 0; i < 28; i++) {
          const x = front + 80 - 160 + Math.random() * 320;
          this.projectiles.push({ x: x - 200, y: -40 - Math.random() * 200, vx: 260, vy: 520, side: 0, dmg: 28, splash: 26, kind: 'arrow', life: 3 });
        }
        // Volley also clips flying enemies in the area.
        for (const e of enemies) if (e.def.flying && Math.abs(e.x - front - 80) < 180) this.applyDamage(e, 40);
        break;
      case 'warcry':
        sfx('volley');
        this.buff = 8;
        for (const u of this.playerArmy) this.texts.push({ x: u.x, y: GROUND - u.def.height - 20, text: '!', life: 0.8, color: '#ffd34d' });
        break;
      case 'oasis':
        sfx('coin');
        for (const u of this.playerArmy) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4); u.healFx = 1; }
        this.castleHp[0] = Math.min(this.castleMax[0], this.castleHp[0] + this.castleMax[0] * 0.1);
        break;
      case 'sandstorm':
        sfx('boom');
        this.debuff = 8;
        break;
      case 'meteor':
        sfx('boom');
        for (let i = 0; i < 3; i++) {
          const tx = (enemies[Math.floor(Math.random() * Math.max(1, enemies.length))]?.x ?? front) + (Math.random() - 0.5) * 60;
          this.projectiles.push({ x: tx - 260 - i * 40, y: -80 - i * 90, vx: 320, vy: 560, side: 0, dmg: 180, splash: 110, kind: 'meteor', life: 3 });
        }
        break;
    }
    return true;
  }

  takeControl() {
    if (this.controlled) { this.controlled = null; return; }
    const candidates = this.playerArmy.filter((u) => u.def.id !== 'miner' && !u.def.heal).sort((a, b) => b.x - a.x);
    this.controlled = candidates[0] ?? null;
    if (this.controlled) sfx('click');
  }

  revive() {
    this.revived = true;
    this.over = false;
    this.castleHp[0] = this.castleMax[0] * 0.5;
    for (const u of this.units) if (u.side === 1 && u.x < CASTLE_X[0] + 260) u.x = CASTLE_X[0] + 260 + Math.random() * 100;
  }

  update(dt: number) {
    if (this.over || this.paused) return;
    this.time += dt;
    const charge = ABILITIES[this.perks.ability].charge / passiveFx.wisdom(this.perks.passives.wisdom);
    this.ability = Math.min(1, this.ability + dt / charge);
    this.abilityFx = Math.max(0, this.abilityFx - dt);
    this.buff = Math.max(0, this.buff - dt);
    this.debuff = Math.max(0, this.debuff - dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.storm = this.level.region === 'dunes' ? 0.5 + 0.5 * Math.sin(this.time * 0.25) : 0;
    if (this.debuff > 0) this.storm = 1;

    if (this.level.mods?.noMiners) {
      this.passiveIncome += dt * 9 * this.goldMult;
      if (this.passiveIncome >= 9) { this.gold += 9; this.passiveIncome -= 9; }
    }

    if (this.queue.length) {
      const q = this.queue[0];
      q.left -= dt;
      if (q.left <= 0) {
        this.queue.shift();
        this.spawn(q.id, 0);
        this.producedCounts[q.id] = (this.producedCounts[q.id] ?? 0) + 1;
        this.ev.onUnitTrained(q.id);
      }
    }

    if (this.survival) this.runSurvival(dt);
    else this.runEnemyAI(dt);

    this.heroes = this.units.filter((u) => u.def.aura && !u.dead);
    for (const u of this.units) {
      if (u.dead) { u.dead += dt; continue; }
      u.cd -= dt;
      u.attacking = Math.max(0, u.attacking - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.healFx = Math.max(0, u.healFx - dt);
      u.moving = false;
      if (u.def.id === 'miner' && u !== this.controlled) this.updateMiner(u, dt);
      else if (u.def.heal) this.updateHealer(u, dt);
      else this.updateFighter(u, dt);
      if (u.moving) u.anim += dt * (u.def.speed / 9);
      else if (u.def.flying) u.anim += dt * 6; // wings keep flapping
    }

    this.updateProjectiles(dt);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 30 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.units = this.units.filter((u) => !u.dead || u.dead < 1.2);
    if (this.controlled?.dead) this.controlled = null;

    if (this.castleHp[1] <= 0) this.finish(true);
    else if (this.castleHp[0] <= 0) this.finish(false);
  }

  private finish(win: boolean) {
    this.over = true;
    this.shake = 1;
    sfx('collapse');
    const cx = CASTLE_X[win ? 1 : 0];
    for (let i = 0; i < 60; i++) this.dust(cx + (Math.random() - 0.5) * 120, GROUND - Math.random() * 140, '#b9925a', 4 + Math.random() * 6);
    this.ev.onEnd(win);
  }

  private spawnEnemy(unit: EnemyId, mult: number, offset: number) {
    const u = this.spawn(unit, 1, mult);
    u.x -= offset;
    return u;
  }

  private runSurvival(dt: number) {
    this.survivalNext -= dt;
    const alive = this.units.filter((u) => u.side === 1 && !u.dead).length;
    if (this.survivalNext <= 0 || (alive === 0 && this.survivalNext < 12)) {
      this.survivalWave++;
      this.survivalNext = 16;
      let i = 0;
      for (const g of survivalWave(this.survivalWave, Math.random)) for (let k = 0; k < g.count && alive + i < MAX_ARMY; k++) this.spawnEnemy(g.unit, g.mult, i++ * 24);
      this.gold += 20 + this.survivalWave * 5;
      this.ev.onWave?.(this.survivalWave);
    }
    this.enemyAlert = 0;
  }

  private runEnemyAI(dt: number) {
    const L = this.level;
    const t = this.time - this.loopCount * L.loopAfter;
    while (this.waveIdx < L.waves.length && L.waves[this.waveIdx].t <= t) {
      const w = L.waves[this.waveIdx++];
      if ((w.unit === 'boss' || UNITS[w.unit].boss) && this.loopCount > 0) continue; // bosses appear once
      const enemyCount = this.units.filter((u) => u.side === 1 && !u.dead).length;
      for (let i = 0; i < w.count && enemyCount + i < MAX_ARMY; i++) this.spawnEnemy(w.unit, L.enemyMult * (w.mult ?? 1) * (1 + this.loopCount * 0.25), i * 26);
    }
    if (this.waveIdx >= L.waves.length && t >= L.loopAfter) {
      this.loopCount++;
      this.waveIdx = 0;
    }

    // Reaction 1: defend when the player's army closes in.
    const front = Math.max(0, ...this.playerArmy.filter((u) => u.def.id !== 'miner').map((u) => u.x));
    this.enemyAlert = front > W - 700 ? 1 : 0;

    // Reaction 2: send counters to the unit type the player produces most.
    this.counterTimer -= dt;
    if (!L.noCounters && this.counterTimer <= 0 && L.index >= 4) {
      this.counterTimer = 30 - Math.min(14, L.index * 0.35);
      const entries = Object.entries(this.producedCounts).filter(([k]) => k !== 'miner') as [UnitId, number][];
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        const late = L.index >= 16;
        const counter: Partial<Record<UnitId, EnemyId>> = {
          sword: 'spear', archer: late ? 'camel' : 'bandit', spear: 'archer', camel: 'spear', catapult: late ? 'camel' : 'bandit',
          healer: 'bandit', falcon: 'archer', fire: 'archer', lion: 'spear', assassin: 'spear', giant: 'archer', genie: 'archer', hero: 'archer',
        };
        this.spawnEnemy(counter[entries[0][0]] ?? 'sword', L.enemyMult, 10);
      }
    }
  }

  /** Melee ground units can't reach flying units. */
  canHit(a: Unit, b: Unit) {
    return !b.def.flying || !!a.def.ranged || !!a.def.flying;
  }

  private nearestFoe(u: Unit, maxDist: number) {
    let best: Unit | null = null;
    let bd = maxDist;
    for (const o of this.units) {
      if (o.side === u.side || o.dead || !this.canHit(u, o)) continue;
      const d = Math.abs(o.x - u.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private updateMiner(u: Unit, dt: number) {
    const mx = MINE_X[0] + ((u.uid * 37) % 60) - 30;
    if (Math.abs(u.x - mx) > 4) {
      u.x += Math.sign(mx - u.x) * u.def.speed * dt;
      u.moving = true;
    } else {
      u.mineTimer += dt * this.goldMult;
      if (u.mineTimer >= MINER_INTERVAL) {
        u.mineTimer -= MINER_INTERVAL;
        this.gold += MINER_GOLD;
        this.texts.push({ x: u.x, y: GROUND - 60 + u.lane, text: `+${MINER_GOLD}`, life: 0.9, color: '#ffd34d' });
      }
      if (u.mineTimer % 1 < dt) u.attacking = 0.35;
    }
  }

  private updateHealer(u: Unit, dt: number) {
    if (u.cd <= 0) {
      let best: Unit | null = null;
      let worst = 0.98;
      for (const o of this.units) {
        if (o.side !== u.side || o.dead || o === u || Math.abs(o.x - u.x) > u.def.range) continue;
        const r = o.hp / o.maxHp;
        if (r < worst) { worst = r; best = o; }
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + u.def.heal! * upgradeMult(this.perks.unitLevels[u.def.id as UnitId] ?? 1));
        best.healFx = 0.6;
        u.attacking = 0.3;
        u.cd = u.def.cooldown;
      }
    }
    // Stay behind the front line.
    const allies = this.playerArmy.filter((o) => o !== u && o.def.id !== 'miner' && !o.def.heal);
    const front = allies.length ? Math.max(...allies.map((o) => o.x)) : this.formationX(u);
    const target = Math.max(CASTLE_X[0] + 60, Math.min(front - 70, this.mode === 'attack' ? W : this.formationX(u)));
    if (Math.abs(target - u.x) > 8) { u.x += Math.sign(target - u.x) * u.def.speed * dt; u.moving = true; }
  }

  private formationX(u: Unit): number {
    const ranged = u.def.ranged || u.def.heal;
    const idx = u.uid % 5;
    switch (this.mode) {
      case 'defend': return CASTLE_X[0] + 220 - (ranged ? 70 : 0) - idx * 8;
      case 'hold': return W / 2 - 80 - (ranged ? 90 : 0) - idx * 10;
      case 'attack': return W;
    }
  }

  private speedOf(u: Unit) {
    let s = u.def.speed;
    if (u.side === 1) {
      s *= this.level.mods?.enemySpeed ?? 1;
      if (this.level.region === 'shadow') s *= 1.05;
      if (this.debuff > 0) s *= 0.5;
    } else if (this.buff > 0) s *= 1.4;
    return s;
  }

  private rangeOf(u: Unit) {
    return u.side === 0 && u.def.ranged ? u.def.range * passiveFx.eagle(this.perks.passives.eagle) : u.def.range;
  }

  private updateFighter(u: Unit, dt: number) {
    const dir = u.side === 0 ? 1 : -1;
    const def = u.def;
    const range = this.rangeOf(u);
    const isCtrl = u === this.controlled;
    const dmgMult = isCtrl ? CONTROL_BONUS : 1;
    const enemyCastle = CASTLE_X[u.side === 0 ? 1 : 0];

    if (isCtrl) {
      if (this.ctrlDir) {
        u.x = Math.max(CASTLE_X[0], Math.min(CASTLE_X[1], u.x + this.ctrlDir * this.speedOf(u) * 1.15 * dt));
        u.moving = true;
      }
      if (this.ctrlAttack && u.cd <= 0) {
        const foe = this.nearestFoe(u, range + 8);
        u.attacking = 0.3;
        u.cd = def.cooldown * 0.85;
        if (def.ranged) this.shoot(u, foe, foe ? foe.x : u.x + range * dir, dmgMult);
        else if (foe) this.hit(u, foe, dmgMult);
        else if (Math.abs(enemyCastle - u.x) < range + 50) this.hitCastle(u, u.side === 0 ? 1 : 0, dmgMult);
        else sfx('swing');
      }
      return;
    }

    const aggro = range + (u.side === 0 && this.mode === 'defend' ? 200 : 140);
    const foe = this.nearestFoe(u, aggro);
    if (foe) {
      const d = Math.abs(foe.x - u.x);
      if (d <= range) {
        if (u.cd <= 0) {
          u.attacking = 0.3;
          u.cd = def.cooldown;
          if (def.ranged) this.shoot(u, foe, foe.x, dmgMult);
          else this.hit(u, foe, dmgMult);
        }
      } else {
        u.x += Math.sign(foe.x - u.x) * this.speedOf(u) * dt;
        u.moving = true;
      }
      return;
    }

    const castleDist = Math.abs(enemyCastle - u.x);
    const attackingNow = u.side === 1 || this.mode === 'attack';
    if (castleDist <= range + 50 && attackingNow) {
      if (u.cd <= 0) {
        u.attacking = 0.3;
        u.cd = def.cooldown;
        if (def.ranged) this.shoot(u, null, enemyCastle, dmgMult);
        else this.hitCastle(u, u.side === 0 ? 1 : 0, dmgMult);
      }
      return;
    }

    let target: number;
    if (u.side === 0) target = this.formationX(u);
    else target = this.enemyAlert ? W - 330 - (def.ranged ? -60 : 0) : CASTLE_X[0];
    target = Math.max(CASTLE_X[0] + 40, Math.min(CASTLE_X[1] - 40, target));
    if (Math.abs(target - u.x) > 6) {
      u.x += Math.sign(target - u.x) * this.speedOf(u) * dt;
      u.moving = true;
    }
  }

  /** Every outgoing-damage modifier in one place. */
  private outMult(u: Unit, target?: UnitDef) {
    let m = target && u.def.bonusVs?.includes(target.id) ? COUNTER_BONUS : 1;
    if (u.side === 0 && this.buff > 0) m *= 1.25;
    if (u.side === 1 && this.debuff > 0) m *= 0.7;
    for (const h of this.heroes) if (h.side === u.side && h !== u && Math.abs(h.x - u.x) < 140) { m *= 1 + h.def.aura!; break; }
    return m;
  }

  private hit(u: Unit, foe: Unit, mult: number) {
    let dmg = u.dmg * mult * this.outMult(u, foe.def);
    if (u.chargeReady && u.def.charge) { dmg *= 2; u.chargeReady = false; }
    if (u.def.crit && Math.random() < u.def.crit) {
      dmg *= 2.5;
      this.texts.push({ x: foe.x, y: GROUND - foe.def.height - 10, text: '✦', life: 0.6, color: '#ff6b3d' });
    }
    if (u.def.splash) {
      for (const o of this.units) if (o.side !== u.side && !o.dead && this.canHit(u, o) && Math.abs(o.x - foe.x) < u.def.splash) this.applyDamage(o, o === foe ? dmg : dmg * 0.5, o !== foe);
    } else this.applyDamage(foe, dmg);
    sfx('hit');
    this.dust(foe.x, this.unitY(foe) - foe.def.height * 0.6, '#f3e3b8', 4);
  }

  unitY(u: Unit) {
    return GROUND + u.lane - (u.def.flying ? FLY_HEIGHT + Math.sin(u.anim * 0.6) * 8 : 0);
  }

  private hitCastle(u: Unit, side: Side, mult: number) {
    if (!isFinite(this.castleHp[side])) return;
    const dmg = u.dmg * mult * this.outMult(u) * (u.def.id === 'catapult' ? 2 : 1);
    this.castleHp[side] = Math.max(0, this.castleHp[side] - dmg);
    this.shake = Math.min(0.4, this.shake + 0.05);
    sfx('hit');
    this.dust(CASTLE_X[side] + (side === 0 ? 50 : -50), GROUND - 40 - Math.random() * 80, '#b9925a', 5);
  }

  private shoot(u: Unit, foe: Unit | null, tx: number, mult: number) {
    const y0 = this.unitY(u) - u.def.height * 0.8;
    const kind: Projectile['kind'] = u.def.id === 'catapult' ? 'rock' : u.def.id === 'fire' ? 'fire'
      : ['sandmage', 'boss', 'djinn', 'genie'].includes(u.def.id) ? 'magic' : 'arrow';
    const dmg = u.dmg * mult * this.outMult(u);
    if (foe && (foe.def.flying || u.def.flying)) {
      // Homing straight shot.
      this.projectiles.push({ x: u.x, y: y0, vx: 0, vy: 0, side: u.side, dmg, splash: u.def.splash ?? 0, kind, bonusVs: u.def.bonusVs, life: 3, target: foe });
    } else {
      const dx = tx - u.x;
      const flight = Math.max(0.35, Math.abs(dx) / 520);
      this.projectiles.push({
        x: u.x, y: y0, vx: dx / flight, vy: (GROUND - 20 - y0) / flight - 0.5 * 600 * flight,
        side: u.side, dmg, splash: u.def.splash ?? 0, kind, bonusVs: u.def.bonusVs, life: flight + 0.6,
      });
    }
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private impact(p: Projectile, x: number, primary?: Unit) {
    const foeSide: Side = p.side === 0 ? 1 : 0;
    const radius = p.splash || 18;
    let hitAny = false;
    if (primary && !primary.dead) {
      this.applyDamage(primary, p.dmg * (p.bonusVs?.includes(primary.def.id) ? COUNTER_BONUS : 1));
      hitAny = true;
    }
    if (!primary || p.splash) {
      for (const o of this.units) {
        if (o.side !== foeSide || o.dead || o === primary) continue;
        // Ground-landing shots only hit ground units; homing splash hits around the target.
        if (!primary && o.def.flying && p.kind !== 'meteor') continue;
        if (Math.abs(o.x - x) < radius) {
          const m = p.bonusVs?.includes(o.def.id) ? COUNTER_BONUS : 1;
          this.applyDamage(o, p.dmg * m * (p.splash && hitAny ? 0.5 : 1), p.splash > 0 && hitAny);
          hitAny = true;
          if (!p.splash) break;
        }
      }
    }
    if (!primary && Math.abs(CASTLE_X[foeSide] - x) < 70 && isFinite(this.castleHp[foeSide])) {
      this.castleHp[foeSide] = Math.max(0, this.castleHp[foeSide] - p.dmg * (p.kind === 'rock' ? 2 : p.kind === 'meteor' ? 1.2 : 0.6));
      hitAny = true;
    }
    const color = p.kind === 'magic' ? '#c77dff' : p.kind === 'fire' || p.kind === 'meteor' ? '#ff8a3d' : '#e8cf96';
    if (p.kind !== 'arrow' || hitAny) for (let i = 0; i < (p.kind === 'rock' || p.kind === 'meteor' ? 14 : 3); i++) this.dust(x, (primary ? p.y : GROUND - 8), color, 3 + Math.random() * 5);
    if (p.kind === 'rock' || p.kind === 'meteor') { this.shake = Math.min(0.6, this.shake + 0.2); sfx('boom'); }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.target) {
        const t = p.target;
        const ty = this.unitY(t) - t.def.height * 0.5;
        const dx = t.x - p.x, dy = ty - p.y;
        const d = Math.hypot(dx, dy);
        const sp = 560 * dt;
        if (t.dead || d < sp + 6) { p.life = 0; this.impact(p, t.x, t.dead ? undefined : t); continue; }
        p.vx = (dx / d) * 560; p.vy = (dy / d) * 560;
        p.x += (dx / d) * sp; p.y += (dy / d) * sp;
        continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
      if (p.y >= GROUND - 10 || p.life <= 0) { p.life = 0; this.impact(p, p.x); }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private applyDamage(o: Unit, dmg: number, isSplash = false) {
    if (o.def.dodge && !isSplash && Math.random() < o.def.dodge) {
      this.texts.push({ x: o.x, y: this.unitY(o) - o.def.height - 8, text: '~', life: 0.5, color: '#fff' });
      return;
    }
    o.hp -= dmg;
    o.hitFlash = 0.12;
    if (o.hp <= 0 && !o.dead) {
      o.dead = 0.001;
      if (o.side === 1) {
        const bounty = Math.round((o.def.boss ? 200 : 8 + o.def.hp / 25) * (this.level.mods?.goldMult ?? 1));
        this.gold += bounty;
        this.texts.push({ x: o.x, y: GROUND - 70, text: `+${bounty}`, life: 1, color: '#ffd34d' });
      }
      for (let i = 0; i < 8; i++) this.dust(o.x, this.unitY(o) - o.def.height * 0.5, o.def.id === 'ghost' || o.def.id === 'djinn' ? '#9fd8ff' : '#f0dcae', 3 + Math.random() * 4);
    }
  }

  dust(x: number, y: number, color: string, size: number) {
    if (this.particles.length > 260) return;
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 160, life: 0.6 + Math.random() * 0.4, max: 1, color, size });
  }

  stars(win: boolean) {
    if (!win) return 0;
    let s = 1;
    if (this.castleHp[0] / this.castleMax[0] > 0.5) s++;
    if (this.time < 180) s++;
    return s;
  }
}

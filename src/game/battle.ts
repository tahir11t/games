import { UNITS, MINER_GOLD, MINER_INTERVAL, MAX_MINERS, MAX_ARMY, CONTROL_BONUS, COUNTER_BONUS, upgradeMult, type EnemyId, type UnitId, type UnitDef } from '../data/units';
import type { LevelDef } from '../data/levels';
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
  defending: boolean; // enemy AI flag
  dead: number; // >0 while playing death anim
  hitFlash: number;
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  side: Side; dmg: number; splash: number; kind: 'arrow' | 'rock' | 'magic';
  bonusVs?: EnemyId[]; life: number;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
export interface FloatText { x: number; y: number; text: string; life: number; color: string; }

export interface QueueItem { id: UnitId; left: number; }

export interface BattleEvents {
  onEnd(win: boolean): void;
  onUnitTrained(id: UnitId): void;
}

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
  controlled: Unit | null = null;
  ctrlDir = 0; // -1, 0, 1
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

  constructor(public level: LevelDef, public unitLevels: Record<UnitId, number>, startGold: number, private ev: BattleEvents) {
    this.castleMax = [1500, level.castleHp];
    this.castleHp = [1500, level.castleHp];
    this.gold = startGold;
    this.spawn('miner', 0);
    this.spawn('miner', 0);
    this.units[0].x += 20;
  }

  get playerArmy() { return this.units.filter((u) => u.side === 0 && !u.dead); }
  minerCount() { return this.units.filter((u) => u.side === 0 && !u.dead && u.def.id === 'miner').length + this.queue.filter((q) => q.id === 'miner').length; }
  armyCount() { return this.playerArmy.length + this.queue.length; }

  canTrain(id: UnitId) {
    const d = UNITS[id];
    if (this.gold < d.cost) return false;
    if (id === 'miner' && this.minerCount() >= MAX_MINERS) return false;
    if (this.armyCount() >= MAX_ARMY) return false;
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
    const lvlMult = side === 0 ? upgradeMult(this.unitLevels[id as UnitId] ?? 1) : mult;
    const u: Unit = {
      uid: UID++, def, side,
      x: CASTLE_X[side] + (side === 0 ? 40 : -40),
      lane: (Math.random() - 0.5) * 26,
      hp: def.hp * lvlMult, maxHp: def.hp * lvlMult, dmg: def.dmg * lvlMult,
      cd: Math.random() * 0.5, anim: Math.random() * 10, moving: false, attacking: 0,
      chargeReady: !!def.charge, mineTimer: 0, defending: false, dead: 0, hitFlash: 0,
    };
    this.units.push(u);
    return u;
  }

  setMode(m: Mode) { this.mode = m; sfx('click'); }

  useAbility() {
    if (this.ability < 1) return false;
    this.ability = 0;
    this.abilityFx = 1.2;
    sfx('volley');
    // Arrow volley: rain on the enemy group closest to your castle.
    const enemies = this.units.filter((u) => u.side === 1 && !u.dead).sort((a, b) => a.x - b.x);
    const cx = enemies.length ? enemies[0].x + 80 : W * 0.6;
    for (let i = 0; i < 28; i++) {
      const x = cx - 160 + Math.random() * 320;
      this.projectiles.push({ x: x - 200, y: -40 - Math.random() * 200, vx: 260, vy: 520, side: 0, dmg: 28, splash: 26, kind: 'arrow', life: 3 });
    }
    return true;
  }

  takeControl() {
    if (this.controlled) { this.controlled = null; return; }
    const candidates = this.playerArmy.filter((u) => u.def.id !== 'miner').sort((a, b) => b.x - a.x);
    this.controlled = candidates[0] ?? null;
    if (this.controlled) sfx('click');
  }

  revive() {
    this.revived = true;
    this.over = false;
    this.castleHp[0] = this.castleMax[0] * 0.5;
    // Push back nearby enemies so the revive is meaningful.
    for (const u of this.units) if (u.side === 1 && u.x < CASTLE_X[0] + 260) u.x = CASTLE_X[0] + 260 + Math.random() * 100;
  }

  update(dt: number) {
    if (this.over || this.paused) return;
    this.time += dt;
    this.ability = Math.min(1, this.ability + dt / 28);
    this.abilityFx = Math.max(0, this.abilityFx - dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.level.region === 'dunes') this.storm = 0.5 + 0.5 * Math.sin(this.time * 0.25);

    // Production queue (one at a time, PRD: each unit has train time).
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

    this.runEnemyAI(dt);

    for (const u of this.units) {
      if (u.dead) { u.dead += dt; continue; }
      u.cd -= dt;
      u.attacking = Math.max(0, u.attacking - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.moving = false;
      if (u.def.id === 'miner' && u !== this.controlled) this.updateMiner(u, dt);
      else this.updateFighter(u, dt);
      if (u.moving) u.anim += dt * (u.def.speed / 9);
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

  private runEnemyAI(dt: number) {
    const L = this.level;
    // Scripted waves, looping with escalation so long stalls get harder.
    const t = this.time - this.loopCount * L.loopAfter;
    while (this.waveIdx < L.waves.length && L.waves[this.waveIdx].t <= t) {
      const w = L.waves[this.waveIdx++];
      if (w.unit === 'boss' && this.loopCount > 0) continue; // boss appears once
      const enemyCount = this.units.filter((u) => u.side === 1 && !u.dead).length;
      for (let i = 0; i < w.count && enemyCount + i < MAX_ARMY; i++) {
        const u = this.spawn(w.unit, 1, L.enemyMult * (1 + this.loopCount * 0.25));
        u.x -= i * 26;
      }
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
    if (this.counterTimer <= 0 && L.index >= 4) {
      this.counterTimer = 30 - Math.min(14, L.index * 0.35);
      const entries = Object.entries(this.producedCounts).filter(([k]) => k !== 'miner') as [UnitId, number][];
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        const top = entries[0][0];
        const counter: Record<UnitId, EnemyId> = { miner: 'sword', sword: 'spear', archer: L.index >= 16 ? 'camel' : 'bandit', spear: 'archer', camel: 'spear', catapult: L.index >= 16 ? 'camel' : 'bandit' };
        const u = this.spawn(counter[top], 1, L.enemyMult);
        u.x -= 10;
      }
    }
  }

  private nearestFoe(u: Unit, maxDist: number) {
    let best: Unit | null = null;
    let bd = maxDist;
    for (const o of this.units) {
      if (o.side === u.side || o.dead) continue;
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
      u.mineTimer += dt;
      if (u.mineTimer >= MINER_INTERVAL) {
        u.mineTimer -= MINER_INTERVAL;
        this.gold += MINER_GOLD;
        this.texts.push({ x: u.x, y: GROUND - 60 + u.lane, text: `+${MINER_GOLD}`, life: 0.9, color: '#ffd34d' });
      }
      if (u.mineTimer % 1 < dt) u.attacking = 0.35; // pickaxe swing
    }
  }

  private formationX(u: Unit): number {
    const ranged = u.def.ranged;
    const idx = u.uid % 5;
    switch (this.mode) {
      case 'defend': return CASTLE_X[0] + 220 - (ranged ? 70 : 0) - idx * 8;
      case 'hold': return W / 2 - 80 - (ranged ? 90 : 0) - idx * 10;
      case 'attack': return W; // march
    }
  }

  private updateFighter(u: Unit, dt: number) {
    const dir = u.side === 0 ? 1 : -1;
    const def = u.def;
    const isCtrl = u === this.controlled;
    const dmgMult = isCtrl ? CONTROL_BONUS : 1;
    const enemyCastle = CASTLE_X[u.side === 0 ? 1 : 0];

    if (isCtrl) {
      if (this.ctrlDir) {
        u.x = Math.max(CASTLE_X[0], Math.min(CASTLE_X[1], u.x + this.ctrlDir * def.speed * 1.15 * dt));
        u.moving = true;
      }
      if (this.ctrlAttack && u.cd <= 0) {
        const foe = this.nearestFoe(u, def.range + 8);
        u.attacking = 0.3;
        u.cd = def.cooldown * 0.85;
        if (def.ranged) this.shoot(u, foe ? foe.x : u.x + def.range * dir, dmgMult);
        else if (foe) this.hit(u, foe, dmgMult);
        else if (Math.abs(enemyCastle - u.x) < def.range + 50) this.hitCastle(u, u.side === 0 ? 1 : 0, dmgMult);
        else sfx('swing');
      }
      return;
    }

    const aggro = def.range + (u.side === 0 && this.mode === 'defend' ? 200 : 140);
    const foe = this.nearestFoe(u, aggro);
    if (foe) {
      const d = Math.abs(foe.x - u.x);
      if (d <= def.range) {
        if (u.cd <= 0) {
          u.attacking = 0.3;
          u.cd = def.cooldown;
          if (def.ranged) this.shoot(u, foe.x, dmgMult);
          else this.hit(u, foe, dmgMult);
        }
      } else {
        u.x += Math.sign(foe.x - u.x) * def.speed * dt;
        u.moving = true;
      }
      return;
    }

    // No foe nearby: castle in range?
    const castleDist = Math.abs(enemyCastle - u.x);
    const attackingNow = u.side === 1 || this.mode === 'attack';
    if (castleDist <= def.range + 50 && attackingNow) {
      if (u.cd <= 0) {
        u.attacking = 0.3;
        u.cd = def.cooldown;
        if (def.ranged) this.shoot(u, enemyCastle, dmgMult);
        else this.hitCastle(u, u.side === 0 ? 1 : 0, dmgMult);
      }
      return;
    }

    // Move to target position.
    let target: number;
    if (u.side === 0) target = this.formationX(u);
    else target = this.enemyAlert ? W - 330 - (def.ranged ? -60 : 0) : CASTLE_X[0];
    target = Math.max(CASTLE_X[0] + 40, Math.min(CASTLE_X[1] - 40, target));
    if (Math.abs(target - u.x) > 6) {
      const spd = def.speed * (u.side === 1 && this.level.region === 'shadow' ? 1.05 : 1);
      u.x += Math.sign(target - u.x) * spd * dt;
      u.moving = true;
    }
  }

  private damageMult(attacker: UnitDef, target: UnitDef) {
    return attacker.bonusVs?.includes(target.id) ? COUNTER_BONUS : 1;
  }

  private hit(u: Unit, foe: Unit, mult: number) {
    let dmg = u.dmg * mult * this.damageMult(u.def, foe.def);
    if (u.chargeReady && u.def.charge) { dmg *= 2; u.chargeReady = false; }
    if (u.def.splash) {
      // Primary target takes full damage, others in the splash radius take half.
      for (const o of this.units) if (o.side !== u.side && !o.dead && Math.abs(o.x - foe.x) < u.def.splash) this.applyDamage(o, o === foe ? dmg : dmg * 0.5);
    } else this.applyDamage(foe, dmg);
    sfx('hit');
    this.dust(foe.x, GROUND - foe.def.height * 0.6 + foe.lane, '#e9d7a8', 4);
  }

  private hitCastle(u: Unit, side: Side, mult: number) {
    const dmg = u.dmg * mult * (u.def.id === 'catapult' ? 2 : 1);
    this.castleHp[side] = Math.max(0, this.castleHp[side] - dmg);
    this.shake = Math.min(0.4, this.shake + 0.05);
    sfx('hit');
    this.dust(CASTLE_X[side] + (side === 0 ? 50 : -50), GROUND - 40 - Math.random() * 80, '#b9925a', 5);
  }

  private shoot(u: Unit, tx: number, mult: number) {
    const y0 = GROUND - u.def.height + u.lane;
    const dx = tx - u.x;
    const flight = Math.max(0.35, Math.abs(dx) / 520);
    const kind = u.def.id === 'catapult' ? 'rock' : u.def.id === 'sandmage' || u.def.id === 'boss' ? 'magic' : 'arrow';
    this.projectiles.push({
      x: u.x, y: y0, vx: dx / flight, vy: (GROUND - 20 - y0) / flight - 0.5 * 600 * flight,
      side: u.side, dmg: u.dmg * mult, splash: u.def.splash ?? 0, kind, bonusVs: u.def.bonusVs, life: flight + 0.6,
    });
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt;
      if (p.y >= GROUND - 10 || p.life <= 0) {
        p.life = 0;
        const foeSide: Side = p.side === 0 ? 1 : 0;
        const radius = p.splash || 18;
        let hitAny = false;
        for (const o of this.units) {
          if (o.side !== foeSide || o.dead) continue;
          if (Math.abs(o.x - p.x) < radius) {
            const m = p.bonusVs?.includes(o.def.id) ? COUNTER_BONUS : 1;
            this.applyDamage(o, p.dmg * m * (p.splash && hitAny ? 0.5 : 1));
            hitAny = true;
            if (!p.splash) break;
          }
        }
        if (Math.abs(CASTLE_X[foeSide] - p.x) < 70) {
          this.castleHp[foeSide] = Math.max(0, this.castleHp[foeSide] - p.dmg * (p.kind === 'rock' ? 2 : 0.6));
          hitAny = true;
        }
        if (p.kind !== 'arrow' || hitAny) for (let i = 0; i < (p.kind === 'rock' ? 10 : 3); i++) this.dust(p.x, GROUND - 8, p.kind === 'magic' ? '#c77dff' : '#d8b878', 3 + Math.random() * 4);
        if (p.kind === 'rock') { this.shake = Math.min(0.5, this.shake + 0.15); sfx('boom'); }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private applyDamage(o: Unit, dmg: number) {
    o.hp -= dmg;
    o.hitFlash = 0.12;
    if (o.hp <= 0 && !o.dead) {
      o.dead = 0.001;
      if (o.side === 1) {
        const bounty = o.def.id === 'boss' ? 200 : Math.round(8 + o.def.hp / 25);
        this.gold += bounty;
        this.texts.push({ x: o.x, y: GROUND - 70, text: `+${bounty}`, life: 1, color: '#ffd34d' });
      }
      for (let i = 0; i < 8; i++) this.dust(o.x, GROUND - o.def.height * 0.5 + o.lane, o.def.id === 'ghost' ? '#9fd8ff' : '#d9c69a', 3 + Math.random() * 4);
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

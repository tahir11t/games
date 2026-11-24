import { UNITS, MINER_GOLD, MINER_INTERVAL, MAX_MINERS, MAX_ARMY, CONTROL_BONUS, COUNTER_BONUS, FLY_HEIGHT, MAX_RANK, upgradeMult, type EnemyId, type UnitId, type UnitDef } from '../data/units';
import { costOf, type LevelDef } from '../data/levels';
import { ABILITIES, passiveFx, type Perks } from '../data/skills';
import { survivalWave } from '../data/challenges';
import { sfx } from './audio';

export const W = 2400;
export const H = 540;
export const GROUND = 385;
export const CASTLE_X = [130, W - 130];
export const MINE_X = [340, W - 340];
export const TOWER_RANGE = 360;

export type Mode = 'defend' | 'hold' | 'attack';
export type Side = 0 | 1;
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Difficulty scales enemy stats, enemy economy, fort archers and how smart the enemy commander is. */
export const DIFFICULTY: Record<Difficulty, { stat: number; income: number; ai: 1 | 2 | 3; tower: number; reward: number }> = {
  easy: { stat: 0.82, income: 0.78, ai: 1, tower: 0.7, reward: 0.8 },
  medium: { stat: 1, income: 1, ai: 2, tower: 1, reward: 1 },
  hard: { stat: 1.05, income: 0.85, ai: 3, tower: 1.25, reward: 1.5 },
};

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
  calm: number; // seconds since last attack (re-arms charges)
  mineTimer: number;
  dead: number; // >0 while playing death anim
  hitFlash: number;
  healFx: number;
  kills: number;
  rank: number; // veteran rank 0..MAX_RANK
  raid: boolean; // enemy raider: hunts miners
  lastDx: number; // movement last frame (for queueing)
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  sx: number; sy: number; tx: number; ty: number; t: number; T: number; arc: number;
  side: Side; dmg: number; splash: number; kind: 'arrow' | 'bolt' | 'rock' | 'magic' | 'fire' | 'meteor';
  bonusVs?: EnemyId[];
  target?: Unit; // guided: follows the target so moving units are still hit
  castle?: Side; // aimed at a fort
  src?: Unit;
  air: boolean; // can hit flying units on a ground impact
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
export interface FloatText { x: number; y: number; text: string; life: number; color: string; size?: number; }
export interface QueueItem { id: EnemyId; left: number; }

export interface BattleStats { trained: number; kills: number; lost: number; mined: number; damage: Partial<Record<UnitId, number>>; enemyMinersKilled: number; }

export interface BattleEvents {
  onEnd(win: boolean): void;
  onUnitTrained(id: UnitId): void;
  onWave?(n: number): void;
  onRank?(u: Unit): void;
}

const DEFAULT_PERKS: Perks & { difficulty: Difficulty } = {
  unitLevels: Object.fromEntries(Object.keys(UNITS).map((k) => [k, 1])) as Record<UnitId, number>,
  ability: 'volley',
  passives: { mining: 0, walls: 0, treasury: 0, eagle: 0, wisdom: 0, towers: 0 },
  difficulty: 'medium',
};

let UID = 1;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class Battle {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  castleHp: [number, number];
  castleMax: [number, number];
  gold: number; // player
  egold = 0; // enemy commander
  queue: QueueItem[] = [];
  equeue: QueueItem[] = [];
  mode: Mode = 'defend';
  emode: Mode = 'defend';
  ability = 0;
  eability = 0;
  abilityFx = 0;
  buff = 0;
  debuff = 0;
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
  towerCd: [number, number] = [1, 2];
  towerShot: [number, number] = [0, 0]; // anim timers
  stats: BattleStats = { trained: 0, kills: 0, lost: 0, mined: 0, damage: {}, enemyMinersKilled: 0 };
  private survivalNext = 8;
  private passiveIncome = 0;
  private auras: Unit[] = [];
  private aiThink = 0;
  private aiAttackSize = 5;
  readonly perks: Perks & { difficulty: Difficulty };
  readonly allowed: UnitId[] | null;
  readonly diff: (typeof DIFFICULTY)[Difficulty];

  constructor(public level: LevelDef, perks: Partial<Perks & { difficulty: Difficulty }> | Record<UnitId, number>, startGold: number, private ev: BattleEvents) {
    const p = 'unitLevels' in perks ? (perks as Partial<Perks & { difficulty: Difficulty }>) : { unitLevels: perks as Record<UnitId, number> };
    this.perks = { ...DEFAULT_PERKS, ...p, unitLevels: { ...DEFAULT_PERKS.unitLevels, ...p.unitLevels }, passives: { ...DEFAULT_PERKS.passives, ...p.passives } };
    this.diff = DIFFICULTY[this.perks.difficulty];
    this.allowed = level.allowed ?? null;
    const fort = 1500 * passiveFx.walls(this.perks.passives.walls);
    this.castleMax = [fort, level.castleHp];
    this.castleHp = [fort, level.castleHp];
    this.gold = Math.max(startGold, level.startGold ?? 0) + passiveFx.treasury(this.perks.passives.treasury);
    if (!level.mods?.noMiners) {
      this.spawn('miner', 0);
      this.spawn('miner', 0).x += 20;
    }
    if (level.ai) {
      this.egold = level.ai.startGold;
      this.spawn('miner', 1);
      this.spawn('miner', 1).x -= 20;
      this.aiAttackSize = 4 + Math.floor(Math.random() * 3);
    }
  }

  get survival() { return this.level.kind === 'survival'; }
  get playerArmy() { return this.units.filter((u) => u.side === 0 && !u.dead); }
  get enemyStat() { return this.level.enemyMult * this.diff.stat; }
  goldMult(side: Side) {
    return side === 0 ? (this.level.mods?.goldMult ?? 1) * passiveFx.mining(this.perks.passives.mining) : (this.level.ai?.income ?? 1) * this.diff.income;
  }
  minerCount(side: Side = 0) {
    const q = side === 0 ? this.queue : this.equeue;
    return this.units.filter((u) => u.side === side && !u.dead && u.def.id === 'miner').length + q.filter((x) => x.id === 'miner').length;
  }
  armyCount(side: Side = 0) { return this.units.filter((u) => u.side === side && !u.dead).length + (side === 0 ? this.queue : this.equeue).length; }

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
      lane: (Math.random() - 0.5) * 30,
      hp: def.hp * lvlMult, maxHp: def.hp * lvlMult, dmg: def.dmg * lvlMult * dmgMod,
      cd: Math.random() * 0.5, anim: Math.random() * 10, moving: false, attacking: 0,
      chargeReady: !!def.charge, calm: 0, mineTimer: Math.random() * 2, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0,
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
        for (let i = 0; i < 28; i++) this.rain(front + 80 - 160 + Math.random() * 320, 28, 26, 'arrow', i * 0.03);
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
          this.rain(tx, 180, 110, 'meteor', i * 0.25);
        }
        break;
      case 'reinforce':
        sfx('volley');
        for (let i = 0; i < 4; i++) { const u = this.spawn(i < 3 ? 'sword' : 'spear', 0); u.x += i * 14; u.rank = 1; u.dmg *= 1.15; u.maxHp *= 1.15; u.hp = u.maxHp; }
        break;
      case 'inferno':
        sfx('boom');
        for (let i = 0; i < 16; i++) this.rain(front - 60 + i * 26 + Math.random() * 20, 55, 42, 'fire', i * 0.08);
        break;
    }
    return true;
  }

  /** A projectile falling from the sky onto x. */
  private rain(x: number, dmg: number, splash: number, kind: Projectile['kind'], delay = 0) {
    const sx = x - 220, sy = -60 - Math.random() * 120;
    this.projectiles.push({ x: sx, y: sy, vx: 0, vy: 0, sx, sy, tx: x, ty: GROUND - 8, t: -delay, T: 0.75, arc: -20, side: 0, dmg, splash, kind, air: true });
  }

  takeControl() {
    if (this.controlled) { this.controlled = null; return; }
    const candidates = this.playerArmy.filter((u) => u.def.id !== 'miner' && !u.def.heal && !u.def.support).sort((a, b) => b.x - a.x);
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
      this.passiveIncome += dt * 9 * this.goldMult(0);
      if (this.passiveIncome >= 9) { this.gold += 9; this.passiveIncome -= 9; }
    }

    this.runQueue(0, dt);
    this.runQueue(1, dt);

    if (this.survival) this.runSurvival(dt);
    else this.runScript(dt);
    if (this.level.ai) this.runCommander(dt);

    this.auras = this.units.filter((u) => u.def.aura && !u.dead);
    for (const u of this.units) {
      if (u.dead) { u.dead += dt; continue; }
      u.cd -= dt;
      u.calm += dt;
      if (u.def.charge && u.calm > 2.5) u.chargeReady = true;
      u.attacking = Math.max(0, u.attacking - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.healFx = Math.max(0, u.healFx - dt);
      u.moving = false;
      this.stepDt = dt;
      const x0 = u.x;
      if (u.def.id === 'miner' && u !== this.controlled) this.updateMiner(u, dt);
      else if (u.def.heal || u.def.support) this.updateSupport(u, dt);
      else this.updateFighter(u, dt);
      u.lastDx = u.x - x0;
      if (u.moving) u.anim += dt * (u.def.speed / 9);
      else if (u.def.flying) u.anim += dt * 6;
    }
    this.updateTowers(dt);
    this.updateProjectiles(dt);

    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 30 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.units = this.units.filter((u) => !u.dead || u.dead < 1.2);
    if (this.controlled?.dead) this.controlled = null;

    if (this.level.winAfter && this.time >= this.level.winAfter && this.castleHp[0] > 0) this.finish(true);
    else if (this.castleHp[1] <= 0) this.finish(true);
    else if (this.castleHp[0] <= 0) this.finish(false);
  }

  private runQueue(side: Side, dt: number) {
    const q = side === 0 ? this.queue : this.equeue;
    if (!q.length) return;
    q[0].left -= dt;
    if (q[0].left > 0) return;
    const item = q.shift()!;
    if (side === 0) {
      this.spawn(item.id, 0);
      const id = item.id as UnitId;
      this.producedCounts[id] = (this.producedCounts[id] ?? 0) + 1;
      this.stats.trained++;
      this.ev.onUnitTrained(id);
    } else {
      this.spawn(item.id, 1, this.enemyStat);
    }
  }

  private finish(win: boolean) {
    this.over = true;
    this.shake = 1;
    sfx('collapse');
    const cx = CASTLE_X[win ? 1 : 0];
    if (isFinite(this.castleHp[win ? 1 : 0])) for (let i = 0; i < 60; i++) this.dust(cx + (Math.random() - 0.5) * 120, GROUND - Math.random() * 140, '#b9925a', 4 + Math.random() * 6);
    this.ev.onEnd(win);
  }

  private spawnEnemy(unit: EnemyId, mult: number, offset: number) {
    const u = this.spawn(unit, 1, mult * this.diff.stat);
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

  /** Scripted arrivals: bosses in the campaign, everything in challenges. */
  private runScript(dt: number) {
    const L = this.level;
    const t = this.time - (isFinite(L.loopAfter) ? this.loopCount * L.loopAfter : 0);
    while (this.waveIdx < L.waves.length && L.waves[this.waveIdx].t <= t) {
      const w = L.waves[this.waveIdx++];
      if (UNITS[w.unit].boss && this.loopCount > 0) continue; // bosses appear once
      const enemyCount = this.units.filter((u) => u.side === 1 && !u.dead).length;
      for (let i = 0; i < w.count && (enemyCount + i < MAX_ARMY || UNITS[w.unit].boss); i++) this.spawnEnemy(w.unit, L.enemyMult * (w.mult ?? 1) * (1 + this.loopCount * 0.25), i * 26);
    }
    if (isFinite(L.loopAfter) && this.waveIdx >= L.waves.length && t >= L.loopAfter) { this.loopCount++; this.waveIdx = 0; }
    if (L.ai) return;
    const front = Math.max(0, ...this.playerArmy.filter((u) => u.def.id !== 'miner').map((u) => u.x));
    this.enemyAlert = front > W - 700 ? 1 : 0;
    void dt;
  }

  // ---------------- Enemy commander (economy + decisions) ----------------
  private armyValue(side: Side) {
    let v = 0;
    for (const u of this.units) if (u.side === side && !u.dead && u.def.id !== 'miner' && !u.def.boss) v += (u.def.cost || costOf(u.def.id)) * (u.hp / u.maxHp) * (side === 1 ? this.enemyStat : upgradeMult(this.perks.unitLevels[u.def.id as UnitId] ?? 1));
    return v;
  }

  private pickEnemyUnit(ai: 1 | 2 | 3): EnemyId | null {
    const pool = this.level.ai!.pool.filter((u) => u !== 'miner');
    const affordable = pool.filter((u) => costOf(u) <= this.egold);
    const mine = this.playerArmy.filter((u) => u.def.id !== 'miner');
    const flyers = mine.filter((u) => u.def.flying).length;
    const counterOf = (id: EnemyId): EnemyId[] => {
      const d = UNITS[id];
      if (d.flying) return ['archer', 'crossbow', 'sandmage'];
      if (d.ranged) return ['camel', 'cavalry', 'ghost', 'cobra', 'bandit'];
      if (d.charge || d.speed > 100) return ['spear'];
      if (d.hp >= 600) return ['crossbow', 'archer', 'golem'];
      return ['spear', 'golem', 'mummy', 'sword'];
    };
    let choices = affordable;
    if (ai >= 2 && mine.length) {
      // Counter the player's most common unit type (medium: sometimes, hard: always).
      const counts = new Map<EnemyId, number>();
      for (const u of mine) counts.set(u.def.id, (counts.get(u.def.id) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const wanted = new Set([...counterOf(top), ...(flyers ? ['archer', 'crossbow', 'sandmage'] as EnemyId[] : [])]);
      const counters = pool.filter((u) => wanted.has(u));
      if (counters.length && (ai === 3 || Math.random() < 0.55)) {
        const ok = counters.filter((u) => costOf(u) <= this.egold);
        if (ok.length) choices = ok;
        else if (ai === 3 && this.emode !== 'defend') return null; // hard AI saves up for the counter
      }
      // Hard AI keeps roughly a third of its army ranged.
      if (ai === 3) {
        const own = this.units.filter((u) => u.side === 1 && !u.dead && u.def.id !== 'miner');
        const rangedShare = own.length ? own.filter((u) => u.def.ranged).length / own.length : 0;
        const ranged = choices.filter((u) => UNITS[u].ranged);
        if (rangedShare < 0.3 && ranged.length && Math.random() < 0.6) choices = ranged;
      }
    }
    if (!choices.length) return null;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private runCommander(dt: number) {
    const A = this.level.ai!;
    const ai = this.diff.ai;
    this.eability = Math.min(1, this.eability + dt / 55);
    this.aiThink -= dt;
    if (this.aiThink > 0) return;
    this.aiThink = ai === 1 ? 1.4 : ai === 2 ? 1 : 0.7;

    // Economy: grow the mining crew over time.
    const targetMiners = Math.min(A.maxMiners + (ai === 3 ? 1 : 0), 2 + Math.floor(this.time / (ai === 1 ? 30 : 20)));
    if (this.minerCount(1) < targetMiners && this.egold >= 50 && this.equeue.length < 2) {
      this.egold -= 50; this.equeue.push({ id: 'miner', left: UNITS.miner.train });
    } else if (this.equeue.length < 2 && this.armyCount(1) < MAX_ARMY) {
      const pick = this.pickEnemyUnit(ai);
      if (pick && costOf(pick) <= this.egold) { this.egold -= costOf(pick); this.equeue.push({ id: pick, left: Math.max(2, UNITS[pick].train || costOf(pick) / 50) }); }
    }

    // Decisions: attack, defend, retreat, raid.
    const army = this.units.filter((u) => u.side === 1 && !u.dead && u.def.id !== 'miner');
    const ev = this.armyValue(1), pv = this.armyValue(0);
    const intruders = this.playerArmy.some((u) => u.def.id !== 'miner' && u.x > W * 0.58);
    if (this.time < A.graceTime) this.emode = 'defend';
    else if (ai === 1) {
      if (this.emode !== 'attack' && army.length >= this.aiAttackSize) this.emode = 'attack';
      if (this.emode === 'attack' && army.length < 2) { this.emode = 'defend'; this.aiAttackSize = 4 + Math.floor(Math.random() * 4); }
    } else {
      const ratio = ai === 3 ? 1.3 : 1.1;
      if (this.emode !== 'attack' && ((ev > pv * ratio && army.length >= 4) || army.length >= 16)) this.emode = 'attack';
      else if (this.emode === 'attack' && ev < pv * (ai === 3 ? 0.75 : 0.55)) this.emode = 'defend'; // retreat
      if (intruders && ev < pv * 1.1) this.emode = 'defend';
    }
    // Hard AI: send fast units to raid exposed miners.
    for (const u of army) u.raid = false;
    if (ai === 3 && this.emode !== 'defend' || (ai === 3 && !intruders)) {
      const fast = army.filter((u) => u.def.speed >= 90 && !u.def.flying).slice(0, 2);
      if (this.units.some((u) => u.side === 0 && u.def.id === 'miner' && !u.dead)) for (const u of fast) u.raid = true;
    }
    // Hard AI uses an arrow volley on your densest group.
    if (ai === 3 && this.eability >= 1) {
      const targets = this.playerArmy.filter((u) => u.def.id !== 'miner');
      if (targets.length >= 4) {
        this.eability = 0;
        const cx = targets.reduce((s, u) => s + u.x, 0) / targets.length;
        for (let i = 0; i < 14; i++) {
          const x = cx - 130 + Math.random() * 260, sx = x + 220, sy = -60 - Math.random() * 120;
          this.projectiles.push({ x: sx, y: sy, vx: 0, vy: 0, sx, sy, tx: x, ty: GROUND - 8, t: -i * 0.04, T: 0.75, arc: -20, side: 1, dmg: 14 * this.enemyStat, splash: 20, kind: 'arrow', air: true });
        }
        sfx('volley');
      }
    }
  }

  /** Melee ground units can't reach flying units. */
  canHit(a: Unit, b: Unit) {
    return !b.def.flying || !!a.def.ranged || !!a.def.flying;
  }

  private nearestFoe(u: Unit, maxDist: number, minersOnly = false) {
    let best: Unit | null = null;
    let bd = maxDist;
    for (const o of this.units) {
      if (o.side === u.side || o.dead || !this.canHit(u, o)) continue;
      if (minersOnly && o.def.id !== 'miner') continue;
      const d = Math.abs(o.x - u.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private updateMiner(u: Unit, dt: number) {
    const mx = MINE_X[u.side] + ((u.uid * 37) % 60) - 30;
    // Flee to the fort when enemies are right on top of the mine.
    const danger = this.nearestFoe(u, 60);
    if (danger && u.side === 0 && this.mode === 'defend') { /* stay brave in defend mode */ }
    if (Math.abs(u.x - mx) > 4) {
      u.x += Math.sign(mx - u.x) * u.def.speed * dt;
      u.moving = true;
    } else {
      u.mineTimer += dt * this.goldMult(u.side);
      if (u.mineTimer >= MINER_INTERVAL) {
        u.mineTimer -= MINER_INTERVAL;
        if (u.side === 0) {
          this.gold += MINER_GOLD; this.stats.mined += MINER_GOLD;
          this.texts.push({ x: u.x, y: GROUND - 60 + u.lane, text: `+${MINER_GOLD}`, life: 0.9, color: '#ffd34d' });
        } else this.egold += MINER_GOLD;
      }
      if (u.mineTimer % 1 < dt) u.attacking = 0.35;
    }
  }

  /** Healers and drummers stay just behind the front line. */
  private updateSupport(u: Unit, dt: number) {
    if (u.def.heal && u.cd <= 0) {
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
    if (u.def.support && u.cd <= 0) { u.attacking = 0.3; u.cd = 0.6; } // drumming
    const dir = u.side === 0 ? 1 : -1;
    const allies = this.units.filter((o) => o.side === u.side && !o.dead && o !== u && o.def.id !== 'miner' && !o.def.heal && !o.def.support);
    const front = allies.length ? (dir > 0 ? Math.max(...allies.map((o) => o.x)) : Math.min(...allies.map((o) => o.x))) : this.formationX(u);
    let target = front - dir * 70;
    const form = this.formationX(u);
    target = dir > 0 ? Math.min(target, form) : Math.max(target, form);
    target = Math.max(CASTLE_X[0] + 60, Math.min(CASTLE_X[1] - 60, target));
    if (Math.abs(target - u.x) > 8) { this.step(u, Math.sign(target - u.x) * this.speedOf(u) * dt); u.moving = true; }
  }

  private formationX(u: Unit): number {
    const back = u.def.ranged || u.def.heal || u.def.support;
    const idx = u.uid % 5;
    if (u.side === 1) {
      const m = this.level.ai ? this.emode : this.enemyAlert ? 'defend' : 'attack';
      if (m === 'defend') return CASTLE_X[1] - 220 + (back ? 70 : 0) + idx * 8;
      if (m === 'hold') return W / 2 + 80 + (back ? 90 : 0);
      return 0;
    }
    switch (this.mode) {
      case 'defend': return CASTLE_X[0] + 220 - (back ? 70 : 0) - idx * 8;
      case 'hold': return W / 2 - 80 - (back ? 90 : 0) - idx * 10;
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
    for (const a of this.auras) if (a.def.support && a.side === u.side && a !== u && Math.abs(a.x - u.x) < 160) { s *= 1.15; break; }
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
    const foeSide: Side = u.side === 0 ? 1 : 0;
    const enemyCastle = CASTLE_X[foeSide];

    if (isCtrl) {
      if (this.ctrlDir) {
        u.x = Math.max(CASTLE_X[0], Math.min(CASTLE_X[1], u.x + this.ctrlDir * this.speedOf(u) * 1.15 * dt));
        u.moving = true;
      }
      if (this.ctrlAttack && u.cd <= 0) {
        const foe = this.nearestFoe(u, range + 8);
        u.attacking = 0.3; u.calm = 0;
        u.cd = def.cooldown * 0.85;
        if (def.ranged) { if (foe) this.shoot(u, foe, dmgMult); else if (Math.abs(enemyCastle - u.x) < range + 50) this.shootCastle(u, foeSide, dmgMult); }
        else if (foe) this.hit(u, foe, dmgMult);
        else if (Math.abs(enemyCastle - u.x) < range + 50) this.hitCastle(u, foeSide, dmgMult);
        else sfx('swing');
      }
      return;
    }

    // Raiders hunt miners first.
    if (u.raid) {
      const prey = this.nearestFoe(u, W, true);
      if (prey) {
        const d = Math.abs(prey.x - u.x);
        if (d <= range) { if (u.cd <= 0) { u.attacking = 0.3; u.cd = def.cooldown; u.calm = 0; this.hit(u, prey, 1); } }
        else { this.step(u, Math.sign(prey.x - u.x) * this.speedOf(u) * dt); u.moving = true; }
        return;
      }
    }

    const defending = u.side === 0 ? this.mode === 'defend' : this.level.ai ? this.emode === 'defend' : false;
    const aggro = range + (defending ? 200 : 140);
    const foe = this.nearestFoe(u, aggro);
    if (foe) {
      const d = Math.abs(foe.x - u.x);
      if (d <= range) {
        if (u.cd <= 0) {
          u.attacking = 0.3; u.calm = 0;
          u.cd = def.cooldown;
          if (def.ranged) this.shoot(u, foe, dmgMult);
          else this.hit(u, foe, dmgMult);
        }
      } else {
        this.step(u, Math.sign(foe.x - u.x) * this.speedOf(u) * dt);
        u.moving = true;
      }
      return;
    }

    const castleDist = Math.abs(enemyCastle - u.x);
    const attackingNow = u.side === 1 ? (this.level.ai ? this.emode === 'attack' : true) : this.mode === 'attack';
    if (castleDist <= range + 50 && attackingNow && isFinite(this.castleHp[foeSide])) {
      if (u.cd <= 0) {
        u.attacking = 0.3; u.calm = 0;
        u.cd = def.cooldown;
        if (def.ranged) this.shootCastle(u, foeSide, dmgMult);
        else this.hitCastle(u, foeSide, dmgMult);
      }
      return;
    }

    let target = this.formationX(u);
    target = Math.max(CASTLE_X[0] + 40, Math.min(CASTLE_X[1] - 40, target));
    if (Math.abs(target - u.x) > 6) {
      this.step(u, Math.sign(target - u.x) * this.speedOf(u) * dt);
      u.moving = true;
    }
    void dir;
  }

  private stepDt = 0;
  /**
   * Move a unit, queueing behind allies: if a stationary ally blocks the way
   * in its lane, sidestep into a free lane (or wait) instead of overlapping.
   */
  private step(u: Unit, dx: number) {
    if (!dx) return;
    if (u.def.flying || u === this.controlled || u.def.id === 'miner') { u.x += dx; return; }
    const dir = Math.sign(dx);
    for (const o of this.units) {
      if (o === u || o.dead || o.side !== u.side || o.def.flying || o.def.id === 'miner') continue;
      const ahead = (o.x - u.x) * dir;
      const minD = Math.min(24, (u.def.height + o.def.height) * 0.15);
      if (ahead <= 0 || ahead > minD || Math.abs(o.lane - u.lane) > 8) continue;
      if (o.lastDx * dir > 0.01) continue; // ally walking the same way: just follow
      const side = u.lane >= o.lane ? 1 : -1;
      const nl = u.lane + side * 45 * this.stepDt;
      if (Math.abs(nl) <= 18) { u.lane = nl; u.x += dx * 0.3; }
      return;
    }
    u.x += dx;
  }

  private updateTowers(dt: number) {
    for (const side of [0, 1] as Side[]) {
      this.towerShot[side] = Math.max(0, this.towerShot[side] - dt);
      const dmg = side === 0 ? 11 * passiveFx.towers(this.perks.passives.towers) : (this.level.towerDmg ?? 0) * this.diff.tower;
      if (!dmg || !isFinite(this.castleHp[side]) && side === 1) continue;
      this.towerCd[side] -= dt;
      if (this.towerCd[side] > 0) continue;
      const tx = CASTLE_X[side] + (side === 0 ? -90 : 90);
      let best: Unit | null = null, bd = TOWER_RANGE;
      for (const o of this.units) if (o.side !== side && !o.dead) { const d = Math.abs(o.x - tx); if (d < bd) { bd = d; best = o; } }
      if (!best) { this.towerCd[side] = 0.3; continue; }
      this.towerCd[side] = 1.5;
      this.towerShot[side] = 0.3;
      const sy = GROUND - 238;
      this.projectiles.push({ x: tx, y: sy, vx: 0, vy: 0, sx: tx, sy, tx: best.x, ty: this.unitY(best) - best.def.height * 0.5, t: 0, T: Math.max(0.35, bd / 600), arc: 30, side, dmg, splash: 0, kind: 'arrow', target: best, air: true });
    }
  }

  /** Every outgoing-damage modifier in one place. */
  private outMult(u: Unit, target?: UnitDef) {
    let m = target && u.def.bonusVs?.includes(target.id) ? COUNTER_BONUS : 1;
    if (u.side === 0 && this.buff > 0) m *= 1.25;
    if (u.side === 1 && this.debuff > 0) m *= 0.7;
    for (const h of this.auras) if (h.side === u.side && h !== u && Math.abs(h.x - u.x) < 150) { m *= 1 + h.def.aura!; break; }
    return m;
  }

  private hit(u: Unit, foe: Unit, mult: number) {
    let dmg = u.dmg * mult * this.outMult(u, foe.def);
    if (u.chargeReady && u.def.charge) { dmg *= 2; u.chargeReady = false; this.dust(foe.x, GROUND - 6, '#e8cf96', 6); }
    if (u.def.crit && Math.random() < u.def.crit) {
      dmg *= 2.5;
      this.texts.push({ x: foe.x, y: this.unitY(foe) - foe.def.height - 10, text: '✦', life: 0.6, color: '#ff6b3d' });
    }
    if (u.def.splash) {
      for (const o of this.units) if (o.side !== u.side && !o.dead && this.canHit(u, o) && Math.abs(o.x - foe.x) < u.def.splash) this.applyDamage(o, o === foe ? dmg : dmg * 0.5, o !== foe, u);
    } else this.applyDamage(foe, dmg, false, u);
    // A little knockback sells the impact.
    if (!foe.def.boss && foe.def.hp < 700) foe.x += (u.side === 0 ? 1 : -1) * (u.def.hp > 1000 ? 10 : 3);
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

  private projKind(u: Unit): Projectile['kind'] {
    const id = u.def.id;
    return id === 'catapult' ? 'rock' : id === 'fire' ? 'fire' : id === 'crossbow' ? 'bolt' : ['sandmage', 'boss', 'djinn', 'genie', 'phoenix'].includes(id) ? (id === 'phoenix' ? 'fire' : 'magic') : 'arrow';
  }

  /** Guided arc: the shot keeps tracking the target, so moving units are hit. */
  private shoot(u: Unit, foe: Unit, mult: number) {
    const kind = this.projKind(u);
    const sy = this.unitY(u) - u.def.height * 0.8;
    const ty = this.unitY(foe) - foe.def.height * 0.5;
    const d = Math.abs(foe.x - u.x);
    const T = kind === 'bolt' ? Math.max(0.2, d / 900) : Math.max(0.3, d / 560);
    const arc = kind === 'bolt' ? 8 : kind === 'rock' ? 90 + d * 0.15 : 25 + d * 0.12;
    this.projectiles.push({ x: u.x, y: sy, vx: 0, vy: 0, sx: u.x, sy, tx: foe.x, ty, t: 0, T, arc, side: u.side, dmg: u.dmg * mult * this.outMult(u), splash: u.def.splash ?? 0, kind, bonusVs: u.def.bonusVs, target: kind === 'rock' ? undefined : foe, src: u, air: kind !== 'rock' });
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private shootCastle(u: Unit, side: Side, mult: number) {
    const kind = this.projKind(u);
    const sy = this.unitY(u) - u.def.height * 0.8;
    const tx = CASTLE_X[side] + (side === 0 ? 40 : -40);
    const d = Math.abs(tx - u.x);
    this.projectiles.push({ x: u.x, y: sy, vx: 0, vy: 0, sx: u.x, sy, tx, ty: GROUND - 70, t: 0, T: Math.max(0.3, d / 560), arc: kind === 'bolt' ? 8 : 40 + d * 0.15, side: u.side, dmg: u.dmg * mult * this.outMult(u), splash: u.def.splash ?? 0, kind, castle: side, src: u, air: false });
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private impact(p: Projectile) {
    const foeSide: Side = p.side === 0 ? 1 : 0;
    const x = p.x;
    if (p.castle !== undefined) {
      if (isFinite(this.castleHp[p.castle])) {
        this.castleHp[p.castle] = Math.max(0, this.castleHp[p.castle] - p.dmg * (p.kind === 'rock' ? 2 : 0.6));
        this.shake = Math.min(0.5, this.shake + (p.kind === 'rock' ? 0.15 : 0.03));
      }
      this.dust(x, p.y, '#c9a26a', p.kind === 'rock' ? 8 : 3);
      if (p.kind === 'rock') sfx('boom');
      return;
    }
    const primary = p.target && !p.target.dead && Math.abs(p.target.x - x) < 40 ? p.target : undefined;
    let hitAny = false;
    if (primary) {
      this.applyDamage(primary, p.dmg * (p.bonusVs?.includes(primary.def.id) ? COUNTER_BONUS : 1), false, p.src);
      hitAny = true;
    }
    if (!primary || p.splash) {
      const radius = p.splash || 20;
      for (const o of this.units) {
        if (o.side !== foeSide || o.dead || o === primary) continue;
        if (o.def.flying && !p.air && !primary) continue;
        if (o.def.flying && !primary && p.kind !== 'meteor' && p.kind !== 'fire' && p.kind !== 'arrow') continue;
        if (Math.abs(o.x - x) < radius) {
          const m = p.bonusVs?.includes(o.def.id) ? COUNTER_BONUS : 1;
          this.applyDamage(o, p.dmg * m * (p.splash && hitAny ? 0.5 : 1), p.splash > 0 && hitAny, p.src);
          hitAny = true;
          if (!p.splash) break;
        }
      }
    }
    // Siege shots that land near a fort still chip it.
    if (!primary && Math.abs(CASTLE_X[foeSide] - x) < 70 && isFinite(this.castleHp[foeSide]) && (p.kind === 'rock' || p.kind === 'meteor')) {
      this.castleHp[foeSide] = Math.max(0, this.castleHp[foeSide] - p.dmg);
    }
    const color = p.kind === 'magic' ? '#c77dff' : p.kind === 'fire' || p.kind === 'meteor' ? '#ff8a3d' : '#e8cf96';
    if (p.kind !== 'arrow' && p.kind !== 'bolt' || !hitAny) for (let i = 0; i < (p.kind === 'rock' || p.kind === 'meteor' ? 14 : 3); i++) this.dust(x, p.y, color, 3 + Math.random() * 5);
    if (p.kind === 'rock' || p.kind === 'meteor') { this.shake = Math.min(0.6, this.shake + 0.2); sfx('boom'); }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.t < 0) continue; // delayed (volleys)
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = this.unitY(p.target) - p.target.def.height * 0.5; }
      const k = Math.min(1, p.t / p.T);
      const nx = lerp(p.sx, p.tx, k), ny = lerp(p.sy, p.ty, k) - Math.sin(Math.PI * k) * p.arc;
      p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt;
      p.x = nx; p.y = ny;
      if (k >= 1) { p.T = -1; this.impact(p); }
    }
    this.projectiles = this.projectiles.filter((p) => p.T > 0);
  }

  private applyDamage(o: Unit, dmg: number, isSplash = false, src?: Unit) {
    if (o.def.dodge && !isSplash && Math.random() < o.def.dodge) {
      this.texts.push({ x: o.x, y: this.unitY(o) - o.def.height - 8, text: '~', life: 0.5, color: '#fff' });
      return;
    }
    const dealt = Math.min(o.hp, dmg);
    o.hp -= dmg;
    o.hitFlash = 0.12;
    if (src?.side === 0) this.stats.damage[src.def.id as UnitId] = (this.stats.damage[src.def.id as UnitId] ?? 0) + dealt;
    if (o.hp <= 0 && !o.dead) {
      o.dead = 0.001;
      if (o.side === 1) {
        this.stats.kills++;
        if (o.def.id === 'miner') this.stats.enemyMinersKilled++;
        const bounty = Math.round((o.def.boss ? 200 : 8 + o.def.hp / 25) * (this.level.mods?.goldMult ?? 1));
        this.gold += bounty;
        this.texts.push({ x: o.x, y: GROUND - 70, text: `+${bounty}`, life: 1, color: '#ffd34d' });
      } else {
        this.stats.lost++;
        this.egold += Math.round(4 + o.def.hp / 40); // enemy earns a small bounty too
      }
      if (src && !src.dead && src.rank < MAX_RANK) {
        src.kills++;
        if (src.kills >= (src.rank === 0 ? 3 : 7)) {
          src.rank++;
          src.maxHp *= 1.15; src.dmg *= 1.15; src.hp = Math.min(src.maxHp, src.hp + src.maxHp * 0.3);
          this.texts.push({ x: src.x, y: this.unitY(src) - src.def.height - 16, text: '★'.repeat(src.rank), life: 1.2, color: '#ffe066', size: 22 });
          this.ev.onRank?.(src);
        }
      }
      for (let i = 0; i < 8; i++) this.dust(o.x, this.unitY(o) - o.def.height * 0.5, o.def.id === 'ghost' || o.def.id === 'djinn' ? '#9fd8ff' : '#f0dcae', 3 + Math.random() * 4);
    }
  }

  dust(x: number, y: number, color: string, size: number) {
    if (this.particles.length > 280) return;
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

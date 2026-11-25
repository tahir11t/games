import { UNITS, MINER_GOLD, MINER_INTERVAL, MAX_MINERS, MAX_ARMY, CONTROL_BONUS, COUNTER_BONUS, FLY_HEIGHT, MAX_RANK, RANK_KILLS, RANK_HEAL, MINE_UPGRADE, MINE_YIELD, upgradeMult, type EnemyId, type UnitId, type UnitDef } from '../data/units';
import { costOf, type LevelDef, type WarSpec } from '../data/levels';
import { ABILITIES, passiveFx, type Perks } from '../data/skills';
import { survivalWave } from '../data/challenges';
import { factionById, rosterOf, armyCost, armyTrain, type ArmyId } from '../data/factions';
import { PLAYER_UNITS } from '../data/units';
import { sfx } from './audio';

export const W = 2400;
export const H = 540;
export const GROUND = 385;
export const CASTLE_X = [130, W - 130];
export const MINE_X = [340, W - 340];
export const TOWER_RANGE = [500, 400]; // player fort archers see further
export const TOWER_COST = [0, 250, 450]; // price of the 2nd and 3rd fort archer
export const MAX_TOWER_ARCHERS = 3;
/** Nations War: the third nation's citadel stands in mid-field. */
export const CITADEL_X = W / 2;
/** x of castle slot 0 (player), 1 (right fort) or 2 (citadel). */
export const castleX = (i: number) => (i === 2 ? CITADEL_X : CASTLE_X[i]);
/** Visual tier from upgrade level: a new look every 5 levels. */
export const tierOf = (lvl: number) => Math.min(4, Math.floor(lvl / 5));

export type Mode = 'defend' | 'hold' | 'attack';
/** Player army formation: trade-offs picked during battle ('line' = no change). */
export type Formation = 'line' | 'wedge' | 'wall' | 'skirmish';
export const FORMATIONS: Formation[] = ['line', 'wedge', 'wall', 'skirmish'];
/** Tribal bonds: fielding several units of one role gives that role a bonus (both armies). */
export type BondId = 'volley' | 'phalanx' | 'charge' | 'brothers';
export const BONDS: Record<BondId, { roles: UnitId[]; need: number; icon: string }> = {
  volley: { roles: ['archer', 'crossbow'], need: 4, icon: '🏹' }, // +6% ranged damage
  phalanx: { roles: ['spear'], need: 3, icon: '🛡️' }, // spearmen take 10% less damage
  charge: { roles: ['camel', 'cavalry', 'lion'], need: 2, icon: '🐪' }, // +6% speed and damage
  brothers: { roles: ['sword'], need: 6, icon: '⚔️' }, // swordsmen +5% damage
};
/** Enemy units that count toward a bond like their desert counterpart. */
const BOND_ALIAS: Partial<Record<EnemyId, UnitId>> = {
  bandit: 'sword', skeleton: 'sword', zombie: 'sword', runner: 'sword', bladedancer: 'sword', berserker: 'sword', goblinspear: 'spear', shieldwall: 'spear', specter: 'spear',
  elfarcher: 'archer', skelarcher: 'archer', axethrower: 'archer', sandmage: 'archer', elkrider: 'cavalry', hyena: 'lion',
};
/** The Oasis Well in mid-field: hold it to earn gold and heal nearby troops. */
export const WELL_X = W / 2;
export const WELL_R = 140;
export type DropKind = 'gold' | 'charge' | 'heal';
export interface SupplyDrop { x: number; y: number; kind: DropKind; life: number; landed: boolean; road: number; }
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
  tier: number; // visual tier 0..4
  summonCd: number;
  stun: number; // seconds stunned
  carry: number; // gold in the sack (miners)
  tripT: number; // time spent on the current mining trip
  hidden: boolean; // miner sheltering inside the fort
  stompCd: number;
  auraCd: number;
  nation: number; // owner: 0 = the player, 1 = the classic enemy, 2+ = Nations War commanders
  road: number; // Nations War roads: 0 = north (back), 1 = south (front); always 0 elsewhere
  slow: number; // seconds slowed by a power (Haunting)
  face?: number; // facing (±1) when it can differ from the side (Nations War)
  dmgText?: FloatText; // merges rapid hits into one rising number
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  sx: number; sy: number; tx: number; ty: number; t: number; T: number; arc: number;
  side: Side; dmg: number; splash: number; kind: 'arrow' | 'bolt' | 'rock' | 'magic' | 'fire' | 'meteor';
  bonusVs?: EnemyId[];
  target?: Unit; // guided: follows the target so moving units are still hit
  castle?: number; // aimed at a fort slot
  src?: Unit;
  air: boolean; // can hit flying units on a ground impact
  nation?: number; // owner nation (defaults to side)
  fortMult?: number; // Siege role bonus against forts
  road?: number; // road it was fired on (unset: hits every road, e.g. towers and sky abilities)
  pierce?: boolean;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
export interface FloatText { x: number; y: number; text: string; life: number; color: string; size?: number; value?: number; }
export interface QueueItem { id: EnemyId; left: number; }

export interface BattleStats { trained: number; kills: number; lost: number; mined: number; damage: Partial<Record<UnitId, number>>; enemyMinersKilled: number; bossKills: number; perfect: number; drops: number; wellTime: number; }

export interface BattleEvents {
  onEnd(win: boolean): void;
  onUnitTrained(id: UnitId): void;
  onWave?(n: number): void;
  onRank?(u: Unit): void;
  onRush?(): void;
  onStreak?(n: number, bonus: number): void;
  onRage?(): void;
  onLastStand?(): void;
  onWell?(owner: Side): void;
  onDrop?(kind: DropKind, side: Side): void;
  onPerfect?(): void;
  onSpawn?(id: EnemyId, side: Side): void;
  onEliminated?(nation: number): void;
  onBoss?(id: EnemyId): void;
  onPower?(nation: number, power: PowerId): void;
}

export type BattlePerks = Perks & { difficulty: Difficulty; army?: ArmyId; extra?: EnemyId[] };
const DEFAULT_PERKS: BattlePerks = {
  unitLevels: Object.fromEntries(Object.keys(UNITS).map((k) => [k, 1])) as Record<UnitId, number>,
  ability: 'volley',
  passives: { mining: 0, walls: 0, treasury: 0, eagle: 0, wisdom: 0, towers: 0 },
  difficulty: 'medium',
  army: 'desert',
};

let UID = 1;
const WAR_ARMY_CAP = 26;
/** Nations War roads: vertical offsets of the north (back) and south (front) roads. */
export const ROAD_Y = [-46, 12];
export const CITADEL_ROAD = 1;
/** Nation roles in Nations War: a passive trait and a power that charges during battle. */
export interface NationRole { icon: string; power: PowerId; hp?: number; range?: number; speed?: number; dodge?: number; fort?: number; cheap?: number; gold?: number; }
export type PowerId = 'command' | 'bless' | 'haunt' | 'rise' | 'barrage' | 'avalanche';
export const ROLES: Record<string, NationRole> = {
  desert: { icon: '🐪', power: 'command', gold: 1.12 }, // Traders: richer mines
  elves: { icon: '🌿', power: 'bless', range: 1.15 }, // Wardens: longer range · heal the whole army
  ghosts: { icon: '👻', power: 'haunt', speed: 1.12, dodge: 0.1 }, // Phantoms: fast and evasive · slow a road
  zombies: { icon: '🧟', power: 'rise', cheap: 0.8 }, // Swarm: cheaper units · raise a horde
  dwarves: { icon: '⚒️', power: 'barrage', fort: 1.5 }, // Siege: hit forts harder · cannon barrage
  giants: { icon: '🗻', power: 'avalanche', hp: 1.2 }, // Titans: tougher · stunning avalanche
};
export const POWER_CHARGE = 48; // seconds for a nation power to charge
export interface WarCmd { power: number; road: number; nation: number; side: Side; castle: number; pool: EnemyId[]; gold: number; income: number; stat: number; queue: QueueItem[]; mode: Mode; think: number; target: EnemyId | null; focus: number; focusT: number; alive: boolean; ally: boolean; color: string; faction: string; attackSize: number; }
const PERFECT_EARLY = 0.12, PERFECT_LATE = 0.3, PERFECT_BONUS = 1.6;
const WELL_GOLD = 5, WELL_HEAL = 0.012; // gold per 3 s, share of max HP per second
const DROP_GOLD = 120;
const LAST_STAND_AT = 0.25, LAST_STAND_R = 420;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class Battle {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  bolts: { x1: number; y1: number; x2: number; y2: number; life: number }[] = []; // chain lightning
  particles: Particle[] = [];
  texts: FloatText[] = [];
  castleHp: number[]; // slots: 0 player fort, 1 right fort, 2 citadel (0 when absent)
  castleMax: number[];
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
  towerCd: number[] = [1, 2, 1.5];
  towerShot: number[] = [0, 0, 0]; // anim timers
  towerArchers: number[] = [1, 0, 0];
  /** survival skill cards: stacking bonuses picked between waves */
  cards = { dmg: 1, speed: 1, gold: 1, horde: 0 };
  mineLevel: [number, number] = [1, 1];
  hideMiners: [boolean, boolean] = [false, false];
  rush = 0; // gold rush timer (both mines yield double)
  private rushNext = 70 + Math.random() * 40;
  holdX = W / 2 - 80; // rally flag for "hold"
  fx: { kind: 'slash' | 'spark' | 'pillar' | 'ring' | 'shock'; x: number; y: number; f: number; life: number; max: number }[] = [];
  streak = 0;
  private streakT = 0;
  rage = false;
  finale = 0; // victory slow-motion timer
  finaleX = 0;
  stats: BattleStats = { trained: 0, kills: 0, lost: 0, mined: 0, damage: {}, enemyMinersKilled: 0, bossKills: 0, perfect: 0, drops: 0, wellTime: 0 };
  formation: Formation = 'line';
  /** -1..1: >= 1 the player holds the well, <= -1 the enemy does. */
  well = { progress: 0, owner: -1 as -1 | Side, tick: 0 };
  drops: SupplyDrop[] = [];
  private dropNext = 38 + Math.random() * 14;
  lastStand = false; // the fort's one-time shockwave has fired
  bonds: [Set<BondId>, Set<BondId>] = [new Set(), new Set()];
  /** units the player set to train automatically (long-press a unit button) */
  repeat = new Set<EnemyId>();
  private repeatIdx = 0;
  perfectFx = 0;
  private bondT = 0;
  private survivalNext = 8;
  private passiveIncome = 0;
  private auras: Unit[] = [];
  private aiThink = 0;
  private aiAttackSize = 5;
  private aiTarget: EnemyId | null = null;
  private playerMiner: EnemyId = 'miner';
  readonly perks: BattlePerks;
  readonly roster: EnemyId[]; // the player's unit bar
  private roles: Partial<Record<EnemyId, UnitId>> = {};
  readonly allowed: UnitId[] | null;
  readonly diff: (typeof DIFFICULTY)[Difficulty];

  constructor(public level: LevelDef, perks: Partial<BattlePerks> | Record<UnitId, number>, startGold: number, private ev: BattleEvents) {
    const p = 'unitLevels' in perks ? (perks as Partial<BattlePerks>) : { unitLevels: perks as Record<UnitId, number> };
    this.perks = { ...DEFAULT_PERKS, ...p, unitLevels: { ...DEFAULT_PERKS.unitLevels, ...p.unitLevels }, passives: { ...DEFAULT_PERKS.passives, ...p.passives } };
    this.diff = DIFFICULTY[this.perks.difficulty];
    // Playing as a conquered civilization swaps the unit bar (upgrades carry over by role).
    const army = this.perks.army ?? 'desert';
    if (army !== 'desert') { const f = factionById(army); this.roster = [...rosterOf(f), ...(this.perks.extra ?? [])]; this.roles = f.roles; this.playerMiner = f.miner; }
    else this.roster = PLAYER_UNITS;
    this.allowed = level.allowed ?? null;
    const fort = 1500 * passiveFx.walls(this.perks.passives.walls);
    const citadel = level.war?.citadelHp ?? 0;
    this.castleMax = [fort, level.castleHp, citadel];
    this.castleHp = [fort, level.castleHp, citadel];
    this.gold = Math.max(startGold, level.startGold ?? 0) + passiveFx.treasury(this.perks.passives.treasury);
    if (!level.mods?.noMiners) {
      this.spawn(this.playerMiner, 0);
      this.spawn(this.playerMiner, 0).x += 20;
    }
    this.towerArchers[1] = (level.towerDmg ?? 0) > 0 ? 1 : 0;
    if (level.ai) {
      this.egold = level.ai.startGold;
      const em = level.ai.miner ?? 'miner';
      this.spawn(em, 1);
      this.spawn(em, 1).x -= 20;
      this.aiAttackSize = 4 + Math.floor(Math.random() * 3);
    }
    if (level.war) this.initWar(level.war);
  }

  get survival() { return this.level.kind === 'survival'; }
  get playerArmy() { return this.units.filter((u) => u.side === 0 && !u.dead); }
  get enemyStat() { return this.level.enemyMult * this.diff.stat; }
  goldMult(side: Side) {
    return MINE_YIELD[this.mineLevel[side] - 1] * (this.rush > 0 ? 2 : 1) * (side === 0 && this.multi ? this.roleFor(0).gold ?? 1 : 1) * (side === 0 ? (this.level.mods?.goldMult ?? 1) * passiveFx.mining(this.perks.passives.mining) * this.cards.gold : (this.level.ai?.income ?? 1) * this.diff.income);
  }
  minerCount(side: Side = 0) {
    const q = side === 0 ? this.queue : this.equeue;
    return this.units.filter((u) => u.side === side && !u.dead && u.def.miner).length + q.filter((x) => UNITS[x.id].miner).length;
  }
  armyCount(side: Side = 0) { return this.units.filter((u) => u.side === side && !u.dead && (side === 1 || u.nation === 0)).length + (side === 0 ? this.queue : this.equeue).length; }

  isAllowed(id: EnemyId) {
    if (UNITS[id].miner && this.level.mods?.noMiners) return false;
    if (!this.roster.includes(id)) return false;
    // challenge restrictions name desert units; a civilization army maps them by role
    if (!this.allowed) return true;
    return this.allowed.includes((this.roles[id] ?? id) as UnitId);
  }
  costOf(id: EnemyId) { const c = UNITS[id].cost || armyCost(id); return this.multi ? Math.round(c * (this.roleFor(0).cheap ?? 1)) : c; }
  trainTime(id: EnemyId) { return UNITS[id].train || armyTrain(id); }

  canTrain(id: EnemyId) {
    const d = UNITS[id];
    if (!this.isAllowed(id)) return false;
    if (this.gold < this.costOf(id)) return false;
    if (d.miner && this.minerCount() >= MAX_MINERS) return false;
    if (this.armyCount() >= MAX_ARMY) return false;
    if (d.maxCount && this.units.filter((u) => u.side === 0 && u.nation === 0 && !u.dead && u.def.id === id).length + this.queue.filter((q) => q.id === id).length >= d.maxCount) return false;
    return true;
  }

  train(id: EnemyId) {
    if (!this.canTrain(id)) return false;
    this.gold -= this.costOf(id);
    this.queue.push({ id, left: this.trainTime(id) });
    sfx('click');
    return true;
  }

  spawn(id: EnemyId, side: Side, mult = 1, nation: number = side) {
    const def = UNITS[id];
    const role = (this.roles[id] ?? id) as UnitId;
    const mine = side === 0 && nation === 0; // the player's own soldier (allies scale by their commander)
    const lvlMult = mine ? upgradeMult(this.perks.unitLevels[role] ?? 1) : mult;
    const dmgMod = side === 1 ? this.level.mods?.enemyDmg ?? 1 : mine && def.ranged ? passiveFx.eagle(this.perks.passives.eagle) : 1;
    const u: Unit = {
      uid: UID++, def, side,
      x: nation >= 2 ? this.spawnX(nation) : CASTLE_X[side] + (side === 0 ? 40 : -40), nation, road: 0, slow: 0,
      lane: (Math.random() - 0.5) * 30,
      hp: def.hp * lvlMult, maxHp: def.hp * lvlMult, dmg: def.dmg * lvlMult * dmgMod,
      cd: Math.random() * 0.5, anim: Math.random() * 10, moving: false, attacking: 0,
      chargeReady: !!def.charge, calm: 0, mineTimer: Math.random() * 2, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0,
      summonCd: def.summon?.every ?? 0, stun: 0, stompCd: def.stomp?.every ?? 0, auraCd: def.healAura?.every ?? 0, carry: 0, tripT: 0, hidden: false,
      tier: mine ? tierOf(this.perks.unitLevels[role] ?? 1) : Math.max(0, Math.min(3, Math.floor((mult - 1) / 0.3))),
    };
    if (this.multi) {
      const r = this.roleFor(nation);
      if (r.hp) { u.hp *= r.hp; u.maxHp *= r.hp; }
      u.road = this.pickRoad(nation, def);
    }
    this.units.push(u);
    this.ev.onSpawn?.(id, side);
    return u;
  }

  /** The desert role a unit counts as (civilization armies map by role). */
  roleOf(u: Unit): EnemyId { return u.side === 0 && u.nation === 0 ? (this.roles[u.def.id] ?? u.def.id) : u.def.id; }
  private bondRole(u: Unit): UnitId { const r = this.roleOf(u); return (u.side === 1 ? BOND_ALIAS[r] ?? r : r) as UnitId; }
  hasBond(side: Side, b: BondId) { return this.bonds[side].has(b); }
  private bondOf(u: Unit): BondId | null {
    const r = this.bondRole(u);
    for (const [id, b] of Object.entries(BONDS) as [BondId, (typeof BONDS)[BondId]][]) if (b.roles.includes(r)) return this.bonds[u.side].has(id) ? id : null;
    return null;
  }
  private updateBonds() {
    for (const side of [0, 1] as Side[]) {
      const counts = new Map<BondId, number>();
      for (const u of this.units) {
        if (u.side !== side || u.dead) continue;
        const r = this.bondRole(u);
        for (const [id, b] of Object.entries(BONDS) as [BondId, (typeof BONDS)[BondId]][]) if (b.roles.includes(r)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const next = new Set<BondId>();
      for (const [id, n] of counts) if (n >= BONDS[id].need) next.add(id);
      this.bonds[side] = next;
    }
  }
  setFormation(f: Formation) { this.formation = f; sfx('click'); }
  toggleRepeat(id: EnemyId) { if (this.repeat.has(id)) this.repeat.delete(id); else this.repeat.add(id); sfx('click'); }
  /** A fresh tap of the attack pad: perfectly timed taps (just as the weapon is ready) hit harder. */
  private perfectArmed = false;
  pressAttack() {
    this.ctrlAttack = true;
    const u = this.controlled;
    this.perfectArmed = !!u && u.cd <= PERFECT_EARLY && u.cd > -PERFECT_LATE;
  }

  /** The Oasis Well: the side with more fighters around it slowly takes it over. */
  private updateWell(dt: number) {
    if (this.level.war?.ffa) return; // the citadel stands where the well would be
    const w = this.well;
    let n0 = 0, n1 = 0;
    for (const u of this.units) {
      if (u.dead || u.def.miner || u.hidden || Math.abs(u.x - WELL_X) > WELL_R) continue;
      if (u.side === 0) n0++; else n1++;
    }
    if (n0 !== n1) {
      const push = Math.min(3, Math.abs(n0 - n1)) * 0.11 * dt * (n0 > n1 ? 1 : -1);
      w.progress = Math.max(-1, Math.min(1, w.progress + push));
    } else if (!n0 && w.owner === -1) w.progress *= 1 - dt * 0.1; // an empty, unclaimed well drifts back to neutral
    const prev = w.owner;
    if (w.progress >= 1) w.owner = 0;
    else if (w.progress <= -1) w.owner = 1;
    else if ((w.owner === 0 && w.progress <= 0) || (w.owner === 1 && w.progress >= 0)) w.owner = -1;
    if (w.owner !== prev && w.owner !== -1) {
      this.ev.onWell?.(w.owner);
      for (let i = 0; i < 12; i++) this.dust(WELL_X + (Math.random() - 0.5) * 60, GROUND - 30, w.owner === 0 ? '#ffd34d' : '#ff6b5a', 4);
    }
    if (w.owner === -1) return;
    if (w.owner === 0) this.stats.wellTime += dt;
    w.tick += dt;
    for (const u of this.units) if (u.side === w.owner && !u.dead && u.hp < u.maxHp && Math.abs(u.x - WELL_X) < WELL_R) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * WELL_HEAL * dt);
    if (w.tick >= 3) {
      w.tick -= 3;
      if (w.owner === 0) { this.gold += WELL_GOLD; this.texts.push({ x: WELL_X, y: GROUND - 90, text: `+${WELL_GOLD}`, life: 0.9, color: '#ffd34d' }); }
      else this.addEnemyGold(WELL_GOLD);
    }
  }

  /** Supply crates parachute onto mid-field; the first fighter to touch one claims it. */
  private updateDrops(dt: number) {
    this.dropNext -= dt;
    if (this.dropNext <= 0 && !this.over) {
      this.dropNext = 48 + Math.random() * 22;
      const kinds: DropKind[] = ['gold', 'charge', 'heal'];
      this.drops.push({ x: W * (0.36 + Math.random() * 0.28), y: -40, kind: kinds[Math.floor(Math.random() * 3)], life: 26, landed: false, road: this.roadsOn ? Math.floor(Math.random() * 2) : 0 });
    }
    for (const d of this.drops) {
      d.life -= dt;
      const dg = GROUND + (this.roadsOn ? ROAD_Y[d.road] : 0);
      if (!d.landed) { d.y += 120 * dt; if (d.y >= dg - 10) { d.y = dg - 10; d.landed = true; this.dust(d.x, dg - 4, '#d9c08a', 5); } continue; }
      let taker: Unit | null = null, bd = 24;
      for (const u of this.units) {
        if (u.dead || u.def.miner || u.def.flying || u.hidden || (this.roadsOn && u.road !== d.road)) continue;
        const dd = Math.abs(u.x - d.x);
        if (dd < bd) { bd = dd; taker = u; }
      }
      if (taker) { d.life = 0; this.claimDrop(d, taker.side); }
    }
    if (this.drops.length) this.drops = this.drops.filter((d) => d.life > 0);
  }
  private claimDrop(d: SupplyDrop, side: Side) {
    sfx('coin');
    for (let i = 0; i < 10; i++) this.dust(d.x, GROUND - 16, side === 0 ? '#ffe066' : '#ff8a6a', 4);
    if (d.kind === 'gold') { if (side === 0) this.gold += DROP_GOLD; else this.addEnemyGold(DROP_GOLD); }
    else if (d.kind === 'charge') { if (side === 0) this.ability = Math.min(1, this.ability + 0.5); else this.eability = Math.min(1, this.eability + 0.5); }
    else for (const u of this.units) if (u.side === side && !u.dead) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25); u.healFx = 1; }
    if (side === 0) { this.stats.drops++; this.texts.push({ x: d.x, y: GROUND - 70, text: d.kind === 'gold' ? `+${DROP_GOLD}` : d.kind === 'charge' ? '⚡+50%' : '✚25%', life: 1.2, color: '#ffe066', size: 18 }); }
    this.ev.onDrop?.(d.kind, side);
  }

  /** Below 25% health the player's fort fires one shockwave that throws back and stuns attackers. */
  private checkLastStand() {
    if (this.lastStand || this.castleHp[0] <= 0 || this.castleHp[0] / this.castleMax[0] >= LAST_STAND_AT) return;
    this.lastStand = true;
    const x0 = CASTLE_X[0];
    this.fx.push({ kind: 'shock', x: x0 + 40, y: GROUND, f: 1, life: 0.9, max: 0.9 });
    this.shake = Math.min(1, this.shake + 0.6); sfx('boom');
    for (let i = 0; i < 24; i++) this.dust(x0 + 60 + Math.random() * 300, GROUND - 6, '#d9c08a', 5 + Math.random() * 6);
    for (const v of this.units) {
      if (v.side !== 1 || v.dead || Math.abs(v.x - x0) > LAST_STAND_R) continue;
      v.x += v.def.boss ? 40 : 150;
      v.stun = Math.max(v.stun, v.def.boss ? 0.6 : 1.6);
      this.applyDamage(v, 60 + this.level.index * 2, true);
    }
    this.ev.onLastStand?.();
  }

  setMode(m: Mode) { this.mode = m; sfx('click'); }

  mineCost() { return this.mineLevel[0] < MINE_YIELD.length ? MINE_UPGRADE[this.mineLevel[0]] : Infinity; }
  upgradeMine() {
    const c = this.mineCost();
    if (this.gold < c) return false;
    this.gold -= c; this.mineLevel[0]++;
    sfx('coin');
    this.texts.push({ x: MINE_X[0], y: GROUND - 80, text: '⛏️ +' + Math.round((MINE_YIELD[this.mineLevel[0] - 1] - 1) * 100) + '%', life: 1.4, color: '#ffe066', size: 20 });
    return true;
  }
  toggleHide() { this.hideMiners[0] = !this.hideMiners[0]; sfx('click'); }
  setRally(x: number) { this.holdX = Math.max(CASTLE_X[0] + 120, Math.min(CASTLE_X[1] - 160, x)); this.mode = 'hold'; sfx('click'); }

  towerCost() { return this.towerArchers[0] < MAX_TOWER_ARCHERS ? TOWER_COST[this.towerArchers[0]] : Infinity; }
  buyTowerArcher() {
    const cost = this.towerCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.towerArchers[0]++;
    sfx('coin');
    this.texts.push({ x: CASTLE_X[0] - 60, y: GROUND - 260, text: '🏹+1', life: 1.2, color: '#ffe066', size: 20 });
    return true;
  }

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
    this.rush = Math.max(0, this.rush - dt);
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
    if (!this.rage && this.castleHp[0] > 0 && this.castleHp[0] / this.castleMax[0] < 0.3) { this.rage = true; this.ev.onRage?.(); }
    this.checkLastStand();
    this.perfectFx = Math.max(0, this.perfectFx - dt);
    this.bondT -= dt;
    if (this.bondT <= 0) { this.bondT = 0.5; this.updateBonds(); }
    this.updateWell(dt);
    this.updateDrops(dt);
    if (this.repeat.size && this.queue.length < 2) { // auto-train: cycle through the units set to repeat
      const ids = [...this.repeat];
      for (let k = 0; k < ids.length; k++) { const id = ids[(this.repeatIdx + k) % ids.length]; if (this.canTrain(id)) { this.train(id); this.repeatIdx = (this.repeatIdx + k + 1) % ids.length; break; } }
    }
    this.rushNext -= dt;
    if (this.rushNext <= 0) { this.rush = 12; this.rushNext = 80 + Math.random() * 50; this.ev.onRush?.(); }
    for (const e of this.fx) e.life -= dt;
    if (this.fx.length) this.fx = this.fx.filter((e) => e.life > 0);
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
    if (this.multi) this.runWar(dt);

    this.auras = this.units.filter((u) => u.def.aura && !u.dead);
    for (const u of this.units) {
      if (u.dead) { u.dead += dt; continue; }
      u.cd -= dt;
      u.calm += dt;
      if (u.def.charge && u.calm > 2.5) u.chargeReady = true;
      u.attacking = Math.max(0, u.attacking - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.healFx = Math.max(0, u.healFx - dt);
      if (u.slow > 0) u.slow -= dt;
      if (u.stun > 0) { u.stun -= dt; u.moving = false; u.attacking = 0; continue; }
      if (u.def.stomp) {
        u.stompCd -= dt;
        const st = u.def.stomp;
        if (u.stompCd <= 0 && this.units.some((v) => this.hostile(u, v) && !v.dead && !v.def.flying && Math.abs(v.x - u.x) < st.radius)) {
          u.stompCd = st.every; u.attacking = 0.3;
          this.shake = Math.min(0.8, this.shake + 0.35); sfx('boom');
          for (let i = 0; i < 18; i++) this.dust(u.x + (Math.random() - 0.5) * st.radius * 1.6, GROUND - 4, '#c9b28a', 5 + Math.random() * 6);
          const m = this.statOf(u);
          for (const v of this.units) if (this.hostile(u, v) && !v.dead && !v.def.flying && Math.abs(v.x - u.x) < st.radius) { this.applyDamage(v, st.dmg * m, true, u); if (!v.def.boss) v.stun = Math.max(v.stun, st.stun); }
        }
      }
      if (u.def.healAura) { // royal pulse: heals every nearby ally
        u.auraCd -= dt;
        if (u.auraCd <= 0) {
          u.auraCd = u.def.healAura.every;
          for (const v of this.units) if (v.side === u.side && !this.hostile(u, v) && !v.dead && Math.abs(v.x - u.x) < u.def.healAura.radius && v.hp < v.maxHp) { v.hp = Math.min(v.maxHp, v.hp + v.maxHp * u.def.healAura.pct); v.healFx = 1; }
          this.fx.push({ kind: 'spark', x: u.x, y: GROUND - 20, f: 1, life: 0.5, max: 0.5 });
          for (let i = 0; i < 10; i++) this.dust(u.x + (Math.random() - 0.5) * u.def.healAura.radius * 1.6, GROUND - 10 - Math.random() * 40, '#ffe27a', 4);
        }
      }
      if (u.def.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.def.regen * (u.maxHp / u.def.hp) * dt);
      if (u.def.summon) {
        u.summonCd -= dt;
        if (u.summonCd <= 0) {
          u.summonCd = u.def.summon.every;
          if (this.armyCount(u.side) < MAX_ARMY) {
            const m = this.spawn(u.def.summon.unit, u.side, this.multi ? this.statOf(u) : u.side === 1 ? this.enemyStat : 1, u.nation);
            m.x = u.x + this.facing(u) * 20; m.road = u.road;
            for (let i = 0; i < 6; i++) this.dust(m.x, GROUND - 10, '#7a6a55', 4);
          }
        }
      }
      u.moving = false;
      this.stepDt = dt;
      const x0 = u.x;
      if (u.def.miner && u !== this.controlled) this.updateMiner(u, dt);
      else if (u.def.heal || u.def.support) this.updateSupport(u, dt);
      else this.updateFighter(u, dt);
      u.lastDx = u.x - x0;
      if (this.multi) u.face = Math.abs(u.lastDx) > 0.01 ? Math.sign(u.lastDx) : this.facing(u);
      if (u.moving) u.anim += dt * (u.def.speed / 9);
      else if (u.def.flying) u.anim += dt * 6;
    }
    this.updateTowers(dt);
    this.updateProjectiles(dt);

    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const bo of this.bolts) bo.life -= dt;
    this.bolts = this.bolts.filter((bo) => bo.life > 0);
    for (const t of this.texts) { t.y -= 30 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.units = this.units.filter((u) => !u.dead || u.dead < 1.2);
    if (this.controlled?.dead) this.controlled = null;

    if (this.multi) this.checkWar();
    else if (this.level.winAfter && this.time >= this.level.winAfter && this.castleHp[0] > 0) this.finish(true);
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
      const nu = this.spawn(item.id, 0);
      if (nu.def.hero || nu.def.premium) { // legendary entrance: light pillar + shockwave
        this.fx.push({ kind: 'pillar', x: nu.x, y: GROUND, f: 1, life: 1, max: 1 }, { kind: 'ring', x: nu.x, y: GROUND, f: 1, life: 0.7, max: 0.7 });
        this.shake = Math.min(0.6, this.shake + 0.3); sfx('rank');
        for (const v of this.units) if (v.side === 1 && !v.dead && !v.def.boss && Math.abs(v.x - nu.x) < 160) v.x += 30;
      }
      const id = (this.roles[item.id] ?? item.id) as UnitId;
      this.producedCounts[id] = (this.producedCounts[id] ?? 0) + 1;
      this.stats.trained++;
      this.ev.onUnitTrained(id);
    } else {
      this.spawn(item.id, 1, this.enemyStat);
    }
  }

  private finish(win: boolean) {
    this.over = true;
    this.finale = 1.6; this.finaleX = CASTLE_X[win ? 1 : 0];
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
      // Horde card: free recruits of your cheapest fighter every wave.
      if (this.cards.horde) {
        const cheapest = this.roster.filter((id) => !UNITS[id].miner && this.isAllowed(id)).sort((a, z) => this.costOf(a) - this.costOf(z))[0];
        for (let k = 0; k < this.cards.horde && cheapest && this.armyCount() < MAX_ARMY; k++) { const u = this.spawn(cheapest, 0); u.x += k * 10; }
      }
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

  /**
   * The commander plans its next purchase: a varied army (types it has few of
   * score higher), counters to the player's army on medium/hard, and it saves
   * gold for expensive units instead of always buying the cheapest.
   */
  private chooseTarget(ai: 1 | 2 | 3): EnemyId | null {
    const raw = this.level.ai!.pool.filter((u) => !UNITS[u].miner);
    if (!raw.length) return null;
    const weight = new Map<EnemyId, number>();
    for (const u of raw) weight.set(u, (weight.get(u) ?? 0) + 1);
    const own = new Map<EnemyId, number>();
    for (const u of this.units) if (u.side === 1 && !u.dead) own.set(u.def.id, (own.get(u.def.id) ?? 0) + 1);
    for (const q of this.equeue) own.set(q.id, (own.get(q.id) ?? 0) + 1);
    const mine = this.playerArmy.filter((u) => !u.def.miner);
    const flyers = mine.filter((u) => u.def.flying).length;
    const ranged = mine.filter((u) => u.def.ranged).length;
    const fast = mine.filter((u) => u.def.charge || u.def.speed >= 95).length;
    const tanks = mine.filter((u) => u.def.hp >= 500).length;
    const n = Math.max(1, mine.length);
    const scores: [EnemyId, number][] = [];
    for (const [id, w] of weight) {
      const d = UNITS[id];
      let sc = w / (1 + (own.get(id) ?? 0) * 0.8); // variety
      if (ai >= 2 && mine.length) {
        let fit = 0;
        if (flyers / n > 0.2 && (d.ranged || d.flying)) fit += 1.5;
        if (ranged / n > 0.35 && (d.speed >= 90 || d.charge || d.dodge || d.flying)) fit += 1.2;
        if (fast / n > 0.25 && (d.hp >= 300 || (d.bonusVs ?? []).some((b) => mine.some((m) => m.def.id === b)))) fit += 1.2;
        if (tanks / n > 0.25 && (d.ranged || d.splash || d.crit)) fit += 1.2;
        if ((d.bonusVs ?? []).some((b) => mine.some((m) => m.def.id === b))) fit += 0.8;
        sc *= 1 + fit * (ai === 3 ? 1.6 : 1);
      }
      if (ai === 1 && costOf(id) > this.egold + 60) sc *= 0.35; // easy: rarely saves up
      scores.push([id, sc]);
    }
    const total = scores.reduce((a, [, v]) => a + v, 0);
    let r = Math.random() * total;
    for (const [id, v] of scores) { r -= v; if (r <= 0) return id; }
    return scores[scores.length - 1][0];
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
      this.egold -= 50; this.equeue.push({ id: A.miner ?? 'miner', left: UNITS.miner.train });
    } else if (this.equeue.length < 2 && this.armyCount(1) < MAX_ARMY) {
      if (!this.aiTarget) this.aiTarget = this.chooseTarget(ai);
      let pick = this.aiTarget;
      const underAttack = this.playerArmy.some((u) => !u.def.miner && u.x > W * 0.62);
      const ownArmy = this.units.filter((u) => u.side === 1 && !u.dead && !u.def.miner).length;
      if (pick && costOf(pick) > this.egold && (underAttack || ownArmy === 0) && this.egold >= 60) {
        // emergency: something affordable now, keep saving for the plan afterwards
        const cheap = this.level.ai!.pool.filter((u) => !UNITS[u].miner && costOf(u) <= this.egold).sort((a, z) => costOf(z) - costOf(a));
        if (cheap.length) pick = cheap[0];
      }
      if (pick && costOf(pick) <= this.egold) {
        this.egold -= costOf(pick);
        this.equeue.push({ id: pick, left: Math.max(2, UNITS[pick].train || costOf(pick) / 50) });
        if (pick === this.aiTarget) this.aiTarget = null;
      }
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
      if (this.units.some((u) => u.side === 0 && u.def.miner && !u.dead)) for (const u of fast) u.raid = true;
    }
    // Smart commanders pull miners into the fort when raiders reach the mine.
    if (ai >= 2) {
      const threat = this.playerArmy.some((u) => !u.def.miner && Math.abs(u.x - MINE_X[1]) < 230);
      this.hideMiners[1] = threat;
    }
    // Rich commanders upgrade their mine.
    if (ai >= 2 && this.mineLevel[1] < 3 && this.egold > (ai === 3 ? 450 : 700) && this.time > 50) { this.egold -= MINE_UPGRADE[this.mineLevel[1]]; this.mineLevel[1]++; }
    // Hard AI reinforces its fort with a second archer once it is rich.
    if (ai === 3 && this.towerArchers[1] === 1 && this.egold > 520 && this.time > 70) { this.egold -= 300; this.towerArchers[1] = 2; }
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

  // ---------------- Nations War: several AI nations on one battlefield ----------------
  multi = false;
  cmds: WarCmd[] = [];
  /** who owns each castle slot (towers, splash and castle targeting check hostility against it) */
  castleOwner: { side: Side; nation: number }[] = [{ side: 0, nation: 0 }, { side: 1, nation: 1 }, { side: 1, nation: 1 }];
  private hitBy = -1; // nation behind the hit being resolved (towers, projectiles)
  bossUnit: Unit | null = null;
  private bossSpawned = false;
  bossEnraged = false;

  /** Enemies? Different sides always; in a free-for-all, also different nations on the same side. */
  hostile(a: Unit, b: Unit) {
    if (!(a.side !== b.side || (this.multi && !!this.level.war?.ffa && a.nation !== b.nation))) return false;
    return !this.roadsOn || a.road === b.road || a.def.flying || b.def.flying; // soldiers only meet foes on their own road
  }
  hostileTo(side: Side, nation: number, b: { side: Side; nation: number }) { return side !== b.side || (this.multi && !!this.level.war?.ffa && nation !== b.nation); }
  cmdOf(u: Unit) { return u.nation >= 2 ? this.cmds.find((c) => c.nation === u.nation) : undefined; }
  /** Stat multiplier a unit's own summons and blasts use. */
  private statOf(u: Unit) {
    if (u.nation === 0) return upgradeMult(this.perks.unitLevels[(this.roles[u.def.id] ?? u.def.id) as UnitId] ?? 1);
    return this.cmdOf(u)?.stat ?? (u.side === 1 ? this.enemyStat : 1);
  }
  /** Direction a unit fights in. */
  facing(u: Unit) {
    if (!this.multi) return u.side === 0 ? 1 : -1;
    const tc = this.targetCastle(u);
    return tc >= 0 ? Math.sign(castleX(tc) - u.x) || (u.side === 0 ? 1 : -1) : u.side === 0 ? 1 : -1;
  }
  /** Castle slot a unit is marching on: the opposite fort, or (Nations War) its commander's chosen target. */
  targetCastle(u: Unit): number {
    if (!this.multi) return u.side === 0 ? 1 : 0;
    const alive = (i: number) => this.castleMax[i] > 0 && (this.castleHp[i] > 0 || !isFinite(this.castleHp[i])) && this.hostileTo(u.side, u.nation, this.castleOwner[i])
      && (i !== 2 || !this.roadsOn || u.road === CITADEL_ROAD || u.def.flying); // the citadel stands on the south road
    const cmd = this.cmdOf(u);
    if (cmd && !cmd.ally && cmd.focus >= 0 && alive(cmd.focus)) return cmd.focus;
    let best = -1, bd = Infinity;
    for (const i of [0, 1, 2]) {
      if (!alive(i)) continue;
      const d = Math.abs(castleX(i) - u.x) + ((castleX(i) - u.x) * (u.side === 0 ? 1 : -1) < 0 ? 4000 : 0); // prefer forts ahead
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  private spawnX(nation: number) {
    const cmd = this.cmds.find((c) => c.nation === nation);
    if (!cmd) return CASTLE_X[1] - 40;
    const own = castleX(cmd.castle);
    if (cmd.castle !== 2) return own + (cmd.side === 0 ? 40 : -40);
    const foc = cmd.focus >= 0 ? castleX(cmd.focus) : own - 1;
    return own + Math.sign(foc - own) * 30 + (Math.random() - 0.5) * 20;
  }
  /** Gold for the enemy side: the classic commander, or split between living war commanders. */
  private addEnemyGold(n: number) {
    const live = this.cmds.filter((c) => c.alive && c.side === 1);
    if (!live.length) { this.egold += n; return; }
    for (const c of live) c.gold += n / live.length;
  }

  roadsOn = false;
  roadChoice: 'auto' | 0 | 1 = 'auto'; // where the player's new soldiers march
  private roadFlip = 0;
  /** The role of a nation: the player's army civilization, or the commander's. */
  roleFor(nation: number): NationRole {
    if (nation === 0) return ROLES[this.perks.army ?? 'desert'] ?? ROLES.desert;
    return ROLES[this.cmds.find((c) => c.nation === nation)?.faction ?? 'desert'] ?? ROLES.desert;
  }
  /** Road for a new soldier: the player's choice (or the busier road), a commander's plan, or road 0 outside Nations War. */
  private pickRoad(nation: number, def: UnitDef): number {
    if (!this.roadsOn) return 0;
    const threat = (r: number, sideOf: Side) => this.units.filter((u) => !u.dead && u.side !== sideOf && u.road === r && !u.def.miner).length;
    if (nation === 0) {
      if (def.miner) return 1;
      if (this.roadChoice !== 'auto') return this.roadChoice;
      const a = threat(0, 0), b = threat(1, 0);
      if (a !== b) return a > b ? 0 : 1;
      return (this.roadFlip++) % 2;
    }
    const c = this.cmds.find((k) => k.nation === nation);
    if (!c) return 1;
    if (c.ally) { const a = threat(0, c.side), b = threat(1, c.side); return a === b ? (this.roadFlip++) % 2 : a > b ? 0 : 1; }
    if (this.level.war?.ffa) {
      if (c.castle === 2) return Math.random() < 0.7 ? CITADEL_ROAD : 0; // the citadel guards its own road first
      return c.focus === 2 ? CITADEL_ROAD : c.focus === 0 ? (Math.random() < 0.75 ? 0 : 1) : (this.roadFlip++) % 2;
    }
    return c.road >= 0 ? c.road : (this.roadFlip++) % 2;
  }
  /** A nation power: AI nations use theirs when charged; the player calls the ally's from the HUD. */
  usePower(c: WarCmd) {
    if (!c.alive || c.power < 1) return false;
    const role = this.roleFor(c.nation);
    const foes = this.units.filter((u) => !u.dead && !u.def.miner && this.hostileTo(c.side, c.nation, u));
    const mine = this.units.filter((u) => !u.dead && u.nation === c.nation && !u.def.miner);
    if (role.power !== 'bless' && role.power !== 'rise' && !foes.length) return false;
    c.power = 0;
    const centre = (list: Unit[]) => list.reduce((a, u) => a + u.x, 0) / Math.max(1, list.length);
    switch (role.power) {
      case 'bless':
        for (const u of mine) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3); u.healFx = 1; }
        for (let i = 0; i < 14; i++) this.dust(centre(mine) + (Math.random() - 0.5) * 300, GROUND - 30, '#9dff9a', 4);
        break;
      case 'haunt': {
        const road = [0, 1].sort((a, z) => foes.filter((u) => u.road === z).length - foes.filter((u) => u.road === a).length)[0];
        for (const u of foes) if (!this.roadsOn || u.road === road || u.def.flying) u.slow = 6;
        break;
      }
      case 'rise': {
        const lead = mine.sort((a, z) => this.facing(z) * z.x - this.facing(a) * a.x)[0];
        for (let i = 0; i < 5 && this.units.filter((u) => u.nation === c.nation && !u.dead).length < WAR_ARMY_CAP + 5; i++) {
          const z = this.spawn('zombie', c.side, c.stat, c.nation); z.x = (lead?.x ?? castleX(c.castle)) + (Math.random() - 0.5) * 60; if (lead) z.road = lead.road;
          this.dust(z.x, GROUND - 10, '#7dff5c', 4);
        }
        break;
      }
      case 'barrage': {
        const tx = centre(foes);
        for (let i = 0; i < 9; i++) this.rainFrom(c.side, c.nation, tx - 140 + Math.random() * 280, 45 * c.stat, 50, 'rock', i * 0.12);
        break;
      }
      case 'avalanche': {
        const tx = centre(foes);
        for (const u of foes) if (Math.abs(u.x - tx) < 220 && !u.def.flying) { if (!u.def.boss) u.stun = Math.max(u.stun, 1.6); this.applyDamage(u, 35 * c.stat, true); }
        for (let i = 0; i < 20; i++) this.dust(tx + (Math.random() - 0.5) * 440, GROUND - 40 - Math.random() * 60, '#e8f4ff', 6);
        this.shake = Math.min(1, this.shake + 0.4);
        break;
      }
      default: return false;
    }
    sfx('volley');
    this.ev.onPower?.(c.nation, role.power);
    return true;
  }
  /** Sky strike owned by any side/nation (powers). */
  private rainFrom(side: Side, nation: number, x: number, dmg: number, splash: number, kind: Projectile['kind'], delay = 0) {
    const sx = x + (side === 0 ? -220 : 220), sy = -60 - Math.random() * 120;
    this.projectiles.push({ x: sx, y: sy, vx: 0, vy: 0, sx, sy, tx: x, ty: GROUND - 8, t: -delay, T: 0.8, arc: -20, side, dmg, splash, kind, air: true, nation });
  }

  private initWar(w: WarSpec) {
    this.multi = true;
    this.roadsOn = !!w.roads;
    this.waveIdx = Infinity; // no scripted waves
    w.nations.forEach((n, i) => {
      const nation = i + 2;
      const f = factionById(n.faction);
      this.cmds.push({ nation, side: n.side, castle: n.castle, pool: [...f.pool, f.special], gold: n.startGold, income: n.income * this.diff.income, stat: n.stat * this.diff.stat,
        power: 0.2 + Math.random() * 0.2, road: n.road ?? -1, queue: [], mode: 'defend', think: Math.random(), target: null, focus: -1, alive: true, ally: !!n.ally, color: n.color, faction: n.faction, attackSize: 5 + Math.floor(Math.random() * 3), focusT: 0 });
      if (n.castle >= 1) this.castleOwner[n.castle] = { side: n.side, nation };
    });
    if (this.castleMax[2] > 0) this.towerArchers[2] = (this.level.towerDmg ?? 0) > 0 ? 1 : 0;
  }

  /** Each AI nation earns, trains, chooses a target and decides to attack or defend. */
  private runWar(dt: number) {
    const w = this.level.war!;
    if (w.boss && !this.bossSpawned && this.time >= (w.bossAt ?? 40)) {
      this.bossSpawned = true;
      const bc = this.cmds.find((c) => !c.ally && c.side === 1);
      const b = this.spawn(w.boss, 1, (bc?.stat ?? 1) * (w.bossMult ?? 1), bc?.nation ?? 1);
      this.bossUnit = b;
      if (this.roadsOn) b.road = CITADEL_ROAD; // the boss marches down the south road
      if (w.bossDmg) b.dmg *= w.bossDmg;
      this.fx.push({ kind: 'pillar', x: b.x, y: GROUND, f: -1, life: 1.2, max: 1.2 }, { kind: 'ring', x: b.x, y: GROUND, f: -1, life: 0.9, max: 0.9 });
      this.shake = Math.min(1, this.shake + 0.6); sfx('boom');
      this.ev.onBoss?.(w.boss);
    }
    const boss = this.bossUnit;
    if (boss && !boss.dead && !this.bossEnraged && boss.hp < boss.maxHp * 0.5) { // enrage: hits harder and calls a burst of flame
      this.bossEnraged = true; boss.dmg *= 1.35; boss.summonCd = 0; this.shake = Math.min(1, this.shake + 0.5); sfx('boom');
      this.fx.push({ kind: 'ring', x: boss.x, y: GROUND, f: -1, life: 0.9, max: 0.9 });
      this.ev.onBoss?.('enrage' as EnemyId);
    }
    for (const c of this.cmds) {
      if (!c.alive) continue;
      c.power = Math.min(1, c.power + dt / POWER_CHARGE);
      if (c.power >= 1 && !c.ally && this.time > (w.grace ?? 28)) this.usePower(c);
      c.gold += c.income * dt * (this.roleFor(c.nation).gold ?? 1);
      if (c.queue.length) {
        c.queue[0].left -= dt;
        if (c.queue[0].left <= 0) { const it = c.queue.shift()!; this.spawn(it.id, c.side, c.stat, c.nation); }
      }
      c.think -= dt;
      if (c.think > 0) continue;
      c.think = 0.9;
      const mine = this.units.filter((u) => u.nation === c.nation && !u.dead);
      // buy: a varied army, saving for the planned unit
      if (c.queue.length < 2 && mine.length < WAR_ARMY_CAP) {
        if (!c.target) {
          const own = new Map<EnemyId, number>();
          for (const u of mine) own.set(u.def.id, (own.get(u.def.id) ?? 0) + 1);
          const opts = c.pool.filter((id) => !UNITS[id].miner);
          const sc = opts.map((id) => 1 / (1 + (own.get(id) ?? 0) * 0.7));
          let r = Math.random() * sc.reduce((a, b) => a + b, 0);
          c.target = opts[opts.length - 1];
          for (let i = 0; i < opts.length; i++) { r -= sc[i]; if (r <= 0) { c.target = opts[i]; break; } }
        }
        let pick = c.target;
        if (pick && costOf(pick) > c.gold && (mine.length < 4 || c.gold < costOf(pick) * 0.4) && c.gold >= 50) pick = c.pool.filter((id) => costOf(id) <= c.gold).sort((a, z) => costOf(z) - costOf(a))[0] ?? pick;
        const cheap = this.roleFor(c.nation).cheap ?? 1;
        if (pick && costOf(pick) * cheap <= c.gold) {
          c.gold -= costOf(pick) * cheap;
          c.queue.push({ id: pick, left: Math.max(2, UNITS[pick].train || costOf(pick) / 50) });
          if (pick === c.target) c.target = null;
        }
      }
      if (c.ally) { c.mode = this.mode; continue; } // allies follow your orders
      if (w.timeLimit) { c.mode = 'attack'; c.focus = 0; continue; } // Boss Blitz: the boss and his escort charge at once
      // target: the weakest hostile fort (re-chosen every 20 s in a free-for-all)
      c.focusT -= 0.9;
      const live = (i: number) => this.castleMax[i] > 0 && (this.castleHp[i] > 0 || !isFinite(this.castleHp[i])) && this.hostileTo(c.side, c.nation, this.castleOwner[i]);
      if (c.focus < 0 || !live(c.focus) || c.focusT <= 0) {
        c.focusT = 20;
        const opts = [0, 1, 2].filter(live);
        c.focus = opts.sort((a, z) => this.castleHp[a] / this.castleMax[a] + Math.abs(castleX(a) - castleX(c.castle)) / W - (this.castleHp[z] / this.castleMax[z] + Math.abs(castleX(z) - castleX(c.castle)) / W))[0] ?? -1;
      }
      const army = mine.filter((u) => !u.def.miner);
      const home = castleX(c.castle);
      const threat = this.units.filter((u) => !u.dead && this.hostileTo(c.side, c.nation, u) && Math.abs(u.x - home) < 520).length;
      if (this.time < (w.grace ?? 28)) c.mode = 'defend';
      else if (threat > army.length * 1.2 && threat >= 3) c.mode = 'defend';
      else if (c.mode !== 'attack' && army.length >= c.attackSize) c.mode = 'attack';
      else if (c.mode === 'attack' && army.length < 3) { c.mode = 'defend'; c.attackSize = 5 + Math.floor(Math.random() * 4); }
    }
  }

  /** Nations War end conditions: your fort falls, a nation is eliminated, the last fort or the boss falls. */
  private checkWar() {
    const w = this.level.war!;
    if (this.castleHp[0] <= 0) { this.finish(false); return; }
    if (w.timeLimit && this.time >= w.timeLimit && !(this.bossUnit?.dead)) { this.finish(false); return; } // Boss Blitz: out of time
    for (const slot of [1, 2]) {
      if (this.castleMax[slot] <= 0 || !isFinite(this.castleHp[slot]) || this.castleHp[slot] > 0) continue;
      for (const c of this.cmds) {
        if (!c.alive || c.castle !== slot) continue;
        c.alive = false; c.queue = [];
        for (const u of this.units) if (u.nation === c.nation && !u.dead) { u.dead = 0.001; this.dust(u.x, GROUND - 20, '#d9c08a', 5); }
        this.shake = Math.min(1, this.shake + 0.5); sfx('boom');
        this.ev.onEliminated?.(c.nation);
      }
    }
    if (w.boss) { if (this.bossSpawned && this.bossUnit?.dead) this.finish(true); return; }
    const foesLeft = [1, 2].some((i) => this.castleMax[i] > 0 && this.castleHp[i] > 0 && this.hostileTo(0, 0, this.castleOwner[i]));
    if (!foesLeft) this.finish(true);
  }

  /** Melee ground units can't reach flying units. */
  canHit(a: Unit, b: Unit) {
    if (b.hidden) return false;
    return !b.def.flying || !!a.def.ranged || !!a.def.flying;
  }

  private nearestFoe(u: Unit, maxDist: number, minersOnly = false) {
    let best: Unit | null = null;
    let bd = maxDist;
    for (const o of this.units) {
      if (!this.hostile(u, o) || o.dead || !this.canHit(u, o)) continue;
      if (minersOnly && o.def.id !== 'miner') continue;
      const d = Math.abs(o.x - u.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** Miners dig at the mine, then haul the sack back to the fort (exposed on the way). */
  private updateMiner(u: Unit, dt: number) {
    const side = u.side;
    const door = CASTLE_X[side] + (side === 0 ? 30 : -30);
    const walk = (to: number) => { if (Math.abs(u.x - to) > 4) { u.x += Math.sign(to - u.x) * u.def.speed * dt; u.moving = true; return false; } return true; };
    if (this.hideMiners[side]) { // shelter inside the fort until the coast is clear
      if (walk(door)) u.hidden = true;
      return;
    }
    u.hidden = false;
    u.tripT += dt;
    const rate = (MINER_GOLD / MINER_INTERVAL) * this.goldMult(side) * (u.def.mineMult ?? 1);
    if (u.carry > 0) { // hauling the sack home
      if (walk(door)) {
        const g = Math.round(u.carry);
        if (side === 0) { this.gold += g; this.stats.mined += g; this.texts.push({ x: u.x, y: GROUND - 60 + u.lane, text: `+${g}`, life: 0.9, color: '#ffd34d' }); }
        else this.egold += g;
        u.carry = 0; u.tripT = 0;
      }
      return;
    }
    const mx = MINE_X[side] + ((u.uid * 37) % 60) - 30;
    if (!walk(mx)) return;
    u.mineTimer += dt;
    if (u.mineTimer % 0.9 < dt) u.attacking = 0.35; // pickaxe swing
    if (u.mineTimer >= 2.6) { // sack full: worth the whole trip's time at the mining rate
      u.mineTimer = 0;
      const tripTime = Math.max(u.tripT, 2.6) + Math.abs(mx - door) / u.def.speed;
      u.carry = rate * tripTime;
    }
  }

  /** Healers and drummers stay just behind the front line. */
  private updateSupport(u: Unit, dt: number) {
    if (u.def.heal && u.cd <= 0) {
      let best: Unit | null = null;
      let worst = 0.98;
      for (const o of this.units) {
        if (o.side !== u.side || this.hostile(u, o) || o.dead || o === u || Math.abs(o.x - u.x) > u.def.range) continue;
        const r = o.hp / o.maxHp;
        if (r < worst) { worst = r; best = o; }
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + u.def.heal! * upgradeMult(this.perks.unitLevels[u.def.id as UnitId] ?? 1));
        best.healFx = 0.6;
        if (this.texts.length < 70) this.texts.push({ x: best.x, y: this.unitY(best) - best.def.height - 26, text: `+${Math.round(u.def.heal! * upgradeMult(this.perks.unitLevels[u.def.id as UnitId] ?? 1))}`, life: 0.7, color: '#7dff9a', size: 13 });
        u.attacking = 0.3;
        u.cd = u.def.cooldown;
      }
    }
    if (u.def.support && u.cd <= 0) { u.attacking = 0.3; u.cd = 0.6; } // drumming
    const dir = this.facing(u);
    const allies = this.units.filter((o) => o.side === u.side && !this.hostile(u, o) && !o.dead && o !== u && o.def.id !== 'miner' && !o.def.heal && !o.def.support);
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
    const cmd = this.cmdOf(u);
    if (cmd && !cmd.ally) { // Nations War commander: positions relative to its own fort and its target
      const own = castleX(cmd.castle), tc = this.targetCastle(u);
      const foc = tc >= 0 ? castleX(tc) : own + (u.side === 0 ? 300 : -300);
      const d = Math.sign(foc - own) || -1;
      if (cmd.mode === 'defend') return own + d * (200 - (back ? 70 : 0) + idx * 8);
      if (cmd.mode === 'hold') return own + (foc - own) * 0.45 - d * (back ? 90 : 0);
      return foc;
    }
    if (u.side === 1) {
      const m = this.level.ai ? this.emode : this.enemyAlert ? 'defend' : 'attack';
      if (m === 'defend') return CASTLE_X[1] - 220 + (back ? 70 : 0) + idx * 8;
      if (m === 'hold') return W / 2 + 80 + (back ? 90 : 0);
      return 0;
    }
    switch (this.mode) {
      case 'defend': return CASTLE_X[0] + 220 - (back ? 70 : 0) - idx * 8;
      case 'hold': return this.holdX - (back ? 90 : 0) - idx * 10;
      case 'attack': return W;
    }
  }

  private speedOf(u: Unit) {
    let s = u.def.speed;
    if (u.side === 1) {
      s *= this.level.mods?.enemySpeed ?? 1;
      if (this.level.region === 'shadow') s *= 1.05;
      if (this.debuff > 0) s *= 0.5;
    } else {
      s *= this.cards.speed; if (this.buff > 0) s *= 1.4;
      if (!u.def.ranged && !u.def.miner) { if (this.formation === 'wedge') s *= 1.12; else if (this.formation === 'wall') s *= 0.82; }
    }
    if (this.bondOf(u) === 'charge') s *= 1.06;
    if (this.multi) { s *= this.roleFor(u.nation).speed ?? 1; if (u.slow > 0) s *= 0.6; }
    for (const a of this.auras) if (a.def.support && a.side === u.side && !this.hostile(a, u) && a !== u && Math.abs(a.x - u.x) < 160) { s *= 1.15; break; }
    return s;
  }

  private rangeOf(u: Unit) {
    if (this.multi && u.def.ranged) { const rr = this.roleFor(u.nation).range ?? 1; if (u.nation !== 0) return u.def.range * rr; return u.def.range * rr * passiveFx.eagle(this.perks.passives.eagle) * (this.formation === 'skirmish' ? 1.15 : 1); }
    if (u.side !== 0 || u.nation !== 0 || !u.def.ranged) return u.def.range;
    return u.def.range * passiveFx.eagle(this.perks.passives.eagle) * (this.formation === 'skirmish' ? 1.15 : 1);
  }

  private updateFighter(u: Unit, dt: number) {
    const dir = u.side === 0 ? 1 : -1;
    const def = u.def;
    const range = this.rangeOf(u);
    const isCtrl = u === this.controlled;
    const dmgMult = 1;
    const foeSide = this.targetCastle(u);
    const enemyCastle = foeSide >= 0 ? castleX(foeSide) : -99999;

    if (isCtrl) {
      if (this.ctrlDir) {
        u.x = Math.max(CASTLE_X[0], Math.min(CASTLE_X[1], u.x + this.ctrlDir * this.speedOf(u) * 1.15 * dt));
        u.moving = true;
      }
      if (this.ctrlAttack && u.cd <= 0) {
        const foe = this.nearestFoe(u, range + 8);
        u.attacking = 0.3; u.calm = 0;
        u.cd = def.cooldown * 0.85;
        let dmgMult = CONTROL_BONUS;
        if (this.perfectArmed) { // tapped right as the weapon came ready
          this.perfectArmed = false;
          dmgMult *= PERFECT_BONUS; this.perfectFx = 0.6; this.stats.perfect++;
          this.texts.push({ x: u.x, y: this.unitY(u) - u.def.height - 34, text: '✦ ×1.6', life: 0.8, color: '#7df9ff', size: 17 });
          this.ev.onPerfect?.();
        }
        if (def.ranged) { if (foe) this.shoot(u, foe, dmgMult); else if (foeSide >= 0 && Math.abs(enemyCastle - u.x) < range + 50) this.shootCastle(u, foeSide, dmgMult); }
        else if (foe) this.hit(u, foe, dmgMult);
        else if (foeSide >= 0 && Math.abs(enemyCastle - u.x) < range + 50) this.hitCastle(u, foeSide, dmgMult);
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

    const cmdU = this.cmdOf(u);
    const defending = cmdU && !cmdU.ally ? cmdU.mode === 'defend' : u.side === 0 ? this.mode === 'defend' : this.level.ai ? this.emode === 'defend' : false;
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
    const attackingNow = cmdU && !cmdU.ally ? cmdU.mode === 'attack' : u.side === 1 ? (this.level.ai ? this.emode === 'attack' : true) : this.mode === 'attack';
    if (foeSide >= 0 && castleDist <= range + 50 && attackingNow && isFinite(this.castleHp[foeSide])) {
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
    if (u.def.flying || u === this.controlled || u.def.miner) { u.x += dx; return; }
    const dir = Math.sign(dx);
    for (const o of this.units) {
      if (o === u || o.dead || o.side !== u.side || this.hostile(u, o) || o.road !== u.road || o.def.flying || o.def.miner) continue;
      const ahead = (o.x - u.x) * dir;
      const minD = Math.min(22, (u.def.height + o.def.height) * 0.14);
      if (ahead <= 0 || ahead > minD || Math.abs(o.lane - u.lane) > 8) continue;
      if (o.lastDx * dir > 0.01) continue; // ally walking the same way: just follow
      // Blocked by a standing ally: slide into a free lane and squeeze past
      // (slower) instead of forming a wall the back ranks can't cross.
      const side = u.lane >= o.lane ? 1 : -1;
      const nl = u.lane + side * 50 * this.stepDt;
      u.lane = Math.abs(nl) <= 18 ? nl : u.lane - side * 50 * this.stepDt;
      u.x += dx * 0.6;
      return;
    }
    u.x += dx;
  }

  private updateTowers(dt: number) {
    for (const slot of [0, 1, 2]) {
      const own = this.castleOwner[slot];
      const side = own.side;
      this.towerShot[slot] = Math.max(0, this.towerShot[slot] - dt);
      const n = this.towerArchers[slot];
      if (!n || (slot >= 1 && (!isFinite(this.castleHp[slot]) || this.castleHp[slot] <= 0))) continue;
      const dmg = slot === 0 ? 20 * passiveFx.towers(this.perks.passives.towers) : (this.level.towerDmg ?? 0) * this.diff.tower;
      if (!dmg) continue;
      this.towerCd[slot] -= dt;
      if (this.towerCd[slot] > 0) continue;
      const fx = slot === 2 ? CITADEL_X : CASTLE_X[side] + (side === 0 ? -60 : 60);
      const range = slot === 2 ? 380 : TOWER_RANGE[side];
      const foes = this.units.filter((o) => this.hostileTo(own.side, own.nation, o) && !o.dead && !o.hidden && Math.abs(o.x - fx) < range).sort((a, z) => Math.abs(a.x - fx) - Math.abs(z.x - fx));
      if (!foes.length) { this.towerCd[slot] = 0.25; continue; }
      this.towerCd[slot] = side === 0 ? (this.rage ? 0.45 : 1.0) : 1.4;
      this.towerShot[slot] = 0.3;
      // Each fort archer looses an arrow, spreading over the closest targets.
      for (let k = 0; k < n; k++) {
        const t = foes[k % foes.length];
        const sx = fx + (side === 0 ? 1 : -1) * (k === 0 ? -30 : k === 1 ? 10 : 55), sy = GROUND - (k === 0 ? 250 : 180);
        const d = Math.abs(t.x - sx);
        this.projectiles.push({ x: sx, y: sy, vx: 0, vy: 0, sx, sy, tx: t.x, ty: this.unitY(t) - t.def.height * 0.5, t: -k * 0.12, T: Math.max(0.3, d / 650), arc: 25 + d * 0.06, side, dmg, splash: 0, kind: 'arrow', target: t, air: true, nation: own.nation });
      }
    }
  }

  /** Every outgoing-damage modifier in one place. */
  private outMult(u: Unit, target?: UnitDef) {
    let m = target && u.def.bonusVs?.includes(target.id) ? COUNTER_BONUS : 1;
    if (u.side === 0) {
      m *= this.cards.dmg; if (this.buff > 0) m *= 1.25;
      if (!u.def.ranged) { if (this.formation === 'wedge') m *= 1.1; else if (this.formation === 'skirmish') m *= 0.9; }
    }
    const bond = this.bondOf(u);
    if (bond === 'volley' || bond === 'charge') m *= 1.06;
    else if (bond === 'brothers') m *= 1.05;
    if (u.side === 1 && this.debuff > 0) m *= 0.7;
    for (const h of this.auras) if (h.side === u.side && !this.hostile(h, u) && h !== u && Math.abs(h.x - u.x) < 150) { m *= 1 + h.def.aura!; break; }
    return m;
  }

  private hit(u: Unit, foe: Unit, mult: number) {
    let dmg = u.dmg * mult * this.outMult(u, foe.def);
    this.hitBy = u.nation;
    if (u.chargeReady && u.def.charge) { dmg *= 2; u.chargeReady = false; this.dust(foe.x, GROUND - 6, '#e8cf96', 6); }
    if (u.def.crit && Math.random() < u.def.crit) {
      dmg *= 2.5;
      this.texts.push({ x: foe.x, y: this.unitY(foe) - foe.def.height - 10, text: '✦', life: 0.6, color: '#ff6b3d' });
    }
    if (u.def.splash) {
      for (const o of this.units) if (this.hostile(u, o) && !o.dead && this.canHit(u, o) && Math.abs(o.x - foe.x) < u.def.splash) this.applyDamage(o, o === foe ? dmg : dmg * 0.5, o !== foe, u);
    } else this.applyDamage(foe, dmg, false, u);
    // A little knockback sells the impact.
    if (!foe.def.boss && foe.def.hp < 700) foe.x += this.facing(u) * (u.def.hp > 1000 ? 10 : 3);
    sfx('hit');
    const fy = this.unitY(foe) - foe.def.height * 0.6;
    if (this.fx.length < 60) {
      this.fx.push({ kind: 'slash', x: (u.x + foe.x) / 2, y: fy, f: this.facing(u), life: 0.18, max: 0.18 });
      this.fx.push({ kind: 'spark', x: foe.x, y: fy, f: this.facing(u), life: 0.22, max: 0.22 });
    }
  }

  /** Ground line a unit stands on (its road's offset plus its lane jitter). */
  groundY(u: Unit) { return GROUND + u.lane + (this.roadsOn ? ROAD_Y[u.road] : 0); }
  unitY(u: Unit) {
    return this.groundY(u) - (u.def.flying ? FLY_HEIGHT + Math.sin(u.anim * 0.6) * 8 : 0);
  }

  private hitCastle(u: Unit, side: number, mult: number) {
    if (!isFinite(this.castleHp[side])) return;
    const dmg = u.dmg * mult * this.outMult(u) * (u.def.id === 'catapult' ? 2 : 1) * (this.multi ? this.roleFor(u.nation).fort ?? 1 : 1);
    this.castleHp[side] = Math.max(0, this.castleHp[side] - dmg);
    this.shake = Math.min(0.4, this.shake + 0.05);
    sfx('hit');
    this.dust(castleX(side) + (side === 0 ? 50 : side === 1 ? -50 : Math.sign(u.x - CITADEL_X) * 50), GROUND - 40 - Math.random() * 80, '#b9925a', 5);
  }

  private projKind(u: Unit): Projectile['kind'] {
    const id = u.def.id;
    return id === 'catapult' ? 'rock' : id === 'fire' || id === 'dragon' || id === 'firebird' ? 'fire' : id === 'crossbow' ? 'bolt' : ['sandmage', 'boss', 'djinn', 'genie', 'phoenix', 'banshee', 'necromancer', 'lich', 'thunderlord', 'elfqueen', 'poltergeist', 'pharaoh', 'valkyrie'].includes(id) ? (id === 'phoenix' ? 'fire' : 'magic') : 'arrow';
  }

  /** Guided arc: the shot keeps tracking the target, so moving units are hit. */
  private shoot(u: Unit, foe: Unit, mult: number) {
    const kind = this.projKind(u);
    const sy = this.unitY(u) - u.def.height * 0.8;
    const ty = this.unitY(foe) - foe.def.height * 0.5;
    const d = Math.abs(foe.x - u.x);
    const T = kind === 'bolt' ? Math.max(0.2, d / 900) : Math.max(0.3, d / 560);
    const arc = kind === 'bolt' ? 8 : kind === 'rock' ? 90 + d * 0.15 : 25 + d * 0.12;
    this.projectiles.push({ x: u.x, y: sy, vx: 0, vy: 0, sx: u.x, sy, tx: foe.x, ty, t: 0, T, arc, side: u.side, dmg: u.dmg * mult * this.outMult(u), splash: u.def.splash ?? 0, kind, bonusVs: u.def.bonusVs, target: kind === 'rock' ? undefined : foe, src: u, air: kind !== 'rock', pierce: u.def.pierce, nation: u.nation, road: this.roadsOn && !u.def.flying ? u.road : undefined });
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private shootCastle(u: Unit, side: number, mult: number) {
    const kind = this.projKind(u);
    const sy = this.unitY(u) - u.def.height * 0.8;
    const tx = castleX(side) + (side === 0 ? 40 : side === 1 ? -40 : Math.sign(u.x - CITADEL_X) * 40);
    const d = Math.abs(tx - u.x);
    this.projectiles.push({ x: u.x, y: sy, vx: 0, vy: 0, sx: u.x, sy, tx, ty: GROUND - 70, t: 0, T: Math.max(0.3, d / 560), arc: kind === 'bolt' ? 8 : 40 + d * 0.15, side: u.side, dmg: u.dmg * mult * this.outMult(u), splash: u.def.splash ?? 0, kind, castle: side, src: u, air: false, nation: u.nation, fortMult: this.multi ? this.roleFor(u.nation).fort ?? 1 : 1 });
    sfx(kind === 'rock' ? 'throw' : 'arrow');
  }

  private impact(p: Projectile) {
    const foeSide: Side = p.side === 0 ? 1 : 0;
    const pn = p.nation ?? p.side;
    const isFoe = (o: Unit) => this.hostileTo(p.side, pn, o) && (p.road === undefined || !this.roadsOn || o.road === p.road || o.def.flying);
    this.hitBy = pn;
    const x = p.x;
    if (p.castle !== undefined) {
      if (isFinite(this.castleHp[p.castle])) {
        this.castleHp[p.castle] = Math.max(0, this.castleHp[p.castle] - p.dmg * (p.kind === 'rock' ? 2 : 0.6) * (p.fortMult ?? 1));
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
    if (p.pierce) { // the arrow passes through everyone along its flight
      const lo = Math.min(p.sx, x), hi = Math.max(p.sx, x);
      for (const o of this.units) if (isFoe(o) && !o.dead && o !== primary && o.x >= lo && o.x <= hi) this.applyDamage(o, p.dmg * 0.7, true, p.src);
      for (let i = 0; i < 6; i++) this.dust(lo + Math.random() * (hi - lo), GROUND - 40, '#cfe8ff', 3);
    }
    const ch = p.src?.def.chain;
    if (ch && primary) { // lightning leaps to nearby foes and stuns them
      let from = primary;
      const hit = new Set<Unit>([primary]);
      if (!primary.def.boss) primary.stun = Math.max(primary.stun, ch.stun);
      for (let j = 1; j < ch.count; j++) {
        let next: Unit | null = null, bd = 190;
        for (const o of this.units) if (isFoe(o) && !o.dead && !hit.has(o)) { const d = Math.abs(o.x - from.x); if (d < bd) { bd = d; next = o; } }
        if (!next) break;
        this.bolts.push({ x1: from.x, y1: this.unitY(from) - from.def.height * 0.5, x2: next.x, y2: this.unitY(next) - next.def.height * 0.5, life: 0.25 });
        this.applyDamage(next, p.dmg * 0.75, true, p.src);
        if (!next.def.boss) next.stun = Math.max(next.stun, ch.stun);
        hit.add(next); from = next;
      }
      sfx('volley');
    }
    if (!primary || p.splash) {
      const radius = p.splash || 20;
      for (const o of this.units) {
        if (!isFoe(o) || o.dead || o === primary) continue;
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
    const hitSlot = this.multi ? [0, 1, 2].find((i) => this.castleMax[i] > 0 && this.hostileTo(p.side, pn, this.castleOwner[i]) && Math.abs(castleX(i) - x) < 70) ?? -1 : foeSide;
    if (!primary && hitSlot >= 0 && Math.abs(castleX(hitSlot) - x) < 70 && isFinite(this.castleHp[hitSlot]) && (p.kind === 'rock' || p.kind === 'meteor')) {
      this.castleHp[hitSlot] = Math.max(0, this.castleHp[hitSlot] - p.dmg);
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
    const dodge = (o.def.dodge ?? 0) + (this.multi ? this.roleFor(o.nation).dodge ?? 0 : 0);
    if (dodge && !isSplash && Math.random() < dodge) {
      this.texts.push({ x: o.x, y: this.unitY(o) - o.def.height - 8, text: '~', life: 0.5, color: '#fff' });
      return;
    }
    dmg *= this.takenMult(o);
    const dealt = Math.min(o.hp, dmg);
    o.hp -= dmg;
    o.hitFlash = 0.12;
    this.damageNumber(o, dealt, isSplash);
    if (src?.side === 0 && src.nation === 0) this.stats.damage[src.def.id as UnitId] = (this.stats.damage[src.def.id as UnitId] ?? 0) + dealt;
    if (src?.def.lifesteal && !src.dead && dealt > 0) { src.hp = Math.min(src.maxHp, src.hp + dealt * src.def.lifesteal); src.healFx = Math.max(src.healFx, 0.3); }
    if (o.hp <= 0 && !o.dead) {
      o.dead = 0.001;
      const killer = src?.nation ?? this.hitBy;
      if (o.side === 1 && (!this.multi || killer === 0)) {
        this.stats.kills++;
        this.streak = this.streakT > 0 ? this.streak + 1 : 1;
        this.streakT = 2.8;
        if ([3, 5, 8, 12].includes(this.streak)) { const bonus = this.streak * 15; this.gold += bonus; this.ev.onStreak?.(this.streak, bonus); }
        if (o.def.miner) this.stats.enemyMinersKilled++;
        if (o.def.boss) this.stats.bossKills++;
        const bounty = Math.round((o.def.boss ? 200 : 8 + o.def.hp / 25) * (this.level.mods?.goldMult ?? 1));
        this.gold += bounty;
        this.texts.push({ x: o.x, y: GROUND - 70, text: `+${bounty}`, life: 1, color: '#ffd34d' });
      } else if (o.side === 0) {
        if (o.nation === 0) this.stats.lost++;
        const bounty = Math.round(4 + o.def.hp / 40); // the enemy earns a small bounty too
        const kc = this.multi ? this.cmds.find((c) => c.nation === killer) : undefined;
        if (kc) kc.gold += bounty; else this.egold += bounty;
      } else { // Nations War: one AI nation killed another's soldier
        const kc = this.cmds.find((c) => c.nation === killer);
        if (kc) kc.gold += Math.round(4 + o.def.hp / 40);
      }
      if (src && !src.dead && !src.def.boss && src.rank < MAX_RANK) {
        src.kills++;
        if (src.kills >= RANK_KILLS[src.rank]) {
          src.rank++;
          src.maxHp *= 1.15; src.dmg *= 1.15;
          // Promotion heals: ★ 30%, ★★ 50%, ★★★ full.
          const healed = Math.min(src.maxHp - src.hp, src.maxHp * RANK_HEAL[src.rank - 1]);
          src.hp += healed; src.healFx = 1.2;
          this.texts.push({ x: src.x, y: this.unitY(src) - src.def.height - 16, text: '★'.repeat(src.rank), life: 1.3, color: '#ffe066', size: 22 });
          if (healed > 1) this.texts.push({ x: src.x, y: this.unitY(src) - src.def.height - 36, text: `+${Math.round(healed)}`, life: 1.1, color: '#7dff9a', size: 16 });
          this.ev.onRank?.(src);
        }
      }
      for (let i = 0; i < 8; i++) this.dust(o.x, this.unitY(o) - o.def.height * 0.5, o.def.id === 'ghost' || o.def.id === 'djinn' ? '#9fd8ff' : '#f0dcae', 3 + Math.random() * 4);
      // A lich nearby raises the fallen as a zombie on its own side.
      if (!o.def.boss && !o.def.miner) {
        const lich = this.units.find((v) => v.def.raiseDead && !v.dead && this.hostile(v, o) && Math.abs(v.x - o.x) < 280);
        if (lich && this.armyCount(lich.side) < MAX_ARMY) {
          const z = this.spawn(lich.def.raiseDead!, lich.side, this.multi ? this.statOf(lich) : lich.side === 1 ? this.enemyStat : 1, lich.nation);
          z.x = o.x; z.lane = o.lane; z.road = o.road;
          for (let i = 0; i < 8; i++) this.dust(o.x, GROUND - 10, '#7dff5c', 4);
        }
      }
      if (o.def.explode) { // bloater bursts and hurts everyone nearby on the other side
        const e = o.def.explode;
        for (let i = 0; i < 16; i++) this.dust(o.x, GROUND - 20, i % 2 ? '#8fbf3a' : '#c6e070', 5 + Math.random() * 6);
        this.shake = Math.min(0.6, this.shake + 0.25); sfx('boom');
        for (const v of this.units) if (this.hostile(o, v) && !v.dead && Math.abs(v.x - o.x) < e.radius && !v.def.flying) this.applyDamage(v, e.dmg * (o.side === 1 ? this.enemyStat : 1), true);
      }
    }
  }

  /** Incoming-damage modifiers: formations and defensive bonds. */
  private takenMult(o: Unit) {
    let m = 1;
    if (o.side === 0 && !o.def.miner) { if (this.formation === 'wall') m *= 0.8; else if (this.formation === 'wedge') m *= 1.1; }
    const bond = this.bondOf(o);
    if (bond === 'phalanx') m *= 0.9;
    return m;
  }

  /** Floating damage numbers; rapid hits on the same unit merge into one. */
  private damageNumber(o: Unit, amount: number, small: boolean) {
    if (amount < 0.5) return;
    const t = o.dmgText;
    if (t && t.life > 0.55) { t.value = (t.value ?? 0) + amount; t.text = `-${Math.round(t.value)}`; t.life = Math.max(t.life, 0.8); return; }
    if (this.texts.length > 70) return;
    const nt: FloatText = { x: o.x + (Math.random() - 0.5) * 14, y: this.unitY(o) - o.def.height - 22, text: `-${Math.round(amount)}`, life: 0.9, color: o.side === 0 ? '#ff6b5a' : '#ffffff', size: small ? 13 : 15, value: amount };
    o.dmgText = nt;
    this.texts.push(nt);
  }

  /** Keeps effects animating in slow motion after the fort falls. */
  finaleTick(dt: number) {
    if (this.finale <= 0) return;
    this.finale -= dt;
    const s = dt * 0.3;
    for (const p of this.particles) { p.x += p.vx * s; p.y += p.vy * s; p.vy += 300 * s; p.life -= s; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const u of this.units) if (u.dead) u.dead += s;
    if (Math.random() < 0.5) this.dust(this.finaleX + (Math.random() - 0.5) * 160, GROUND - Math.random() * 160, '#b9925a', 5 + Math.random() * 7);
  }

  dust(x: number, y: number, color: string, size: number) {
    if (this.particles.length > 280) return;
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 160, life: 0.6 + Math.random() * 0.4, max: 1, color, size });
  }

  stars(win: boolean) {
    if (!win) return 0;
    const tl = this.level.war?.timeLimit;
    if (tl) return this.time <= tl * 0.5 ? 3 : this.time <= tl * 0.75 ? 2 : 1; // Boss Blitz: faster = more stars
    let s = 1;
    if (this.castleHp[0] / this.castleMax[0] > 0.5) s++;
    if (this.time < 180) s++;
    return s;
  }
}

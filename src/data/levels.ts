import type { EnemyId, UnitId } from './units';

/** What each unit costs the enemy AI (it buys with gold its own miners dig). */
export const ENEMY_COST: Partial<Record<EnemyId, number>> = {
  miner: 50, sword: 75, bandit: 70, archer: 150, spear: 250, sandmage: 180, camel: 400, cavalry: 350, crossbow: 280, golem: 450, ghost: 200,
  catapult: 600, hyena: 60, vulture: 90, fire: 300, lion: 320, assassin: 350, giant: 700, mummy: 260, skeleton: 80, cobra: 160, boss: 0,
  elfworker: 50, elfarcher: 160, bladedancer: 180, druid: 200, treant: 520, elkrider: 380,
  wisp: 50, wraith: 150, banshee: 200, specter: 300, phantom: 220,
  gravedigger: 50, zombie: 50, runner: 70, bloater: 150, skelarcher: 120, abomination: 520, necromancer: 260,
  dwarfminer: 60, axethrower: 170, shieldwall: 260, berserker: 220, cannon: 600, gyrocopter: 280,
  goblin: 50, goblinspear: 70, ogre: 380, troll: 340, cyclops: 560, frostgiant: 820,
  sprite: 170, moonarcher: 900, poltergeist: 230, soulreaper: 950, ghoul: 240, lich: 900, runepriest: 220, thunderlord: 1000, mammoth: 750, colossus: 1200,
};
export const costOf = (u: EnemyId) => ENEMY_COST[u] ?? 200;

export type RegionId = 'oasis' | 'dunes' | 'mountains' | 'shadow' | 'tombs' | 'forest' | 'graveyard' | 'tundra';

export interface Wave { t: number; unit: EnemyId; count: number; mult?: number; }

export type LevelKind = 'campaign' | 'challenge' | 'survival' | 'daily' | 'conquest' | 'tower';

/** Battle-rule modifiers (challenges and the daily challenge). */
export interface Mods {
  enemySpeed?: number;
  enemyDmg?: number;
  goldMult?: number;
  noMiners?: boolean; // no miners: passive income instead
}

/** The enemy commander: it mines gold and buys units like the player does. */
export interface EnemyAI {
  pool: EnemyId[]; // units it may buy (repeats = higher weight)
  startGold: number;
  maxMiners: number;
  income: number; // mining-rate multiplier
  graceTime: number; // seconds before its first attack
  miner?: EnemyId; // the faction's worker unit (default 'miner')
}

export interface LevelDef {
  index: number; // 1..50
  region: RegionId;
  boss: boolean;
  castleHp: number;
  enemyMult: number; // stat multiplier for enemy units
  waves: Wave[]; // scripted arrivals (bosses, challenge monsters)
  loopAfter: number; // seconds: script repeats from this time with escalation
  reward: number; // base gold
  kind?: LevelKind;
  id?: string;
  allowed?: UnitId[]; // restrict the player's unit bar
  mods?: Mods;
  noCounters?: boolean;
  startGold?: number; // overrides the default 150
  ai?: EnemyAI; // economic enemy (campaign/daily); absent = scripted waves only
  winAfter?: number; // survive this many seconds to win (siege challenge)
  towerDmg?: number; // enemy fort archer strength (0 = no tower)
  enemyColor?: string; // faction colour for the enemy fort and banners
  faction?: string; // enemy civilization (fort style)
}

export const REGIONS: { id: RegionId; from: number; to: number; enemy: EnemyId }[] = [
  { id: 'oasis', from: 1, to: 10, enemy: 'bandit' },
  { id: 'dunes', from: 11, to: 20, enemy: 'sandmage' },
  { id: 'mountains', from: 21, to: 30, enemy: 'golem' },
  { id: 'shadow', from: 31, to: 40, enemy: 'ghost' },
  { id: 'tombs', from: 41, to: 50, enemy: 'mummy' },
  { id: 'forest', from: 51, to: 60, enemy: 'elfarcher' },
  { id: 'tundra', from: 61, to: 70, enemy: 'ogre' },
];
export const LEVEL_COUNT = 70;

export const regionOf = (i: number): RegionId => REGIONS.find((r) => i >= r.from && i <= r.to)!.id;

/** Per-level difficulty factors produced by scripts/tune.ts (1 = untuned). */
export const TUNE: number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 2, 2.6, 2.8, 2.94, 2.53, 2.56, 2.46, 2.46, 2.38, 1.95, 2.36, 2.25, 2.28, 2.1, 2.08, 2, 1.98, 1.98, 1.9, 1.67, 2.05, 1.82, 1.98, 1.85, 1.91, 1.91, 1.76, 1.76, 1.72, 1.43, 1.76, 1.72, 1.76, 1.78, 1.68, 1.63, 1.66, 1.61, 1.66, 0.74, 1.81, 1.64, 1.6, 1.55, 1.38, 1.25, 1.23, 1.3, 1.21, 0.74, 1.04, 1.12, 1.1, 1.21, 1.04, 1.1, 1.06, 0.97, 0.99, 0.54];

export function buildLevel(index: number, tune = TUNE[index - 1] ?? 1): LevelDef {
  const region = regionOf(index);
  const regionIdx = REGIONS.findIndex((x) => x.id === region);
  const local = index - REGIONS[regionIdx].from; // 0..9
  const boss = index % 10 === 0;

  // What the enemy can field. Repeats weight the random/AI choice.
  const pool: EnemyId[] = ['sword', 'sword'];
  if (index >= 2) pool.push('bandit', 'bandit');
  if (index >= 4) pool.push('archer');
  if (index >= 8) pool.push('spear');
  if (regionIdx >= 1 && local >= 1) pool.push('sandmage', 'sandmage');
  if (index >= 16) pool.push('camel');
  if (regionIdx >= 2 && local >= 1) pool.push('golem');
  if (index >= 28) pool.push('cavalry');
  if (regionIdx >= 3 && local >= 1) pool.push('ghost', 'ghost');
  if (index >= 36) pool.push('crossbow');
  if (regionIdx === 4) pool.push('mummy', 'skeleton', 'skeleton', 'cobra');
  if (regionIdx >= 5) pool.push('elfarcher', 'elfarcher', 'bladedancer', 'druid', local >= 4 ? 'treant' : 'elkrider');
  if (regionIdx >= 6) pool.push('goblinspear', 'goblinspear', 'troll', 'ogre', local >= 5 ? 'frostgiant' : 'cyclops');

  // Difficulty curve: levels 1-5 very easy, a soft wall at 12 (PRD 6).
  let income = index <= 5 ? 0.5 + index * 0.06 : 0.82 + (index - 5) * 0.012;
  if (index >= 12) income += 0.06;
  if (boss) income *= 0.75;
  income *= tune;

  const waves: Wave[] = [];
  if (boss) waves.push({ t: 60, unit: index === 50 ? 'mummyking' : index === 60 ? 'elfqueen' : index === 70 ? 'giantking' : 'boss', count: 1 });

  return {
    index, region, boss,
    castleHp: Math.round((1200 + index * 90) * (boss ? 1.4 : 1)),
    enemyMult: 1 + Math.max(0, index - 4) * 0.03 * tune,
    waves,
    loopAfter: Infinity,
    reward: 60 + index * 15 + (boss ? 150 : 0),
    kind: 'campaign',
    ai: {
      pool,
      startGold: 90 + index * 2, // close to the player's purse: no unfair opening rush
      maxMiners: Math.min(8, 2 + Math.floor(index / 5)),
      income,
      graceTime: index <= 2 ? 45 : index <= 5 ? 38 : 32,
    },
    towerDmg: index <= 3 ? 0 : 8 + index * 0.4,
  };
}

export const LEVELS: LevelDef[] = Array.from({ length: LEVEL_COUNT }, (_, i) => buildLevel(i + 1));

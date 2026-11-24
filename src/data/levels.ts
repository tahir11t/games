import type { EnemyId, UnitId } from './units';

/** What each unit costs the enemy AI (it buys with gold its own miners dig). */
export const ENEMY_COST: Partial<Record<EnemyId, number>> = {
  miner: 50, sword: 75, bandit: 70, archer: 150, spear: 250, sandmage: 180, camel: 400, cavalry: 350, crossbow: 280, golem: 450, ghost: 200,
  catapult: 600, hyena: 60, vulture: 90, fire: 300, lion: 320, assassin: 350, giant: 700, mummy: 260, skeleton: 80, cobra: 160, boss: 0,
};
export const costOf = (u: EnemyId) => ENEMY_COST[u] ?? 200;

export type RegionId = 'oasis' | 'dunes' | 'mountains' | 'shadow' | 'tombs';

export interface Wave { t: number; unit: EnemyId; count: number; mult?: number; }

export type LevelKind = 'campaign' | 'challenge' | 'survival' | 'daily';

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
}

export const REGIONS: { id: RegionId; from: number; to: number; enemy: EnemyId }[] = [
  { id: 'oasis', from: 1, to: 10, enemy: 'bandit' },
  { id: 'dunes', from: 11, to: 20, enemy: 'sandmage' },
  { id: 'mountains', from: 21, to: 30, enemy: 'golem' },
  { id: 'shadow', from: 31, to: 40, enemy: 'ghost' },
  { id: 'tombs', from: 41, to: 50, enemy: 'mummy' },
];
export const LEVEL_COUNT = 50;

export const regionOf = (i: number): RegionId => REGIONS.find((r) => i >= r.from && i <= r.to)!.id;

/** Per-level difficulty factors produced by scripts/tune.ts (1 = untuned). */
export const TUNE: number[] = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 2.0, 2.6, 2.8, 3.02, 2.68, 2.54, 2.52, 2.52, 2.36, 1.81, 2.0, 2.0, 1.98, 2.0, 1.99, 1.87, 1.87, 1.85, 1.79, 1.47, 1.68, 1.65, 1.62, 1.66, 1.66, 1.66, 1.53, 1.53, 1.5, 1.24, 1.53, 1.5, 1.53, 1.55, 1.46, 1.42, 1.44, 1.4, 1.44, 0.64];

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
  if (regionIdx >= 4) pool.push('mummy', 'skeleton', 'skeleton', 'cobra');

  // Difficulty curve: levels 1-5 very easy, a soft wall at 12 (PRD 6).
  let income = index <= 5 ? 0.5 + index * 0.06 : 0.82 + (index - 5) * 0.012;
  if (index >= 12) income += 0.06;
  if (boss) income *= 0.75;
  income *= tune;

  const waves: Wave[] = [];
  if (boss) waves.push({ t: 60, unit: index === 50 ? 'mummyking' : 'boss', count: 1 });

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

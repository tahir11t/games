import type { EnemyId, UnitId } from './units';

/** What each enemy costs from the enemy's wave budget. */
export const ENEMY_COST: Partial<Record<EnemyId, number>> = { miner: 50, sword: 75, bandit: 70, archer: 150, spear: 250, sandmage: 180, camel: 400, golem: 450, ghost: 200, catapult: 600, hyena: 60, vulture: 90, fire: 300, lion: 320, assassin: 350, giant: 700, boss: 0 };
const costOf = (u: EnemyId) => ENEMY_COST[u] ?? 200;

export type RegionId = 'oasis' | 'dunes' | 'mountains' | 'shadow';

export interface Wave { t: number; unit: EnemyId; count: number; mult?: number; }

export type LevelKind = 'campaign' | 'challenge' | 'survival' | 'daily';

/** Battle-rule modifiers (challenges and the daily challenge). */
export interface Mods {
  enemySpeed?: number;
  enemyDmg?: number;
  goldMult?: number;
  noMiners?: boolean; // no miners: passive income instead
}

export interface LevelDef {
  index: number; // 1..40
  region: RegionId;
  boss: boolean;
  castleHp: number;
  enemyMult: number; // stat multiplier for enemy units
  waves: Wave[];
  loopAfter: number; // seconds: script repeats from this time with escalation
  reward: number; // base gold
  kind?: LevelKind;
  id?: string;
  allowed?: UnitId[]; // restrict the player's unit bar
  mods?: Mods;
  noCounters?: boolean;
  startGold?: number; // overrides the default 150
}

export const REGIONS: { id: RegionId; from: number; to: number; enemy: EnemyId }[] = [
  { id: 'oasis', from: 1, to: 10, enemy: 'bandit' },
  { id: 'dunes', from: 11, to: 20, enemy: 'sandmage' },
  { id: 'mountains', from: 21, to: 30, enemy: 'golem' },
  { id: 'shadow', from: 31, to: 40, enemy: 'ghost' },
];

export const regionOf = (i: number): RegionId => REGIONS.find((r) => i >= r.from && i <= r.to)!.id;

/** Deterministic PRNG so every level's script is fixed (pre-built wave scripts). */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** Per-level difficulty factors produced by scripts/tune.ts (1 = untuned). */
export const TUNE: number[] = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.08, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 0.91, 0.73, 1.25, 0.96, 1.01, 1.25, 1.25, 1.19, 1.25, 1.25, 0.7, 0.6, 1.14, 0.74, 0.83, 1.03, 1.21, 0.91, 0.7, 0.89, 0.93, 0.66];

export function buildLevel(index: number, tune = TUNE[index - 1] ?? 1): LevelDef {
  const region = regionOf(index);
  const r = rng(index);
  const regionIdx = REGIONS.findIndex((x) => x.id === region);
  const local = index - REGIONS[regionIdx].from; // 0..9
  const boss = index % 10 === 0;

  // Difficulty curve: levels 1-5 very easy, a soft wall at 12 (PRD 6).
  // The enemy "earns" gold at a rate and spends it on waves, so wave size
  // always tracks what the player's economy can answer.
  let rate = index <= 5 ? 2.6 + index * 0.35 : 4.6 + (index - 5) * 0.11;
  if (index >= 12) rate += 0.6;
  if (boss) rate *= 0.6;
  rate *= tune;
  const enemyMult = 1 + Math.max(0, index - 4) * 0.033 * tune;

  // Pool of enemy units available at this level.
  const pool: EnemyId[] = ['sword'];
  if (index >= 2) pool.push('bandit');
  if (index >= 4) pool.push('archer');
  if (index >= 8) pool.push('spear');
  if (regionIdx >= 1 && local >= 1) pool.push('sandmage', 'sandmage');
  if (index >= 16) pool.push('camel');
  if (regionIdx >= 2 && local >= 1) pool.push('golem');
  if (regionIdx >= 3 && local >= 1) pool.push('ghost', 'ghost');

  const waves: Wave[] = [];
  const firstWave = index <= 2 ? 24 : index <= 5 ? 18 : 12;
  const gap = index <= 3 ? 18 : 14;
  const duration = 150;
  let budget = 40; // small head start
  let last = 0;
  for (let t = firstWave; t < duration; t += gap + Math.round(r() * 4)) {
    budget += (t - last) * rate;
    last = t;
    // Spend: pick units until the budget runs out (always at least one unit).
    const counts = new Map<EnemyId, number>();
    let guard = 0;
    do {
      // Opening grace period: only cheap units before the player has an army.
      const choices = t < 35 ? pool.filter((u) => costOf(u) <= 200) : pool;
      const unit = choices[Math.floor(r() * choices.length)];
      const c = costOf(unit);
      if (c > budget && counts.size) break;
      budget -= c;
      counts.set(unit, (counts.get(unit) ?? 0) + 1);
    } while (budget > 60 && ++guard < 12);
    budget = Math.max(0, budget);
    for (const [unit, count] of counts) waves.push({ t, unit, count });
  }
  if (boss) waves.push({ t: 60, unit: 'boss', count: 1 });
  waves.sort((a, b) => a.t - b.t);

  return {
    index,
    region,
    boss,
    castleHp: Math.round((1200 + index * 90) * (boss ? 1.4 : 1)),
    enemyMult,
    waves,
    loopAfter: duration,
    reward: 60 + index * 15 + (boss ? 150 : 0),
    kind: 'campaign',
  };
}

export const LEVELS: LevelDef[] = Array.from({ length: 40 }, (_, i) => buildLevel(i + 1));

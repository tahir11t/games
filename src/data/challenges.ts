import { UNITS, type EnemyId, type UnitId } from './units';
import type { ChallengeId, AbilityId, PassiveId } from './skills';
import { buildLevel, type LevelDef, type Mods, type RegionId, type Wave } from './levels';

export interface ChallengeDef {
  id: ChallengeId;
  icon: string;
  region: RegionId;
  reqLevel: number;
  reqChallenge?: ChallengeId[];
  boss: EnemyId;
  castleHp: number;
  enemyMult: number;
  waves: Wave[];
  loopAfter: number;
  allowed?: UnitId[];
  mods?: Mods;
  reward: { gold: number; gems: number; unlocks: (UnitId | AbilityId | PassiveId)[] };
}

/** Build a wave list from compact [time, unit, count, mult?] tuples. */
const W = (...rows: [number, EnemyId, number, number?][]): Wave[] => rows.map(([t, unit, count, mult]) => ({ t, unit, count, mult }));
/** Repeat a group every `gap` seconds from `from` to `to`. */
const every = (from: number, to: number, gap: number, unit: EnemyId, count: number, grow = 0): Wave[] => {
  const out: Wave[] = [];
  for (let t = from, i = 0; t <= to; t += gap, i++) out.push({ t, unit, count: count + Math.floor(i * grow) });
  return out;
};

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'hyenas', icon: '🐺', region: 'oasis', reqLevel: 6, boss: 'hyena', castleHp: 1800, enemyMult: 1.15, loopAfter: 120,
    waves: [...every(14, 110, 12, 'hyena', 2, 0.6), ...W([70, 'hyena', 1, 3.5], [100, 'hyena', 1, 4])],
    reward: { gold: 600, gems: 30, unlocks: ['lion'] },
  },
  {
    id: 'archery', icon: '🎯', region: 'oasis', reqLevel: 9, boss: 'bandit', castleHp: 2000, enemyMult: 1.25, loopAfter: 130,
    allowed: ['miner', 'archer', 'falcon'],
    waves: [...every(12, 120, 10, 'bandit', 2, 0.4), ...every(40, 120, 30, 'sword', 2)],
    reward: { gold: 700, gems: 30, unlocks: ['eagle'] },
  },
  {
    id: 'scorpion', icon: '🦂', region: 'dunes', reqLevel: 12, boss: 'scorpking', castleHp: 2600, enemyMult: 1.3, loopAfter: 150,
    waves: [...every(12, 140, 18, 'bandit', 2), ...every(25, 140, 25, 'sandmage', 1), ...W([45, 'scorpking', 1])],
    reward: { gold: 900, gems: 40, unlocks: ['assassin'] },
  },
  {
    id: 'roc', icon: '🦅', region: 'mountains', reqLevel: 15, boss: 'roc', castleHp: 2800, enemyMult: 1.35, loopAfter: 150,
    waves: [...every(12, 140, 14, 'vulture', 2, 0.35), ...every(30, 140, 30, 'sword', 2), ...W([60, 'roc', 1])],
    reward: { gold: 1000, gems: 40, unlocks: ['falcon'] },
  },
  {
    id: 'worm', icon: '🪱', region: 'dunes', reqLevel: 20, boss: 'worm', castleHp: 3200, enemyMult: 1.45, loopAfter: 160,
    mods: { enemySpeed: 1.1 },
    waves: [...every(12, 150, 16, 'hyena', 3), ...every(28, 150, 22, 'sandmage', 2), ...W([50, 'worm', 1])],
    reward: { gold: 1300, gems: 50, unlocks: ['sandstorm'] },
  },
  {
    id: 'titan', icon: '🗿', region: 'mountains', reqLevel: 24, boss: 'titan', castleHp: 3600, enemyMult: 1.55, loopAfter: 170,
    waves: [...every(14, 160, 24, 'golem', 1), ...every(18, 160, 16, 'bandit', 2), ...W([55, 'titan', 1])],
    reward: { gold: 1600, gems: 60, unlocks: ['giant'] },
  },
  {
    id: 'djinn', icon: '🧞', region: 'shadow', reqLevel: 32, boss: 'djinn', castleHp: 4200, enemyMult: 1.75, loopAfter: 170,
    waves: [...every(12, 160, 14, 'ghost', 2, 0.25), ...every(30, 160, 30, 'vulture', 3), ...W([60, 'djinn', 1])],
    reward: { gold: 2200, gems: 80, unlocks: ['genie', 'meteor'] },
  },
  {
    id: 'warlord', icon: '👹', region: 'shadow', reqLevel: 38, reqChallenge: ['scorpion', 'roc', 'worm', 'titan', 'djinn'], boss: 'warlord', castleHp: 5200, enemyMult: 1.9, loopAfter: 180,
    waves: [...every(12, 170, 15, 'ghost', 2), ...every(20, 170, 25, 'golem', 1), ...every(25, 170, 20, 'vulture', 2), ...W([70, 'warlord', 1], [130, 'scorpking', 1])],
    reward: { gold: 3000, gems: 120, unlocks: ['hero'] },
  },
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id)!;

/** Per-challenge strength factors from scripts/challenges.ts --tune (1 = untuned). */
export const CH_TUNE: Partial<Record<ChallengeId, number>> = { hyenas: 0.95, archery: 0.7, scorpion: 0.75, roc: 0.37, worm: 0.5, titan: 0.65, djinn: 0.23, warlord: 0.23 };

export function challengeLevel(c: ChallengeDef, tune = CH_TUNE[c.id] ?? 1): LevelDef {
  return {
    // Tuning thins escort waves first and only partly weakens stats, so bosses stay imposing.
    index: 100 + CHALLENGES.indexOf(c), region: c.region, boss: true, castleHp: c.castleHp, enemyMult: c.enemyMult * Math.sqrt(tune),
    startGold: 300 + c.reqLevel * 12,
    waves: c.waves.map((w) => ({ ...w, t: Math.max(22, w.t), count: UNITS[w.unit].boss ? w.count : Math.max(1, Math.round(w.count * Math.min(1, tune))) })).sort((a, b) => a.t - b.t), loopAfter: c.loopAfter, reward: c.reward.gold,
    kind: 'challenge', id: c.id, allowed: c.allowed, mods: c.mods, noCounters: true,
  };
}

// ---------------- Daily challenge ----------------
export interface DailyMod { id: string; icon: string; allowed?: UnitId[]; mods?: Mods; extra?: Wave[] }
export const DAILY_MODS: DailyMod[] = [
  { id: 'd_archers', icon: '🏹', allowed: ['miner', 'archer', 'falcon', 'healer'] },
  { id: 'd_speed', icon: '💨', mods: { enemySpeed: 1.45 } },
  { id: 'd_rush', icon: '🪙', mods: { goldMult: 2, enemyDmg: 1.35 } },
  { id: 'd_nominers', icon: '🚫', mods: { noMiners: true } },
  { id: 'd_beasts', icon: '🐺', extra: every(30, 150, 20, 'hyena', 2) },
  { id: 'd_sky', icon: '🦅', extra: every(30, 150, 22, 'vulture', 1, 0.2) },
  { id: 'd_melee', icon: '⚔️', allowed: ['miner', 'sword', 'spear', 'camel', 'lion', 'assassin', 'giant', 'hero'] },
];

export function dailyFor(date: string, unlocked: number): { mod: DailyMod; level: LevelDef } {
  const n = Number(date.replace(/-/g, ''));
  const mod = DAILY_MODS[n % DAILY_MODS.length];
  // A few levels below the player's frontier: the rule is the challenge, not raw stats.
  const base = buildLevel(Math.max(3, Math.min(36, unlocked - 4)));
  const level: LevelDef = {
    ...base, index: 200, kind: 'daily', id: mod.id, allowed: mod.allowed, mods: mod.mods, noCounters: true, startGold: 250,
    waves: [...base.waves, ...(mod.extra ?? [])].sort((a, b) => a.t - b.t), reward: 300,
  };
  return { mod, level };
}

// ---------------- Survival ----------------
export function survivalLevel(): LevelDef {
  return { index: 300, region: 'mountains', boss: false, castleHp: Infinity, enemyMult: 1, waves: [], loopAfter: Infinity, reward: 0, kind: 'survival', noCounters: true };
}
const SURVIVAL_POOL: EnemyId[][] = [
  ['bandit', 'sword'], ['bandit', 'hyena', 'archer'], ['hyena', 'sandmage', 'spear'], ['vulture', 'golem', 'sandmage'], ['ghost', 'golem', 'vulture', 'camel'],
];
const SURVIVAL_BOSSES: EnemyId[] = ['scorpking', 'roc', 'worm', 'titan', 'djinn', 'warlord'];
/** Wave n (1-based): budgeted group + a boss every 5th wave. */
export function survivalWave(n: number, rnd: () => number): { unit: EnemyId; count: number; mult: number }[] {
  const pool = SURVIVAL_POOL[Math.min(SURVIVAL_POOL.length - 1, Math.floor((n - 1) / 3))];
  let budget = 90 + n * 55;
  const mult = 1 + n * 0.06;
  const out = new Map<EnemyId, number>();
  while (budget > 50) {
    const u = pool[Math.floor(rnd() * pool.length)];
    budget -= costOf(u);
    out.set(u, (out.get(u) ?? 0) + 1);
  }
  const res = [...out].map(([unit, count]) => ({ unit, count, mult }));
  if (n % 5 === 0) res.push({ unit: SURVIVAL_BOSSES[(n / 5 - 1) % SURVIVAL_BOSSES.length], count: 1, mult: 0.45 + n * 0.03 });
  return res;
}
const costOf = (u: EnemyId) => ({ bandit: 70, sword: 75, hyena: 60, archer: 150, sandmage: 180, spear: 250, vulture: 90, golem: 450, ghost: 200, camel: 400 } as Partial<Record<EnemyId, number>>)[u] ?? 200;

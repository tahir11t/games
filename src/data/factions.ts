import type { EnemyId } from './units';
import { buildLevel, type LevelDef, type RegionId } from './levels';

export type FactionId = 'elves' | 'ghosts' | 'zombies' | 'dwarves' | 'giants';

export interface FactionDef {
  id: FactionId;
  icon: string;
  color: string; // banner / fort colour
  region: RegionId;
  miner: EnemyId;
  pool: EnemyId[]; // repeats weight the commander's choices
  boss: EnemyId;
  showcase: EnemyId; // unit shown on the faction card
  base: number; // campaign-equivalent strength of battle 1
  reqLevel: number;
  bossMult: number; // boss strength in its battle
}

export const FACTIONS: FactionDef[] = [
  { id: 'elves', icon: '🌿', color: '#2f8f4e', region: 'forest', miner: 'elfworker', pool: ['elfarcher', 'elfarcher', 'bladedancer', 'bladedancer', 'druid', 'elkrider', 'treant'], boss: 'elfqueen', showcase: 'elfarcher', base: 8, reqLevel: 6, bossMult: 0.42 },
  { id: 'ghosts', icon: '👻', color: '#6c4bb4', region: 'shadow', miner: 'wisp', pool: ['wraith', 'wraith', 'banshee', 'banshee', 'phantom', 'specter'], boss: 'ghostking', showcase: 'banshee', base: 14, reqLevel: 12, bossMult: 0.42 },
  { id: 'zombies', icon: '🧟', color: '#5f7f2f', region: 'graveyard', miner: 'gravedigger', pool: ['zombie', 'zombie', 'zombie', 'runner', 'runner', 'bloater', 'skelarcher', 'necromancer', 'abomination'], boss: 'plaguelord', showcase: 'zombie', base: 20, reqLevel: 18, bossMult: 0.3 },
  { id: 'dwarves', icon: '⚒️', color: '#3f6fa8', region: 'mountains', miner: 'dwarfminer', pool: ['axethrower', 'axethrower', 'shieldwall', 'berserker', 'berserker', 'gyrocopter', 'cannon'], boss: 'dwarfking', showcase: 'berserker', base: 26, reqLevel: 24, bossMult: 0.42 },
  { id: 'giants', icon: '🗻', color: '#4a8fc0', region: 'tundra', miner: 'goblin', pool: ['goblinspear', 'goblinspear', 'goblinspear', 'troll', 'ogre', 'cyclops', 'frostgiant'], boss: 'giantking', showcase: 'ogre', base: 32, reqLevel: 30, bossMult: 0.26 },
];
export const CONQUEST_BATTLES = 5;

/** Per-faction strength factors from scripts/conquest.ts (1 = untuned). */
export const FACTION_TUNE: Partial<Record<FactionId, number>> = { elves: 1.47, ghosts: 1.09, zombies: 1.5, dwarves: 1.02, giants: 1.37 };

export const factionById = (id: string) => FACTIONS.find((f) => f.id === id)!;

/** Battle k (1..5) against a civilization: a campaign-strength level with that faction's army. */
export function conquestLevel(f: FactionDef, k: number): LevelDef {
  const idx = Math.min(50, f.base + (k - 1) * 3);
  // Own smooth curve (not the campaign's per-level tuning, which was fitted to the desert army).
  const boss = k === CONQUEST_BATTLES;
  // The boss battle trims the army budget (like campaign boss levels) since the boss is the threat.
  const tune = (FACTION_TUNE[f.id] ?? 1) * (boss ? 1.2 * 0.75 : 1 + 0.07 * (k - 1));
  const base = buildLevel(idx, tune);
  return {
    ...base,
    index: 400 + FACTIONS.indexOf(f) * 10 + k,
    region: f.region,
    boss: k === CONQUEST_BATTLES,
    kind: 'conquest',
    id: `${f.id}-${k}`,
    waves: k === CONQUEST_BATTLES ? [{ t: 55, unit: f.boss, count: 1, mult: f.bossMult }] : [],
    reward: 120 + idx * 18,
    enemyColor: f.color,
    ai: { ...base.ai!, pool: f.pool, miner: f.miner },
  };
}

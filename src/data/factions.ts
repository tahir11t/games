import type { EnemyId, UnitId } from './units';
import { buildLevel, costOf, type LevelDef, type RegionId } from './levels';

export type FactionId = 'elves' | 'ghosts' | 'zombies' | 'dwarves' | 'giants';
export type ArmyId = 'desert' | FactionId;

export interface FactionDef {
  id: FactionId;
  icon: string;
  color: string; // banner / fort colour
  region: RegionId;
  miner: EnemyId;
  pool: EnemyId[]; // repeats weight the commander's choices
  special: EnemyId; // extra unit joining from battle 4
  hero: EnemyId; // unique hero: mini-boss in battle 5, playable once conquered
  boss: EnemyId;
  showcase: EnemyId;
  base: number; // campaign-equivalent strength of battle 1
  reqLevel: number;
  bossMult: number;
  /** upgrade level each unit borrows from the desert army (so upgrades carry over) */
  roles: Partial<Record<EnemyId, UnitId>>;
}

export const FACTIONS: FactionDef[] = [
  { id: 'elves', icon: '🌿', color: '#2f8f4e', region: 'forest', miner: 'elfworker', pool: ['elfarcher', 'elfarcher', 'bladedancer', 'bladedancer', 'druid', 'elkrider', 'treant'], special: 'sprite', hero: 'moonarcher', boss: 'elfqueen', showcase: 'elfarcher', base: 8, reqLevel: 6, bossMult: 0.42,
    roles: { elfworker: 'miner', elfarcher: 'archer', bladedancer: 'sword', druid: 'healer', elkrider: 'cavalry', treant: 'giant', sprite: 'falcon', moonarcher: 'hero' } },
  { id: 'ghosts', icon: '👻', color: '#6c4bb4', region: 'shadow', miner: 'wisp', pool: ['wraith', 'wraith', 'banshee', 'banshee', 'phantom', 'specter'], special: 'poltergeist', hero: 'soulreaper', boss: 'ghostking', showcase: 'banshee', base: 14, reqLevel: 12, bossMult: 0.42,
    roles: { wisp: 'miner', wraith: 'falcon', banshee: 'archer', phantom: 'assassin', specter: 'spear', poltergeist: 'catapult', soulreaper: 'hero' } },
  { id: 'zombies', icon: '🧟', color: '#5f7f2f', region: 'graveyard', miner: 'gravedigger', pool: ['zombie', 'zombie', 'zombie', 'runner', 'runner', 'bloater', 'skelarcher', 'necromancer', 'abomination'], special: 'ghoul', hero: 'lich', boss: 'plaguelord', showcase: 'zombie', base: 20, reqLevel: 18, bossMult: 0.3,
    roles: { gravedigger: 'miner', zombie: 'sword', runner: 'camel', bloater: 'spear', skelarcher: 'archer', necromancer: 'healer', abomination: 'giant', ghoul: 'assassin', lich: 'hero' } },
  { id: 'dwarves', icon: '⚒️', color: '#3f6fa8', region: 'mountains', miner: 'dwarfminer', pool: ['axethrower', 'axethrower', 'shieldwall', 'berserker', 'berserker', 'gyrocopter', 'cannon'], special: 'runepriest', hero: 'thunderlord', boss: 'dwarfking', showcase: 'berserker', base: 26, reqLevel: 24, bossMult: 0.42,
    roles: { dwarfminer: 'miner', axethrower: 'archer', shieldwall: 'spear', berserker: 'sword', gyrocopter: 'falcon', cannon: 'catapult', runepriest: 'healer', thunderlord: 'hero' } },
  { id: 'giants', icon: '🗻', color: '#4a8fc0', region: 'tundra', miner: 'goblin', pool: ['goblinspear', 'goblinspear', 'goblinspear', 'troll', 'ogre', 'cyclops', 'frostgiant'], special: 'mammoth', hero: 'colossus', boss: 'giantking', showcase: 'ogre', base: 32, reqLevel: 30, bossMult: 0.26,
    roles: { goblin: 'miner', goblinspear: 'sword', troll: 'spear', ogre: 'giant', cyclops: 'catapult', frostgiant: 'elephant', mammoth: 'camel', colossus: 'hero' } },
];
export const CONQUEST_BATTLES = 10;
export const HERO_BATTLE = 5;
export const SIEGE_BATTLE = 3;
export const ELITE_BATTLE = 7;

/** Per-faction strength factors from scripts/conquest.ts (1 = untuned). */
export const FACTION_TUNE: Partial<Record<FactionId, number>> = { elves: 1.54, ghosts: 1.06, zombies: 0.95, dwarves: 0.78, giants: 0.85 };

export const factionById = (id: string) => FACTIONS.find((f) => f.id === id)!;
export const conquered = (won: number) => won >= CONQUEST_BATTLES;

/** The unit bar when playing as this civilization (worker, army, special, hero). */
export function rosterOf(f: FactionDef): EnemyId[] {
  const units = [...new Set(f.pool)].sort((a, z) => costOf(a) - costOf(z));
  return [f.miner, ...units, f.special, f.hero];
}
/** Price and training time for civilization units played by the player. */
export const armyCost = (id: EnemyId) => costOf(id);
export const armyTrain = (id: EnemyId) => Math.max(2, Math.min(15, Math.round(costOf(id) / 55)));

/** Battle k (1..10) against a civilization. */
export function conquestLevel(f: FactionDef, k: number): LevelDef {
  const idx = Math.min(50, Math.round(f.base + (k - 1) * 1.6));
  const boss = k === CONQUEST_BATTLES;
  const elite = k === ELITE_BATTLE;
  const siege = k === SIEGE_BATTLE;
  // Own smooth curve; the boss battle trims the army budget since the boss is the threat.
  const tune = (FACTION_TUNE[f.id] ?? 1) * (boss ? 0.95 : (1 + 0.018 * (k - 1)) * (elite ? 1.05 : 1));
  const base = buildLevel(idx, tune);
  const pool = k >= 4 ? [...f.pool, f.special] : f.pool;
  const waves = boss ? [{ t: 55, unit: f.boss, count: 1, mult: f.bossMult }]
    : k === HERO_BATTLE ? [{ t: 50, unit: f.hero, count: 1, mult: f.id === 'giants' ? 0.2 : 0.38 }]
    : siege ? [{ t: 30, unit: f.pool[f.pool.length - 1], count: 2 }, { t: 70, unit: f.pool[f.pool.length - 1], count: 3 }]
    : [];
  return {
    ...base,
    index: 400 + FACTIONS.indexOf(f) * 20 + k,
    region: f.region,
    boss: boss || k === HERO_BATTLE,
    kind: 'conquest',
    id: `${f.id}-${k}`,
    waves,
    reward: Math.round((120 + idx * 18) * (elite ? 2 : 1)),
    enemyColor: f.color,
    castleHp: siege ? Infinity : base.castleHp,
    winAfter: siege ? 120 : undefined,
    towerDmg: siege ? 0 : base.towerDmg,
    faction: f.id,
    ai: { ...base.ai!, pool, miner: f.miner, graceTime: siege ? 15 : base.ai!.graceTime },
  };
}

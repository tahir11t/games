// Unit stats. The first six player units are the PRD section 5 roster; their
// numbers feed the campaign tuning in levels.ts, so change them with care
// (re-run scripts/tune.ts afterwards).
export type UnitId =
  | 'miner' | 'sword' | 'archer' | 'spear' | 'camel' | 'catapult'
  | 'healer' | 'falcon' | 'fire' | 'lion' | 'assassin' | 'giant' | 'genie' | 'hero';
export type EnemyId = UnitId
  | 'bandit' | 'sandmage' | 'golem' | 'ghost' | 'boss'
  | 'hyena' | 'vulture' | 'scorpking' | 'roc' | 'worm' | 'titan' | 'djinn' | 'warlord';

export interface UnitDef {
  id: EnemyId;
  cost: number;
  train: number; // seconds
  hp: number;
  dmg: number;
  range: number; // px
  speed: number; // px / s
  cooldown: number; // s between attacks
  splash?: number; // radius for area damage
  unlock: number; // campaign level it unlocks at (99 = shop / enemy only)
  bonusVs?: EnemyId[]; // counter triangle: x1.75 damage
  charge?: boolean; // first hit x2 when moving
  ranged?: boolean;
  flying?: boolean; // only ranged / flying units can hit it
  heal?: number; // heals this much per cooldown instead of attacking
  crit?: number; // chance of x2.5 damage
  dodge?: number; // chance to ignore a single-target hit
  aura?: number; // +x damage to allies within 140px
  maxCount?: number; // max alive at once
  boss?: boolean;
  height: number;
}

export const UNITS: Record<EnemyId, UnitDef> = {
  // --- PRD roster ---
  miner:    { id: 'miner',    cost: 50,  train: 3,  hp: 60,  dmg: 2,  range: 22,  speed: 55, cooldown: 1.0, unlock: 1,  height: 49 },
  sword:    { id: 'sword',    cost: 75,  train: 2,  hp: 120, dmg: 12, range: 26,  speed: 60, cooldown: 0.9, unlock: 1,  height: 55 },
  archer:   { id: 'archer',   cost: 150, train: 4,  hp: 80,  dmg: 15, range: 230, speed: 52, cooldown: 1.4, unlock: 3,  height: 55, ranged: true, bonusVs: ['spear', 'golem', 'vulture'] },
  spear:    { id: 'spear',    cost: 250, train: 6,  hp: 400, dmg: 10, range: 40,  speed: 40, cooldown: 1.0, unlock: 7,  height: 61, bonusVs: ['camel', 'lion', 'hyena'] },
  camel:    { id: 'camel',    cost: 400, train: 8,  hp: 300, dmg: 30, range: 34,  speed: 110, cooldown: 1.1, unlock: 14, height: 81, charge: true, bonusVs: ['archer', 'sandmage'] },
  catapult: { id: 'catapult', cost: 600, train: 12, hp: 200, dmg: 60, range: 320, speed: 28, cooldown: 3.2, unlock: 22, height: 58, ranged: true, splash: 60 },
  // --- Shop / challenge units ---
  healer:   { id: 'healer',   cost: 200, train: 5,  hp: 110, dmg: 0,  range: 150, speed: 50, cooldown: 1.4, unlock: 99, height: 55, heal: 18 },
  falcon:   { id: 'falcon',   cost: 175, train: 4,  hp: 75,  dmg: 11, range: 30,  speed: 125, cooldown: 0.8, unlock: 99, height: 40, flying: true, bonusVs: ['archer', 'sandmage', 'vulture'] },
  fire:     { id: 'fire',     cost: 300, train: 6,  hp: 170, dmg: 14, range: 85,  speed: 48, cooldown: 1.1, unlock: 99, height: 57, splash: 55, bonusVs: ['hyena', 'ghost'] },
  lion:     { id: 'lion',     cost: 320, train: 6,  hp: 280, dmg: 22, range: 32,  speed: 120, cooldown: 0.7, unlock: 99, height: 46, charge: true },
  assassin: { id: 'assassin', cost: 350, train: 6,  hp: 160, dmg: 26, range: 28,  speed: 105, cooldown: 0.8, unlock: 99, height: 55, crit: 0.3, dodge: 0.25, bonusVs: ['sandmage', 'archer'] },
  giant:    { id: 'giant',    cost: 700, train: 12, hp: 1400, dmg: 38, range: 44, speed: 28, cooldown: 1.6, unlock: 99, height: 100, splash: 40 },
  genie:    { id: 'genie',    cost: 900, train: 14, hp: 620, dmg: 42, range: 190, speed: 55, cooldown: 2.0, unlock: 99, height: 70, flying: true, ranged: true, splash: 65 },
  hero:     { id: 'hero',     cost: 1000, train: 15, hp: 1800, dmg: 55, range: 40, speed: 62, cooldown: 1.0, unlock: 99, height: 72, splash: 34, aura: 0.15, maxCount: 1 },
  // --- Campaign enemies ---
  bandit:   { id: 'bandit',   cost: 0, train: 0, hp: 100, dmg: 11, range: 26,  speed: 66, cooldown: 0.8, unlock: 99, height: 55 },
  sandmage: { id: 'sandmage', cost: 0, train: 0, hp: 90,  dmg: 15, range: 200, speed: 45, cooldown: 1.8, unlock: 99, height: 58, ranged: true, splash: 28 },
  golem:    { id: 'golem',    cost: 0, train: 0, hp: 600, dmg: 20, range: 36,  speed: 30, cooldown: 1.6, unlock: 99, height: 84 },
  ghost:    { id: 'ghost',    cost: 0, train: 0, hp: 150, dmg: 20, range: 28,  speed: 90, cooldown: 0.9, unlock: 99, height: 58 },
  boss:     { id: 'boss',     cost: 0, train: 0, hp: 1500, dmg: 28, range: 50, speed: 32, cooldown: 1.6, unlock: 99, height: 116, splash: 34, boss: true },
  // --- Monsters (challenges / survival) ---
  hyena:    { id: 'hyena',    cost: 0, train: 0, hp: 85,  dmg: 9,  range: 26,  speed: 115, cooldown: 0.6, unlock: 99, height: 36 },
  vulture:  { id: 'vulture',  cost: 0, train: 0, hp: 70,  dmg: 10, range: 28,  speed: 95, cooldown: 0.9, unlock: 99, height: 36, flying: true },
  scorpking:{ id: 'scorpking',cost: 0, train: 0, hp: 2600, dmg: 34, range: 60, speed: 34, cooldown: 1.4, unlock: 99, height: 100, splash: 40, boss: true },
  roc:      { id: 'roc',      cost: 0, train: 0, hp: 1900, dmg: 30, range: 50, speed: 60, cooldown: 1.3, unlock: 99, height: 90, flying: true, splash: 45, boss: true },
  worm:     { id: 'worm',     cost: 0, train: 0, hp: 4200, dmg: 48, range: 70, speed: 26, cooldown: 2.0, unlock: 99, height: 110, splash: 60, boss: true },
  titan:    { id: 'titan',    cost: 0, train: 0, hp: 5200, dmg: 55, range: 60, speed: 22, cooldown: 2.2, unlock: 99, height: 140, splash: 55, boss: true },
  djinn:    { id: 'djinn',    cost: 0, train: 0, hp: 3600, dmg: 40, range: 210, speed: 40, cooldown: 2.0, unlock: 99, height: 110, flying: true, ranged: true, splash: 60, boss: true },
  warlord:  { id: 'warlord',  cost: 0, train: 0, hp: 6500, dmg: 60, range: 55, speed: 34, cooldown: 1.3, unlock: 99, height: 120, splash: 45, aura: 0.2, boss: true },
};

/** Order of the unit bar. */
export const PLAYER_UNITS: UnitId[] = ['miner', 'sword', 'archer', 'spear', 'camel', 'catapult', 'healer', 'falcon', 'fire', 'lion', 'assassin', 'giant', 'genie', 'hero'];
export const BASE_UNITS: UnitId[] = ['miner', 'sword', 'archer', 'spear', 'camel', 'catapult'];

export const MINER_GOLD = 5;
export const MINER_INTERVAL = 3;
export const MAX_MINERS = 8;
export const MAX_ARMY = 40;
export const CONTROL_BONUS = 1.3;
export const COUNTER_BONUS = 1.75;
export const FLY_HEIGHT = 95;

/** +8% hp/dmg per upgrade level (PRD 6). */
export const upgradeMult = (lvl: number) => 1 + 0.08 * (lvl - 1);
/** Cost roughly doubles every 4 levels; premium units cost more to upgrade. */
export const upgradeCost = (lvl: number, id?: UnitId) =>
  Math.round((100 * Math.pow(2, (lvl - 1) / 4) * (id && !BASE_UNITS.includes(id) ? 1.6 : 1)) / 10) * 10;
export const MAX_UNIT_LEVEL = 20;

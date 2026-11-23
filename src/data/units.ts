// Initial balance values from PRD section 5. Tuned after playtesting.
export type UnitId = 'miner' | 'sword' | 'archer' | 'spear' | 'camel' | 'catapult';
export type EnemyId = UnitId | 'bandit' | 'sandmage' | 'golem' | 'ghost' | 'boss';

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
  unlock: number; // level index (1-based) it unlocks at
  bonusVs?: EnemyId[]; // counter triangle: x1.75 damage
  charge?: boolean; // first hit x2 when moving
  ranged?: boolean;
  height: number;
}

export const UNITS: Record<EnemyId, UnitDef> = {
  miner:    { id: 'miner',    cost: 50,  train: 3,  hp: 60,  dmg: 2,  range: 22,  speed: 55, cooldown: 1.0, unlock: 1,  height: 49 },
  sword:    { id: 'sword',    cost: 75,  train: 2,  hp: 120, dmg: 12, range: 26,  speed: 60, cooldown: 0.9, unlock: 1,  height: 55 },
  archer:   { id: 'archer',   cost: 150, train: 4,  hp: 80,  dmg: 15, range: 230, speed: 52, cooldown: 1.4, unlock: 3,  height: 55, ranged: true, bonusVs: ['spear', 'golem'] },
  spear:    { id: 'spear',    cost: 250, train: 6,  hp: 400, dmg: 10, range: 40,  speed: 40, cooldown: 1.0, unlock: 7,  height: 61, bonusVs: ['camel'] },
  camel:    { id: 'camel',    cost: 400, train: 8,  hp: 300, dmg: 30, range: 34,  speed: 110, cooldown: 1.1, unlock: 14, height: 81, charge: true, bonusVs: ['archer', 'sandmage'] },
  catapult: { id: 'catapult', cost: 600, train: 12, hp: 200, dmg: 60, range: 320, speed: 28, cooldown: 3.2, unlock: 22, height: 58, ranged: true, splash: 60 },
  // Enemy-only
  bandit:   { id: 'bandit',   cost: 0, train: 0, hp: 100, dmg: 11, range: 26,  speed: 66, cooldown: 0.8, unlock: 99, height: 55 },
  sandmage: { id: 'sandmage', cost: 0, train: 0, hp: 90,  dmg: 15, range: 200, speed: 45, cooldown: 1.8, unlock: 99, height: 58, ranged: true, splash: 28 },
  golem:    { id: 'golem',    cost: 0, train: 0, hp: 600, dmg: 20, range: 36,  speed: 30, cooldown: 1.6, unlock: 99, height: 84 },
  ghost:    { id: 'ghost',    cost: 0, train: 0, hp: 150, dmg: 20, range: 28,  speed: 90, cooldown: 0.9, unlock: 99, height: 58 },
  boss:     { id: 'boss',     cost: 0, train: 0, hp: 1500, dmg: 28, range: 50, speed: 32, cooldown: 1.6, unlock: 99, height: 116, splash: 34 },
};

export const PLAYER_UNITS: UnitId[] = ['miner', 'sword', 'archer', 'spear', 'camel', 'catapult'];

export const MINER_GOLD = 5;
export const MINER_INTERVAL = 3;
export const MAX_MINERS = 8;
export const MAX_ARMY = 40;
export const CONTROL_BONUS = 1.3;
export const COUNTER_BONUS = 1.75;

/** +8% hp/dmg per upgrade level (PRD 6). */
export const upgradeMult = (lvl: number) => 1 + 0.08 * (lvl - 1);
/** Cost roughly doubles every 4 levels. */
export const upgradeCost = (lvl: number) => Math.round(100 * Math.pow(2, (lvl - 1) / 4) / 10) * 10;
export const MAX_UNIT_LEVEL = 20;

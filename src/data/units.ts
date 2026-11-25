// Unit stats. The first six player units are the PRD section 5 roster; their
// numbers feed the campaign tuning in levels.ts, so change them with care
// (re-run scripts/tune.ts afterwards).
export type UnitId =
  | 'miner' | 'sword' | 'archer' | 'spear' | 'camel' | 'catapult'
  | 'healer' | 'falcon' | 'fire' | 'lion' | 'assassin' | 'giant' | 'genie' | 'hero'
  | 'cavalry' | 'crossbow' | 'drummer' | 'elephant'
  | 'sultan' | 'dragon' | 'pharaoh' | 'valkyrie' | 'shadowqueen' | 'guardian' | 'firebird';
export type EnemyId = UnitId
  | 'bandit' | 'sandmage' | 'golem' | 'ghost' | 'boss'
  | 'hyena' | 'vulture' | 'scorpking' | 'roc' | 'worm' | 'titan' | 'djinn' | 'warlord'
  | 'mummy' | 'skeleton' | 'cobra' | 'mummyking' | 'cobraqueen' | 'phoenix'
  // civilizations
  | 'elfworker' | 'elfarcher' | 'bladedancer' | 'druid' | 'treant' | 'elkrider' | 'elfqueen'
  | 'wisp' | 'wraith' | 'banshee' | 'specter' | 'phantom' | 'ghostking'
  | 'gravedigger' | 'zombie' | 'runner' | 'bloater' | 'skelarcher' | 'abomination' | 'necromancer' | 'plaguelord'
  | 'dwarfminer' | 'axethrower' | 'shieldwall' | 'berserker' | 'cannon' | 'gyrocopter' | 'dwarfking'
  | 'goblin' | 'goblinspear' | 'ogre' | 'troll' | 'cyclops' | 'frostgiant' | 'giantking'
  | 'sprite' | 'moonarcher' | 'poltergeist' | 'soulreaper' | 'ghoul' | 'lich' | 'runepriest' | 'thunderlord' | 'mammoth' | 'colossus'
  // Nations War raid boss
  | 'ifrit';

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
  support?: boolean; // stays behind the line and doesn't attack (drummer)
  miner?: boolean; // digs gold at its side's mine
  mineMult?: number; // mining speed (dwarves dig faster)
  regen?: number; // hp per second
  explode?: { dmg: number; radius: number }; // bursts on death
  summon?: { unit: EnemyId; every: number }; // raises allies over time
  pierce?: boolean; // shots hit every foe along their path
  lifesteal?: number; // share of damage dealt returned as health
  raiseDead?: EnemyId; // fallen foes nearby rise as this unit on our side
  chain?: { count: number; stun: number }; // lightning jumps between foes
  stomp?: { every: number; radius: number; dmg: number; stun: number }; // ground slam
  hero?: boolean; // special character with a unique power
  premium?: boolean; // store legendary
  healAura?: { every: number; pct: number; radius: number }; // pulses healing to nearby allies
  maxCount?: number; // max alive at once
  boss?: boolean;
  height: number;
}

export const UNITS: Record<EnemyId, UnitDef> = {
  // --- Nations War: the Ember King, an ifrit warlord fought by two allied nations ---
  ifrit:    { id: 'ifrit', cost: 0, train: 0, hp: 4800, dmg: 72, range: 70, speed: 30, cooldown: 1.6, unlock: 99, height: 150, splash: 85, regen: 5, boss: true,
              stomp: { every: 8, radius: 210, dmg: 45, stun: 1.0 }, summon: { unit: 'fire', every: 11 } },
  // --- PRD roster ---
  miner:    { id: 'miner',    cost: 50,  train: 3,  hp: 60,  dmg: 2,  range: 22,  speed: 55, cooldown: 1.0, unlock: 1,  height: 49, miner: true },
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
  // --- Premium legends (store) ---
  sultan:   { id: 'sultan',   cost: 950, train: 12, hp: 2600, dmg: 70, range: 44, speed: 60, cooldown: 1.0, unlock: 99, height: 80, splash: 42, aura: 0.25, regen: 12, healAura: { every: 6, pct: 0.18, radius: 190 }, hero: true, premium: true, maxCount: 1 },
  dragon:   { id: 'dragon',   cost: 1100, train: 14, hp: 1900, dmg: 66, range: 230, speed: 70, cooldown: 1.6, unlock: 99, height: 96, flying: true, ranged: true, splash: 75, hero: true, premium: true, maxCount: 1 },
  pharaoh:  { id: 'pharaoh',  cost: 1000, train: 13, hp: 1500, dmg: 48, range: 220, speed: 48, cooldown: 1.6, unlock: 99, height: 78, ranged: true, splash: 45, summon: { unit: 'mummy', every: 6 }, raiseDead: 'mummy', hero: true, premium: true, maxCount: 1 },
  valkyrie: { id: 'valkyrie', cost: 1050, train: 13, hp: 1500, dmg: 52, range: 210, speed: 85, cooldown: 1.7, unlock: 99, height: 74, flying: true, ranged: true, chain: { count: 6, stun: 1.0 }, hero: true, premium: true, maxCount: 1 },
  shadowqueen:{ id: 'shadowqueen', cost: 1000, train: 12, hp: 1700, dmg: 64, range: 34, speed: 115, cooldown: 0.55, unlock: 99, height: 70, crit: 0.4, dodge: 0.35, lifesteal: 0.35, hero: true, premium: true, maxCount: 1 },
  guardian: { id: 'guardian', cost: 1150, train: 15, hp: 4800, dmg: 60, range: 54, speed: 30, cooldown: 1.6, unlock: 99, height: 120, splash: 55, regen: 20, stomp: { every: 6, radius: 190, dmg: 70, stun: 1.6 }, hero: true, premium: true, maxCount: 1 },
  firebird: { id: 'firebird', cost: 1100, train: 14, hp: 2000, dmg: 58, range: 240, speed: 95, cooldown: 1.4, unlock: 99, height: 92, flying: true, ranged: true, splash: 70, pierce: true, regen: 10, hero: true, premium: true, maxCount: 1 },
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
  // --- v0.3 player units ---
  cavalry:  { id: 'cavalry',  cost: 350, train: 7,  hp: 320, dmg: 24, range: 32,  speed: 125, cooldown: 0.9, unlock: 26, height: 78, charge: true, bonusVs: ['archer', 'catapult', 'crossbow', 'sandmage'] },
  crossbow: { id: 'crossbow', cost: 280, train: 6,  hp: 110, dmg: 34, range: 280, speed: 46, cooldown: 2.2, unlock: 34, height: 56, ranged: true, bonusVs: ['giant', 'golem', 'elephant', 'titan', 'mummy', 'spear'] },
  drummer:  { id: 'drummer',  cost: 220, train: 5,  hp: 130, dmg: 0,  range: 160, speed: 50, cooldown: 1.0, unlock: 99, height: 55, aura: 0.15, support: true },
  elephant: { id: 'elephant', cost: 850, train: 14, hp: 2300, dmg: 44, range: 46, speed: 30, cooldown: 1.8, unlock: 99, height: 105, splash: 52, charge: true },
  // --- v0.3 monsters ---
  mummy:    { id: 'mummy',    cost: 0, train: 0, hp: 280, dmg: 16, range: 28,  speed: 36, cooldown: 1.1, unlock: 99, height: 58 },
  skeleton: { id: 'skeleton', cost: 0, train: 0, hp: 95,  dmg: 13, range: 26,  speed: 72, cooldown: 0.8, unlock: 99, height: 55 },
  cobra:    { id: 'cobra',    cost: 0, train: 0, hp: 130, dmg: 18, range: 30,  speed: 100, cooldown: 0.7, unlock: 99, height: 40, crit: 0.2 },
  mummyking:{ id: 'mummyking',cost: 0, train: 0, hp: 3600, dmg: 38, range: 55, speed: 30, cooldown: 1.5, unlock: 99, height: 118, splash: 48, aura: 0.2, boss: true },
  cobraqueen:{ id: 'cobraqueen', cost: 0, train: 0, hp: 3200, dmg: 40, range: 60, speed: 58, cooldown: 1.0, unlock: 99, height: 90, splash: 40, crit: 0.25, boss: true },
  phoenix:  { id: 'phoenix',  cost: 0, train: 0, hp: 3400, dmg: 38, range: 200, speed: 70, cooldown: 1.7, unlock: 99, height: 90, flying: true, ranged: true, splash: 58, boss: true },
  // --- Elves: fast, long-ranged, nature magic ---
  elfworker:  { id: 'elfworker',  cost: 0, train: 0, hp: 60,  dmg: 2,  range: 22, speed: 62, cooldown: 1, unlock: 99, height: 50, miner: true },
  elfarcher:  { id: 'elfarcher',  cost: 0, train: 0, hp: 75,  dmg: 14, range: 280, speed: 60, cooldown: 1.15, unlock: 99, height: 56, ranged: true, bonusVs: ['spear', 'shieldwall'] },
  bladedancer:{ id: 'bladedancer',cost: 0, train: 0, hp: 130, dmg: 15, range: 26, speed: 98, cooldown: 0.55, unlock: 99, height: 56, dodge: 0.3 },
  druid:      { id: 'druid',      cost: 0, train: 0, hp: 100, dmg: 0,  range: 150, speed: 50, cooldown: 1.3, unlock: 99, height: 56, heal: 16 },
  treant:     { id: 'treant',     cost: 0, train: 0, hp: 900, dmg: 26, range: 42, speed: 26, cooldown: 1.8, unlock: 99, height: 105, splash: 32, regen: 6 },
  elkrider:   { id: 'elkrider',   cost: 0, train: 0, hp: 320, dmg: 26, range: 34, speed: 115, cooldown: 1.0, unlock: 99, height: 82, charge: true, bonusVs: ['archer', 'crossbow'] },
  elfqueen:   { id: 'elfqueen',   cost: 0, train: 0, hp: 3000, dmg: 36, range: 230, speed: 40, cooldown: 1.6, unlock: 99, height: 96, ranged: true, splash: 55, regen: 12, boss: true },
  // --- Ghosts: flying, dodging, wailing ---
  wisp:       { id: 'wisp',       cost: 0, train: 0, hp: 55,  dmg: 2,  range: 22, speed: 60, cooldown: 1, unlock: 99, height: 40, miner: true },
  wraith:     { id: 'wraith',     cost: 0, train: 0, hp: 110, dmg: 14, range: 30, speed: 95, cooldown: 0.8, unlock: 99, height: 52, flying: true },
  banshee:    { id: 'banshee',    cost: 0, train: 0, hp: 90,  dmg: 15, range: 190, speed: 48, cooldown: 2.0, unlock: 99, height: 58, ranged: true, splash: 40 },
  specter:    { id: 'specter',    cost: 0, train: 0, hp: 380, dmg: 20, range: 32, speed: 46, cooldown: 1.1, unlock: 99, height: 66, dodge: 0.2 },
  phantom:    { id: 'phantom',    cost: 0, train: 0, hp: 150, dmg: 22, range: 28, speed: 105, cooldown: 0.8, unlock: 99, height: 56, crit: 0.3, dodge: 0.15 },
  ghostking:  { id: 'ghostking',  cost: 0, train: 0, hp: 3200, dmg: 40, range: 60, speed: 44, cooldown: 1.4, unlock: 99, height: 110, flying: true, splash: 50, dodge: 0.1, boss: true },
  // --- Zombies: cheap hordes, explosions, necromancy ---
  gravedigger:{ id: 'gravedigger',cost: 0, train: 0, hp: 70,  dmg: 3,  range: 22, speed: 45, cooldown: 1, unlock: 99, height: 50, miner: true },
  zombie:     { id: 'zombie',     cost: 0, train: 0, hp: 140, dmg: 10, range: 26, speed: 30, cooldown: 1.1, unlock: 99, height: 56 },
  runner:     { id: 'runner',     cost: 0, train: 0, hp: 80,  dmg: 11, range: 26, speed: 110, cooldown: 0.7, unlock: 99, height: 54 },
  bloater:    { id: 'bloater',    cost: 0, train: 0, hp: 230, dmg: 8,  range: 26, speed: 28, cooldown: 1.2, unlock: 99, height: 64, explode: { dmg: 70, radius: 75 } },
  skelarcher: { id: 'skelarcher', cost: 0, train: 0, hp: 70,  dmg: 12, range: 220, speed: 55, cooldown: 1.4, unlock: 99, height: 55, ranged: true },
  abomination:{ id: 'abomination',cost: 0, train: 0, hp: 1100, dmg: 30, range: 40, speed: 24, cooldown: 1.6, unlock: 99, height: 100, splash: 36 },
  necromancer:{ id: 'necromancer',cost: 0, train: 0, hp: 110, dmg: 14, range: 190, speed: 44, cooldown: 1.8, unlock: 99, height: 58, ranged: true, summon: { unit: 'zombie', every: 9 } },
  plaguelord: { id: 'plaguelord', cost: 0, train: 0, hp: 3500, dmg: 42, range: 60, speed: 28, cooldown: 1.5, unlock: 99, height: 120, splash: 55, summon: { unit: 'runner', every: 6 }, boss: true },
  // --- Dwarves: sturdy, siege engines, rich mines ---
  dwarfminer: { id: 'dwarfminer', cost: 0, train: 0, hp: 90,  dmg: 4,  range: 22, speed: 45, cooldown: 1, unlock: 99, height: 42, miner: true, mineMult: 1.4 },
  axethrower: { id: 'axethrower', cost: 0, train: 0, hp: 130, dmg: 18, range: 180, speed: 44, cooldown: 1.4, unlock: 99, height: 46, ranged: true },
  shieldwall: { id: 'shieldwall', cost: 0, train: 0, hp: 620, dmg: 10, range: 30, speed: 32, cooldown: 1.0, unlock: 99, height: 48, bonusVs: ['cavalry', 'camel', 'lion'] },
  berserker:  { id: 'berserker',  cost: 0, train: 0, hp: 230, dmg: 24, range: 28, speed: 70, cooldown: 0.8, unlock: 99, height: 47, crit: 0.2 },
  cannon:     { id: 'cannon',     cost: 0, train: 0, hp: 260, dmg: 70, range: 330, speed: 26, cooldown: 3.4, unlock: 99, height: 46, ranged: true, splash: 60 },
  gyrocopter: { id: 'gyrocopter', cost: 0, train: 0, hp: 170, dmg: 14, range: 160, speed: 80, cooldown: 1.2, unlock: 99, height: 46, flying: true, ranged: true },
  dwarfking:  { id: 'dwarfking',  cost: 0, train: 0, hp: 3600, dmg: 44, range: 50, speed: 30, cooldown: 1.3, unlock: 99, height: 82, splash: 48, aura: 0.2, boss: true },
  // --- Giants: few, huge, devastating ---
  goblin:     { id: 'goblin',     cost: 0, train: 0, hp: 55,  dmg: 2,  range: 22, speed: 65, cooldown: 1, unlock: 99, height: 40, miner: true },
  goblinspear:{ id: 'goblinspear',cost: 0, train: 0, hp: 90,  dmg: 10, range: 34, speed: 72, cooldown: 0.8, unlock: 99, height: 42 },
  ogre:       { id: 'ogre',       cost: 0, train: 0, hp: 720, dmg: 30, range: 40, speed: 34, cooldown: 1.4, unlock: 99, height: 96, splash: 32 },
  troll:      { id: 'troll',      cost: 0, train: 0, hp: 520, dmg: 22, range: 36, speed: 42, cooldown: 1.0, unlock: 99, height: 90, regen: 10 },
  cyclops:    { id: 'cyclops',    cost: 0, train: 0, hp: 820, dmg: 45, range: 260, speed: 30, cooldown: 3.0, unlock: 99, height: 108, ranged: true, splash: 45 },
  frostgiant: { id: 'frostgiant', cost: 0, train: 0, hp: 1650, dmg: 50, range: 50, speed: 24, cooldown: 1.8, unlock: 99, height: 130, splash: 50 },
  giantking:  { id: 'giantking',  cost: 0, train: 0, hp: 5200, dmg: 60, range: 60, speed: 24, cooldown: 1.8, unlock: 99, height: 150, splash: 60, regen: 8, boss: true },
  // --- Civilization specials & heroes ---
  sprite:     { id: 'sprite',     cost: 0, train: 0, hp: 70,  dmg: 11, range: 170, speed: 90, cooldown: 1.1, unlock: 99, height: 34, flying: true, ranged: true },
  moonarcher: { id: 'moonarcher', cost: 0, train: 0, hp: 650, dmg: 34, range: 320, speed: 60, cooldown: 1.6, unlock: 99, height: 66, ranged: true, pierce: true, hero: true, maxCount: 1 },
  poltergeist:{ id: 'poltergeist',cost: 0, train: 0, hp: 120, dmg: 18, range: 200, speed: 55, cooldown: 1.9, unlock: 99, height: 50, ranged: true, splash: 45, flying: true },
  soulreaper: { id: 'soulreaper', cost: 0, train: 0, hp: 900, dmg: 40, range: 44, speed: 70, cooldown: 1.0, unlock: 99, height: 76, splash: 40, lifesteal: 0.5, flying: true, hero: true, maxCount: 1 },
  ghoul:      { id: 'ghoul',      cost: 0, train: 0, hp: 260, dmg: 18, range: 28, speed: 85, cooldown: 0.7, unlock: 99, height: 56, lifesteal: 0.25 },
  lich:       { id: 'lich',       cost: 0, train: 0, hp: 700, dmg: 30, range: 220, speed: 44, cooldown: 1.8, unlock: 99, height: 72, ranged: true, splash: 45, raiseDead: 'zombie', hero: true, maxCount: 1 },
  runepriest: { id: 'runepriest', cost: 0, train: 0, hp: 160, dmg: 0,  range: 150, speed: 42, cooldown: 1.3, unlock: 99, height: 46, heal: 20 },
  thunderlord:{ id: 'thunderlord',cost: 0, train: 0, hp: 1100, dmg: 32, range: 200, speed: 46, cooldown: 2.0, unlock: 99, height: 62, ranged: true, chain: { count: 5, stun: 0.9 }, hero: true, maxCount: 1 },
  mammoth:    { id: 'mammoth',    cost: 0, train: 0, hp: 1500, dmg: 36, range: 46, speed: 40, cooldown: 1.6, unlock: 99, height: 110, splash: 46, charge: true },
  colossus:   { id: 'colossus',   cost: 0, train: 0, hp: 2600, dmg: 52, range: 54, speed: 28, cooldown: 1.7, unlock: 99, height: 140, splash: 50, stomp: { every: 7, radius: 170, dmg: 45, stun: 1.4 }, hero: true, maxCount: 1 },
  warlord:  { id: 'warlord',  cost: 0, train: 0, hp: 6500, dmg: 60, range: 55, speed: 34, cooldown: 1.3, unlock: 99, height: 120, splash: 45, aura: 0.2, boss: true },
};

/** Order of the unit bar. */
export const PLAYER_UNITS: UnitId[] = ['miner', 'sword', 'archer', 'spear', 'camel', 'cavalry', 'crossbow', 'catapult', 'healer', 'drummer', 'falcon', 'fire', 'lion', 'assassin', 'giant', 'elephant', 'genie', 'hero', 'sultan', 'dragon', 'pharaoh', 'valkyrie', 'shadowqueen', 'guardian', 'firebird'];
export const PREMIUM_UNITS: UnitId[] = ['sultan', 'dragon', 'pharaoh', 'valkyrie', 'shadowqueen', 'guardian', 'firebird'];
export const BASE_UNITS: UnitId[] = ['miner', 'sword', 'archer', 'spear', 'camel', 'cavalry', 'crossbow', 'catapult'];

export const MINER_GOLD = 5;
export const MINER_INTERVAL = 3;
export const MAX_MINERS = 10;
export const MINE_UPGRADE = [0, 300, 550]; // in-battle mine upgrade prices (level 2, 3)
export const MINE_YIELD = [1, 1.25, 1.55];
export const MAX_ARMY = 40;
export const CONTROL_BONUS = 1.3;
export const COUNTER_BONUS = 1.75;
export const FLY_HEIGHT = 95;
export const MAX_RANK = 3; // veteran ranks earned from kills
export const RANK_KILLS = [3, 7, 12]; // kills needed for ★, ★★, ★★★
export const RANK_HEAL = [0.3, 0.5, 1]; // share of max HP restored on each promotion

/** +8% hp/dmg per upgrade level (PRD 6). */
export const upgradeMult = (lvl: number) => 1 + 0.08 * (lvl - 1);
/** Cost roughly doubles every 4 levels; premium units cost more to upgrade. */
export const upgradeCost = (lvl: number, id?: UnitId) =>
  Math.round((100 * Math.pow(2, (lvl - 1) / 4) * (id && !BASE_UNITS.includes(id) ? 1.6 : 1)) / 10) * 10;
export const MAX_UNIT_LEVEL = 20;

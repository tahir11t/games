// Nations War: three modes where several AI nations share the battlefield.
//  • ffa  — Three Kingdoms: you, a nation on the right and a nation in a mid-field citadel; all at war.
//  • duo  — 2 vs 2: you and an allied nation against two enemy nations.
//  • raid — Allied Raid: you and an allied nation against the Ember King (a new hero boss) and his horde.
// Matchups rotate daily (same for every player on a UTC date); strength follows campaign progress.
import { buildLevel, type LevelDef, type NationSpec, type WarSpec, type RegionId } from './levels';
import { UNITS, upgradeMult, type EnemyId } from './units';
import { FACTIONS } from './factions';

export type WarMode = 'ffa' | 'duo' | 'raid' | 'blitz';
export const WAR_MODES: WarMode[] = ['ffa', 'duo', 'raid'];
export const WAR_TIERS = 3;
export const WAR_ICON: Record<WarMode, string> = { ffa: '👑', duo: '🤝', raid: '🔥', blitz: '⏱️' };
/** Strength per tier, and tuning factors found with scripts/war.ts. */
export const WAR_TIER_MULT: Record<WarMode, number[]> = { ffa: [0.95, 1.15, 1.35], duo: [1, 1.15, 1.32], raid: [1, 1.16, 1.25], blitz: [1, 1, 1] };
export const WAR_TUNE: Record<WarMode, number> = { ffa: 0.9, duo: 0.72, raid: 0.5, blitz: 1 };

const ENEMY_COLORS = ['#c8323c', '#7a3fb0', '#2f8f4e', '#3f6fa8', '#d07a1f'];
const dayNumber = (date: string) => Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);

/** The nations fighting today (deterministic per date). */
export function warLineup(mode: WarMode, date: string) {
  const ids = FACTIONS.map((f) => f.id);
  const d = dayNumber(date) + (mode === 'duo' ? 2 : mode === 'raid' ? 4 : 0);
  const pick = (k: number) => ids[(d * 3 + k * 2) % ids.length];
  const a = pick(0), b = ids[(ids.indexOf(a) + 1 + (d % 3)) % ids.length];
  const c = ids.find((x) => x !== a && x !== b && ids.indexOf(x) % 2 === d % 2) ?? ids.find((x) => x !== a && x !== b)!;
  const e = ids.find((x) => x !== a && x !== b && x !== c)!;
  if (mode === 'ffa' || mode === 'blitz') return { foes: [a, b], allies: mode === 'blitz' ? [c] : ([] as string[]) };
  if (mode === 'duo') return { foes: [a, b], allies: [c] };
  return { foes: [a], allies: [e] };
}

/** Bosses for Boss Blitz (2 minutes to win), with their home region. */
export const BLITZ_BOSSES: { id: EnemyId; region: RegionId; mult: number }[] = [
  { id: 'ifrit', region: 'dunes', mult: 0.55 },
  { id: 'warlord', region: 'shadow', mult: 1.5 },
  { id: 'elfqueen', region: 'forest', mult: 1 },
  { id: 'ghostking', region: 'graveyard', mult: 0.45 },
  { id: 'plaguelord', region: 'graveyard', mult: 1.3 },
  { id: 'dwarfking', region: 'mountains', mult: 1.3 },
  { id: 'giantking', region: 'tundra', mult: 1.4 },
];
export const BLITZ_TIME = 120;
export const BLITZ = { tune: 0.85 }; // health factor found with scripts/war.ts
/** Boss Blitz: the boss comes at once; beat it within the time limit, alone or with an allied nation. */
export function blitzLevel(bossIdx: number, withAlly: boolean, unlocked: number, date: string): LevelDef {
  const ref = Math.max(8, Math.min(60, unlocked));
  const expUpg = Math.min(18, 1 + Math.floor((ref - 1) / 2.6));
  const stat = upgradeMult(expUpg) * (0.92 - Math.max(0, ref - 30) * 0.005);
  const B = BLITZ_BOSSES[bossIdx];
  const { allies, foes } = warLineup('blitz', date);
  const nations: NationSpec[] = [];
  if (withAlly) nations.push({ faction: allies[0], side: 0, castle: 0, ally: true, stat: stat * 0.9, income: 6 + ref * 0.05, startGold: 400, color: '#38b6a8' });
  // a token guard so the boss has escorts (weaker when you come alone)
  nations.push({ faction: foes[0], side: 1, castle: 1, stat: stat * 0.8, income: (withAlly ? 1.4 : 1) + ref * 0.012, startGold: 0, color: '#c8323c', road: 0 });
  // every boss gets a comparable health pool for the time limit (more when you bring an ally)
  const want = (2400 + ref * 45) * (withAlly ? 1.35 : 1) * B.mult * BLITZ.tune;
  const war: WarSpec = { mode: 'blitz', ffa: false, roads: true, nations, boss: B.id, bossAt: 3, bossMult: want / (UNITS[B.id].hp * stat * 0.8), grace: 0, timeLimit: BLITZ_TIME, bossDmg: 0.5 };
  return {
    index: 450 + bossIdx, region: B.region, boss: true, kind: 'war', id: `blitz-${bossIdx}-${withAlly ? 1 : 0}`,
    castleHp: Infinity, enemyMult: stat, waves: [], loopAfter: Infinity, reward: 300 + ref * 8, noCounters: true, towerDmg: 0,
    faction: foes[0], enemyColor: '#c8323c', startGold: 850, war,
  };
}

export function warLevel(mode: WarMode, tier: number, unlocked: number, date: string): LevelDef {
  const ref = Math.max(8, Math.min(60, unlocked)); // a campaign level of similar strength
  const base = buildLevel(ref);
  const expUpg = Math.min(18, 1 + Math.floor((ref - 1) / 2.6));
  const k = WAR_TIER_MULT[mode][tier] * WAR_TUNE[mode];
  const stat = upgradeMult(expUpg) * (0.92 - Math.max(0, ref - 30) * 0.005) * k; // enemies match the expected upgrade level (softer late on)
  const income = (5.2 + Math.min(ref, 30) * 0.07 + Math.max(0, ref - 30) * 0.03) * k; // gold per second
  const { foes, allies } = warLineup(mode, date);
  const nation = (faction: string, side: 0 | 1, castle: 0 | 1 | 2, i: number, ally = false): NationSpec => ({
    faction, side, castle, ally, stat: ally ? stat * 0.9 / k : stat, income: ally ? income * 1.05 / k : income, startGold: 160, color: ally ? '#38b6a8' : ENEMY_COLORS[(FACTIONS.findIndex((f) => f.id === faction) + i) % ENEMY_COLORS.length],
  });
  let war: WarSpec;
  if (mode === 'ffa') war = { mode, ffa: true, roads: true, nations: [nation(foes[0], 1, 1, 0), nation(foes[1], 1, 2, 1)], citadelHp: Math.round(base.castleHp * 0.9 * k), grace: 30 };
  // 2 vs 2: each enemy nation marches on its own road
  else if (mode === 'duo') war = { mode, ffa: false, roads: true, nations: [nation(allies[0], 0, 0, 0, true), { ...nation(foes[0], 1, 1, 0), road: 0 }, { ...nation(foes[1], 1, 1, 1), road: 1 }], grace: 32 };
  // raid: the Ember King takes the south road, his horde the north road
  else war = { mode, ffa: false, roads: true, nations: [nation(allies[0], 0, 0, 0, true), { ...nation(foes[0], 1, 1, 0), income: income * 0.5, stat: stat * 0.85, road: 0 }], boss: 'ifrit', bossAt: 55, bossMult: 1, grace: 25 };
  const fac = FACTIONS.find((f) => f.id === foes[0])!;
  return {
    index: 400 + WAR_MODES.indexOf(mode) * 10 + tier, region: fac.region, boss: mode === 'raid', kind: 'war', id: `${mode}-${tier}`,
    castleHp: mode === 'raid' ? Infinity : Math.round(base.castleHp * (mode === 'duo' ? 1.5 : 1) * k),
    enemyMult: stat, waves: [], loopAfter: Infinity, reward: 260 + ref * 8 + tier * 120, noCounters: true,
    towerDmg: mode === 'raid' ? 0 : base.towerDmg, faction: foes[0], enemyColor: war.nations.find((n) => n.castle === 1)!.color, war,
  };
}

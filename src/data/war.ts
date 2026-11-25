// Nations War: three modes where several AI nations share the battlefield.
//  • ffa  — Three Kingdoms: you, a nation on the right and a nation in a mid-field citadel; all at war.
//  • duo  — 2 vs 2: you and an allied nation against two enemy nations.
//  • raid — Allied Raid: you and an allied nation against the Ember King (a new hero boss) and his horde.
// Matchups rotate daily (same for every player on a UTC date); strength follows campaign progress.
import { buildLevel, type LevelDef, type NationSpec, type WarSpec } from './levels';
import { FACTIONS } from './factions';
import { upgradeMult } from './units';

export type WarMode = 'ffa' | 'duo' | 'raid';
export const WAR_MODES: WarMode[] = ['ffa', 'duo', 'raid'];
export const WAR_TIERS = 3;
export const WAR_ICON: Record<WarMode, string> = { ffa: '👑', duo: '🤝', raid: '🔥' };
/** Strength per tier, and tuning factors found with scripts/war.ts. */
export const WAR_TIER_MULT: Record<WarMode, number[]> = { ffa: [0.95, 1.15, 1.35], duo: [1, 1.13, 1.24], raid: [1, 1.16, 1.25] };
export const WAR_TUNE: Record<WarMode, number> = { ffa: 1.1, duo: 1.15, raid: 0.56 };

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
  if (mode === 'ffa') return { foes: [a, b], allies: [] as string[] };
  if (mode === 'duo') return { foes: [a, b], allies: [c] };
  return { foes: [a], allies: [e] };
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
  if (mode === 'ffa') war = { mode, ffa: true, nations: [nation(foes[0], 1, 1, 0), nation(foes[1], 1, 2, 1)], citadelHp: Math.round(base.castleHp * 0.9 * k), grace: 30 };
  else if (mode === 'duo') war = { mode, ffa: false, nations: [nation(allies[0], 0, 0, 0, true), nation(foes[0], 1, 1, 0), nation(foes[1], 1, 1, 1)], grace: 32 };
  else war = { mode, ffa: false, nations: [nation(allies[0], 0, 0, 0, true), { ...nation(foes[0], 1, 1, 0), income: income * 0.5, stat: stat * 0.85 }], boss: 'ifrit', bossAt: 55, bossMult: 1, grace: 25 };
  const fac = FACTIONS.find((f) => f.id === foes[0])!;
  return {
    index: 400 + WAR_MODES.indexOf(mode) * 10 + tier, region: fac.region, boss: mode === 'raid', kind: 'war', id: `${mode}-${tier}`,
    castleHp: mode === 'raid' ? Infinity : Math.round(base.castleHp * (mode === 'duo' ? 1.5 : 1) * k),
    enemyMult: stat, waves: [], loopAfter: Infinity, reward: 260 + ref * 8 + tier * 120, noCounters: true,
    towerDmg: mode === 'raid' ? 0 : base.towerDmg, faction: foes[0], enemyColor: war.nations.find((n) => n.castle === 1)!.color, war,
  };
}

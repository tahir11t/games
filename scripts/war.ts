// Bot win-rates for the Nations War modes (Three Kingdoms, 2 vs 2, Allied Raid)
// at each tier, for a player at campaign level REF with expected upgrades.
// Run: npx tsx scripts/war.ts   (REF=30 N=10)
import { Battle } from '../src/game/battle';
import { UNITS, type UnitId } from '../src/data/units';
import { warLevel, WAR_MODES, WAR_TIERS, type WarMode } from '../src/data/war';
import { expectedUpgrade } from './balance';

const REF = Number(process.env.REF ?? 30), N = Number(process.env.N ?? 10);
const DATES = ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];

export function playWar(mode: WarMode, tier: number, ref: number, date: string) {
  const L = warLevel(mode, tier, ref, date);
  const upg = expectedUpgrade(ref);
  const lv = Object.fromEntries(Object.keys(UNITS).map((k) => [k, upg])) as Record<UnitId, number>;
  lv.miner = 1;
  let res: boolean | null = null;
  const b = new Battle(L, { unitLevels: lv, difficulty: 'medium' }, 150, { onEnd: (w) => (res = w), onUnitTrained: () => {} });
  const avail = (id: UnitId) => UNITS[id].unlock <= ref;
  let think = 0;
  while (res === null && b.time < 600) {
    b.update(1 / 30); think -= 1 / 30;
    if (think > 0) continue; think = 0.5;
    const army = b.playerArmy.filter((u) => u.nation === 0 && !u.def.miner);
    if (b.minerCount() < 8 && b.canTrain('miner') && (army.length >= 2 || b.minerCount() < 3)) { b.train('miner'); continue; }
    const comp = (['sword', 'archer', 'sword', 'spear', 'camel', 'cavalry', 'crossbow', 'catapult'] as UnitId[]).filter(avail);
    const pick = comp[Math.floor(Math.random() * comp.length)];
    if (b.queue.length < 2) b.train(pick);
    const enemies = b.units.filter((u) => u.side === 1 && !u.dead);
    if (army.length >= 10 && b.mode !== 'attack') b.setMode('attack');
    else if (army.length < 4 && b.mode === 'attack') b.setMode('defend');
    if (b.ability >= 1 && enemies.length >= 3) b.useAbility();
    if (b.gold > b.mineCost() + 250) b.upgradeMine();
  }
  return { win: res === true, time: b.time, timeout: res === null };
}

if (process.argv[1]?.endsWith('war.ts')) {
  for (const mode of WAR_MODES) {
    const row: string[] = [];
    for (let tier = 0; tier < WAR_TIERS; tier++) {
      let w = 0, t = 0, to = 0;
      for (let k = 0; k < N; k++) { const r = playWar(mode, tier, REF, DATES[k % DATES.length]); if (r.win) { w++; t += r.time; } if (r.timeout) to++; }
      row.push(`T${tier + 1} ${String(Math.round((w / N) * 100)).padStart(3)}% ${w ? Math.round(t / w) + 's' : '-'}${to ? ` (${to} timeout)` : ''}`);
    }
    console.log(mode.padEnd(5), row.join('  '));
  }
}

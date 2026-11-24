// Bot win-rates for monster challenges, assuming the player is at the required
// campaign level with expected upgrades and the units earned before it.
// Run: npx tsx scripts/challenges.ts
import { Battle } from '../src/game/battle';
import { readFileSync, writeFileSync } from 'node:fs';
import { CHALLENGES, challengeLevel } from '../src/data/challenges';
import { UNITS, type UnitId } from '../src/data/units';
import { expectedUpgrade } from './balance';

const earned: Record<string, UnitId[]> = { hyenas: ['lion'], siege: ['drummer'], scorpion: ['assassin'], roc: ['falcon'], titan: ['giant'], stampede: ['elephant'], djinn: ['genie'], warlord: ['hero'] };

function play(ci: number, upgBonus: number, tune?: number) {
  const c = CHALLENGES[ci];
  const L = challengeLevel(c, tune);
  const upg = expectedUpgrade(c.reqLevel) + upgBonus;
  const owned: UnitId[] = ['healer'];
  for (const prev of CHALLENGES.slice(0, ci)) owned.push(...(earned[prev.id] ?? []));
  if (c.reqLevel >= 18) owned.push('fire');
  const lv = Object.fromEntries(Object.keys(UNITS).map((k) => [k, upg])) as Record<UnitId, number>;
  lv.miner = 1;
  let res: boolean | null = null;
  const b = new Battle(L, { unitLevels: lv }, 150, { onEnd: (w) => (res = w), onUnitTrained: () => {} });
  const avail = (id: UnitId) => b.isAllowed(id) && ((UNITS[id].unlock <= c.reqLevel) || owned.includes(id));
  let think = 0;
  while (res === null && b.time < 600) {
    b.update(1 / 30); think -= 1 / 30;
    if (think > 0) continue; think = 0.5;
    const army = b.playerArmy.filter((u) => u.def.id !== 'miner');
    if (b.minerCount() < 6 && b.canTrain('miner') && (army.length >= 2 || b.minerCount() < 3)) { b.train('miner'); continue; }
    const enemies = b.units.filter((u) => u.side === 1 && !u.dead);
    const flyers = enemies.some((e) => e.def.flying) || ['roc', 'djinn', 'warlord', 'phoenix'].includes(c.id);
    const comp = (['sword', 'archer', 'spear', 'camel', 'cavalry', 'crossbow', 'catapult', 'healer', 'drummer', 'falcon', 'fire', 'lion', 'assassin', 'giant', 'elephant', 'genie', 'hero'] as UnitId[]).filter(avail);
    // Like a real player: answer flyers with ranged / flying units.
    const air = comp.filter((id) => (UNITS[id].ranged && id !== 'catapult') || UNITS[id].flying || UNITS[id].heal);
    const flyerShare = enemies.length ? enemies.filter((e) => e.def.flying).length / enemies.length : 0;
    const pool = flyers && air.length && Math.random() < 0.4 + flyerShare * 0.5 ? air : comp;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick && b.queue.length < 2) b.train(pick);
    if (c.winAfter) b.setMode('defend');
    else if (army.length >= 12 && b.mode !== 'attack') b.setMode('attack');
    else if (army.length < 5 && b.mode === 'attack') b.setMode('defend');
    if (b.ability >= 1 && enemies.length >= 3) b.useAbility();
  }
  return res === true;
}
const rate = (i: number, bonus: number, tune?: number, n = 10) => { let w = 0; for (let k = 0; k < n; k++) if (play(i, bonus, tune)) w++; return w / n; };
if (process.argv.includes('--tune')) {
  // Find the strength factor giving ~50% wins at +2 upgrade levels.
  const out: string[] = [];
  for (let i = 0; i < CHALLENGES.length; i++) {
    let lo = 0.15, hi = 1.6;
    for (let step = 0; step < 8; step++) { const mid = (lo + hi) / 2; if (rate(i, 2, mid) >= 0.5) lo = mid; else hi = mid; }
    out.push(`${CHALLENGES[i].id}: ${Math.round(lo * 100) / 100}`);
    console.log(out[out.length - 1]);
  }
  const f = 'src/data/challenges.ts';
  writeFileSync(f, readFileSync(f, 'utf8').replace(/export const CH_TUNE: [^=]+= \{[^}]*\};/, `export const CH_TUNE: Partial<Record<ChallengeId, number>> = { ${out.join(', ')} };`));
}
for (let i = 0; i < CHALLENGES.length; i++) {
  const row: string[] = [];
  for (const bonus of [0, 2, 4]) { let w = 0; for (let k = 0; k < 8; k++) if (play(i, bonus)) w++; row.push(`+${bonus}upg ${Math.round((w / 8) * 100)}%`); }
  console.log(CHALLENGES[i].id.padEnd(9), row.join('  '));
}

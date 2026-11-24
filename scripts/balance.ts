// Headless balance simulation: a scripted "average player" bot plays every level.
// Run: npx tsx scripts/balance.ts
import { Battle } from '../src/game/battle';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { UNITS, type UnitId } from '../src/data/units';

export function play(levelIdx: number, upg: number, skill: number, level?: LevelDef) {
  const L = level ?? LEVELS[levelIdx - 1];
  let result: boolean | null = null;
  const lv = { miner: 1, sword: upg, archer: upg, spear: upg, camel: upg, catapult: upg } as Record<UnitId, number>;
  const b = new Battle(L, { unitLevels: lv, difficulty: (process.env.DIFF ?? 'medium') as 'easy' | 'medium' | 'hard' }, 150, { onEnd: (w) => (result = w), onUnitTrained: () => {} });
  const avail = (id: UnitId) => UNITS[id].unlock <= levelIdx;
  const dt = 1 / 30;
  let think = 0;
  while (result === null && b.time < 600) {
    b.update(dt);
    think -= dt;
    if (think > 0) continue;
    think = 0.5 / skill;
    const army = b.playerArmy.filter((u) => u.def.id !== 'miner');
    const miners = b.minerCount();
    if (miners < (levelIdx < 5 ? 4 : 6) && b.canTrain('miner') && (army.length >= 2 || miners < 3)) { b.train('miner'); continue; }
    const enemies = b.units.filter((u) => u.side === 1 && !u.dead);
    const comp: UnitId[] = ['sword'];
    if (avail('archer')) comp.push('archer', 'sword');
    if (avail('spear')) comp.push('spear');
    if (avail('camel') && enemies.some((e) => e.def.ranged)) comp.push('camel');
    if (avail('cavalry')) comp.push('cavalry');
    if (avail('crossbow')) comp.push('crossbow');
    if (avail('catapult') && army.length > 6) comp.push('catapult');
    const pick = comp[Math.floor(Math.random() * comp.length)];
    if (b.queue.length < 2) b.train(pick);
    const threshold = 6 + Math.min(10, levelIdx / 3);
    if (army.length >= threshold && b.mode !== 'attack') b.setMode('attack');
    else if (army.length < threshold * 0.4 && b.mode === 'attack') b.setMode('defend');
    if (b.ability >= 1 && enemies.length >= 3) b.useAbility();
  }
  if (process.env.DBG && result !== true) console.log(levelIdx, result === null ? "TIMEOUT" : "LOSS", Math.round(b.time), "castle", b.castleHp.map(Math.round), "enemies", b.units.filter((u) => u.side === 1 && !u.dead).length, "army", b.playerArmy.length, "loops", b.loopCount);
  return { win: result === true, time: b.time, stars: b.stars(result === true) };
}

export const expectedUpgrade = (i: number) => Math.min(18, 1 + Math.floor((i - 1) / 2.6));
if (process.argv[1]?.endsWith('balance.ts')) {
const rows: string[] = [];
const FROM = Number(process.env.FROM ?? 1), TO = Number(process.env.TO ?? 50);
for (let i = FROM; i <= TO; i++) {
  const upg = Math.min(20, expectedUpgrade(i) + Number(process.env.UPG_BONUS ?? 0));
  let wins = 0, t = 0, st = 0;
  const N = 8;
  for (let k = 0; k < N; k++) { const r = play(i, upg, 1); if (r.win) { wins++; t += r.time; st += r.stars; } }
  rows.push(`L${String(i).padStart(2)} upg${String(upg).padStart(2)}  win ${String(Math.round((wins / N) * 100)).padStart(3)}%  avgT ${wins ? Math.round(t / wins) : '-'}s  stars ${wins ? (st / wins).toFixed(1) : '-'}`);
}
console.log(rows.join('\n'));
}

// Finds a per-level difficulty factor so the "average player" bot wins ~75%
// of the time at the expected upgrade level. Writes TUNE into src/data/levels.ts.
// Run: npx tsx scripts/tune.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { buildLevel } from '../src/data/levels';
import { play, expectedUpgrade } from './balance';

const N = 12;
const target = (i: number) => (i <= 5 ? 0.95 : i % 10 === 0 ? 0.65 : 0.75);
const winRate = (i: number, tune: number) => {
  const L = buildLevel(i, tune);
  let w = 0;
  for (let k = 0; k < N; k++) if (play(i, expectedUpgrade(i), 1, L).win) w++;
  return w / N;
};
const out: number[] = [];
for (let i = 1; i <= 40; i++) {
  let lo = 0.5, hi = 1.6;
  for (let step = 0; step < 7; step++) {
    const mid = (lo + hi) / 2;
    if (winRate(i, mid) >= target(i)) lo = mid; else hi = mid;
  }
  // Keep the intro easy (PRD) and the curve from jumping: cap the factor.
  out.push(Math.round(Math.min(i <= 9 ? 1 : 1.25, lo) * 100) / 100);
  console.log(`L${i} tune ${out[i - 1]}`);
}
const file = 'src/data/levels.ts';
const src = readFileSync(file, 'utf8').replace(/export const TUNE: number\[\] = \[[^\]]*\];/, `export const TUNE: number[] = [${out.join(', ')}];`);
writeFileSync(file, src);

// Bot win-rates against each civilization; --tune searches FACTION_TUNE so the
// average battle is ~70% on medium at the expected upgrade level.
// Run: npx tsx scripts/conquest.ts [--tune]
import { readFileSync, writeFileSync } from 'node:fs';
import { FACTIONS, CONQUEST_BATTLES, conquestLevel, FACTION_TUNE, type FactionDef } from '../src/data/factions';
import { play, expectedUpgrade } from './balance';

const N = 8;
function rate(f: FactionDef, tune: number) {
  const prev = FACTION_TUNE[f.id];
  FACTION_TUNE[f.id] = tune;
  let w = 0, n = 0;
  for (let k = 1; k <= CONQUEST_BATTLES; k++) {
    const L = conquestLevel(f, k);
    const idx = Math.min(50, f.base + (k - 1) * 3);
    for (let i = 0; i < N; i++) { if (play(idx, expectedUpgrade(idx), 1, L).win) w++; n++; }
  }
  FACTION_TUNE[f.id] = prev;
  return w / n;
}
if (process.argv.includes('--tune')) {
  const out: string[] = [];
  for (const f of FACTIONS) {
    let lo = 0.3, hi = 2.5;
    for (let s = 0; s < 6; s++) { const mid = (lo + hi) / 2; if (rate(f, mid) >= 0.7) lo = mid; else hi = mid; }
    out.push(`${f.id}: ${Math.round(lo * 100) / 100}`);
    console.log(out[out.length - 1]);
  }
  const file = 'src/data/factions.ts';
  writeFileSync(file, readFileSync(file, 'utf8').replace(/export const FACTION_TUNE: [^=]+= \{[^}]*\};/, `export const FACTION_TUNE: Partial<Record<FactionId, number>> = { ${out.join(', ')} };`));
} else {
  for (const f of FACTIONS) {
    const row: string[] = [];
    for (let k = 1; k <= CONQUEST_BATTLES; k++) {
      const L = conquestLevel(f, k); const idx = Math.min(50, f.base + (k - 1) * 3);
      let w = 0; for (let i = 0; i < N; i++) if (play(idx, expectedUpgrade(idx), 1, L).win) w++;
      row.push(`${k}:${Math.round((w / N) * 100)}%`);
    }
    console.log(f.id.padEnd(8), row.join(' '));
  }
}

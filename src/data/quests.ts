// Daily and weekly quests. Five daily quests are drawn from a pool each UTC day
// (one free swap per day) and five weekly quests each ISO week; finishing every
// weekly quest also opens a bonus chest. Progress is counted by key.
export type QKey = 'wins' | 'units' | 'archers' | 'riders' | 'kills' | 'miners' | 'perfect' | 'drops' | 'well' | 'stars3' | 'ability' | 'survival' | 'war' | 'upgrade' | 'bosses' | 'trials' | 'conquest';
export interface QuestDef { id: string; key: QKey; goal: number; reward: { g?: number; gems?: number } }

export const DAILY_POOL: QuestDef[] = [
  { id: 'd_wins', key: 'wins', goal: 3, reward: { g: 200, gems: 5 } },
  { id: 'd_units', key: 'units', goal: 60, reward: { g: 250, gems: 5 } },
  { id: 'd_archers', key: 'archers', goal: 20, reward: { g: 200, gems: 5 } },
  { id: 'd_riders', key: 'riders', goal: 8, reward: { g: 220, gems: 5 } },
  { id: 'd_kills', key: 'kills', goal: 120, reward: { g: 250, gems: 8 } },
  { id: 'd_miners', key: 'miners', goal: 6, reward: { g: 220, gems: 6 } },
  { id: 'd_perfect', key: 'perfect', goal: 3, reward: { g: 180, gems: 8 } },
  { id: 'd_drops', key: 'drops', goal: 3, reward: { g: 200, gems: 6 } },
  { id: 'd_well', key: 'well', goal: 90, reward: { g: 220, gems: 6 } },
  { id: 'd_stars3', key: 'stars3', goal: 2, reward: { g: 250, gems: 8 } },
  { id: 'd_ability', key: 'ability', goal: 6, reward: { g: 180, gems: 5 } },
  { id: 'd_survival', key: 'survival', goal: 8, reward: { g: 250, gems: 8 } },
  { id: 'd_war', key: 'war', goal: 1, reward: { g: 300, gems: 10 } },
  { id: 'd_upgrade', key: 'upgrade', goal: 2, reward: { g: 150, gems: 5 } },
];
export const WEEKLY_POOL: QuestDef[] = [
  { id: 'w_wins', key: 'wins', goal: 20, reward: { g: 1500, gems: 40 } },
  { id: 'w_kills', key: 'kills', goal: 1500, reward: { g: 1500, gems: 40 } },
  { id: 'w_bosses', key: 'bosses', goal: 5, reward: { g: 1200, gems: 40 } },
  { id: 'w_war', key: 'war', goal: 6, reward: { g: 1800, gems: 50 } },
  { id: 'w_trials', key: 'trials', goal: 6, reward: { g: 1500, gems: 45 } },
  { id: 'w_perfect', key: 'perfect', goal: 25, reward: { g: 1200, gems: 40 } },
  { id: 'w_stars3', key: 'stars3', goal: 12, reward: { g: 1500, gems: 45 } },
  { id: 'w_conquest', key: 'conquest', goal: 5, reward: { g: 1500, gems: 45 } },
  { id: 'w_upgrade', key: 'upgrade', goal: 12, reward: { g: 1200, gems: 35 } },
  { id: 'w_units', key: 'units', goal: 400, reward: { g: 1500, gems: 40 } },
];
export const WEEKLY_BONUS = { g: 3000, gems: 120 };

/** Deterministic pick of n distinct entries from a pool for a seed. */
function pickN<T>(pool: T[], n: number, seed: number): T[] {
  const idx = pool.map((_, i) => i);
  let s = seed * 9301 + 49297;
  for (let i = idx.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = s % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).map((i) => pool[i]);
}
const dayNum = (date: string) => Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);

/** Today's daily quests; `swap` replaces the slot the player swapped with the next pool entry not shown. */
export function dailyQuests(date: string, swapped: string[] = []): QuestDef[] {
  const base = pickN(DAILY_POOL, 5, dayNum(date));
  const spare = DAILY_POOL.filter((q) => !base.includes(q));
  let k = 0;
  return base.map((q) => (swapped.includes(q.id) ? spare[k++ % spare.length] : q));
}
/** ISO week key, e.g. "2026-W48". */
export function weekKey(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const dow = d.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dow); // the Thursday of this ISO week decides its year
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
export function weeklyQuests(week: string): QuestDef[] {
  const n = [...week].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000;
  return pickN(WEEKLY_POOL, 5, n);
}
/** Milliseconds until the next daily (UTC midnight) and weekly (Monday 00:00 UTC) reset. */
export function msToReset(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const dow = (d.getUTCDay() + 6) % 7;
  const nextW = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - dow));
  return { day: next - now, week: nextW - now };
}

// Global leaderboard (Supabase table `leaderboard`, see supabase/migrations).
// Offline-first: every call fails soft and the UI shows an offline notice.
import { sb, save, currentUser } from './save';

export type Board = 'survival' | 'tower' | 'stars';
export const BOARDS: Board[] = ['survival', 'tower', 'stars'];
export interface Row { user_id: string; name: string; country: string | null; score: number }

/** The player's current best on each board, straight from the save. */
export function myBest(board: Board): number {
  if (board === 'survival') return save.survivalBest;
  if (board === 'tower') return save.tower;
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}

/** Display name: letters, digits, spaces and a few marks, 1–20 characters. */
export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}
export function displayName(fallback: string): string {
  return cleanName(save.profile.name) || `${fallback}-${save.profile.tag}`;
}

/** Posts the player's best scores (the server keeps the higher one). */
export async function submitAll(fallbackName: string): Promise<boolean> {
  const uid = currentUser();
  if (!sb || !uid) return false;
  const name = displayName(fallbackName);
  const rows = BOARDS.map((board) => ({ user_id: uid, board, score: myBest(board), name, country: save.profile.country })).filter((r) => r.score > 0);
  if (!rows.length) return true;
  const { error } = await sb.from('leaderboard').upsert(rows);
  if (error) { console.warn('[leaderboard] submit failed', error.message); return false; }
  return true;
}

export async function fetchTop(board: Board, limit = 50): Promise<Row[] | null> {
  if (!sb) return null;
  const { data, error } = await sb.from('leaderboard').select('user_id,name,country,score').eq('board', board).order('score', { ascending: false }).order('updated_at').limit(limit);
  if (error) { console.warn('[leaderboard] fetch failed', error.message); return null; }
  return data as Row[];
}

/** 1-based world rank for a score (ties share the better rank). */
export async function rankOf(board: Board, score: number): Promise<number | null> {
  if (!sb || score <= 0) return null;
  const { count, error } = await sb.from('leaderboard').select('user_id', { count: 'exact', head: true }).eq('board', board).gt('score', score);
  return error ? null : (count ?? 0) + 1;
}

/** 🇸🇦 from "SA". */
export const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '🏳️');

/** ISO 3166 country codes for the flag picker (names come from Intl.DisplayNames). */
export const COUNTRIES = ('AE AF AL AM AO AR AT AU AZ BA BD BE BF BG BH BI BJ BN BO BR BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CY CZ DE DJ DK DO DZ EC EE EG ER ES ET FI FJ FR GA GB GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KR KW KZ LA LB LK LR LS LT LU LV LY MA MD ME MG MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SN SO SR SS SV SY SZ TD TG TH TJ TL TM TN TR TT TW TZ UA UG US UY UZ VE VN YE ZA ZM ZW').split(' ');

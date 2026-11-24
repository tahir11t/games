import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PLAYER_UNITS, type UnitId } from './data/units';
import type { Difficulty } from './game/battle';
import type { AbilityId, PassiveId, ChallengeId } from './data/skills';
import type { Lang } from './i18n';

export interface SaveData {
  v: 1;
  lang: Lang;
  sound: boolean;
  gold: number;
  gems: number;
  stars: Record<number, number>; // level -> best stars
  unlocked: number; // highest playable level
  unitLevels: Record<UnitId, number>;
  daily: { day: number; lastClaim: string | null };
  chestAt: number; // epoch ms when free chest is ready
  chestAdsToday: number;
  adCountDate: string;
  quests: { date: string; wins: number; archers: number; units: number; claimed: string[] };
  battlesSinceInterstitial: number;
  tutorialDone: boolean;
  owned: UnitId[]; // bought shop units
  trophies: Partial<Record<ChallengeId, number>>; // challenge -> times won
  abilities: AbilityId[];
  ability: AbilityId;
  passives: Record<PassiveId, number>;
  survivalBest: number;
  difficulty: Difficulty;
  music: string; // track id or 'auto'
  musicOn: boolean;
  speed: 1 | 2;
  camMode: 'both' | 'arrows' | 'touch';
  quality: 'auto' | 'high' | 'low';
  achievements: string[];
  totals: { kills: number; bosses: number };
  conquest: Record<string, number>; // faction -> battles won
  conquestStars: Record<string, number>; // 'elves-3' -> stars
  musicRotate: number; // minutes between automatic track changes (0 = off)
  showHp: boolean;
  dailyDone: string | null;
  updatedAt: number;
}

const KEY = 'sandwars.save.v1';

/** Fill in fields added after a save was written (shallow + nested maps). */
export function migrate(raw: Partial<SaveData>): SaveData {
  const d = defaultSave();
  return { ...d, ...raw, unitLevels: { ...d.unitLevels, ...raw.unitLevels }, passives: { ...d.passives, ...raw.passives }, trophies: { ...raw.trophies }, totals: { ...d.totals, ...raw.totals }, conquest: { ...raw.conquest }, conquestStars: { ...raw.conquestStars } };
}
const today = () => new Date().toISOString().slice(0, 10);

export function defaultSave(): SaveData {
  return {
    v: 1,
    lang: navigator.language?.startsWith('ar') ? 'ar' : navigator.language?.startsWith('tr') ? 'tr' : 'en',
    sound: true,
    gold: 0,
    gems: 0,
    stars: {},
    unlocked: 1,
    unitLevels: Object.fromEntries(PLAYER_UNITS.map((id) => [id, 1])) as Record<UnitId, number>,
    daily: { day: 0, lastClaim: null },
    chestAt: Date.now(),
    chestAdsToday: 0,
    adCountDate: today(),
    quests: { date: today(), wins: 0, archers: 0, units: 0, claimed: [] },
    battlesSinceInterstitial: 0,
    tutorialDone: false,
    owned: [],
    trophies: {},
    abilities: ['volley'],
    ability: 'volley',
    passives: { mining: 0, walls: 0, treasury: 0, eagle: 0, wisdom: 0, towers: 0 },
    difficulty: 'medium',
    music: 'auto',
    musicOn: true,
    speed: 1,
    camMode: 'both',
    quality: 'auto',
    achievements: [],
    totals: { kills: 0, bosses: 0 },
    conquest: {},
    conquestStars: {},
    musicRotate: 0,
    showHp: true,
    survivalBest: 0,
    dailyDone: null,
    updatedAt: Date.now(),
  };
}

// Local save is obfuscated + checksummed (PRD: encrypted local save). A real
// build would use platform keystore encryption; this prevents casual edits.
const SALT = 'sw-27';
function checksum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function encode(d: SaveData) {
  const json = JSON.stringify(d);
  return btoa(unescape(encodeURIComponent(json))) + '.' + checksum(json + SALT);
}
function decode(raw: string): SaveData | null {
  const [b64, sum] = raw.split('.');
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    if (checksum(json + SALT) !== sum) return null;
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}

export let save: SaveData = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && decode(raw)) || defaultSave();
  } catch {
    return defaultSave();
  }
})();

export function rolloverDaily() {
  const d = today();
  if (save.quests.date !== d) save.quests = { date: d, wins: 0, archers: 0, units: 0, claimed: [] };
  if (save.adCountDate !== d) { save.adCountDate = d; save.chestAdsToday = 0; }
}

let cloudTimer: number | undefined;
export function persist() {
  save.updatedAt = Date.now();
  try { localStorage.setItem(KEY, encode(save)); } catch { /* storage unavailable */ }
  clearTimeout(cloudTimer);
  cloudTimer = window.setTimeout(pushCloud, 1500);
}

// ---------- Supabase (cloud save + analytics) ----------
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_PUB = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const sb: SupabaseClient | null = URL && KEY_PUB ? createClient(URL, KEY_PUB) : null;
export let cloudOnline = false;
let userId: string | null = null;
const sessionId = Math.random().toString(36).slice(2);

export async function initCloud(onMerged: () => void) {
  if (!sb) return;
  try {
    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const res = await sb.auth.signInAnonymously();
      if (res.error) throw res.error;
      session = res.data.session;
    }
    userId = session?.user.id ?? null;
    if (!userId) return;
    cloudOnline = true;
    const { data } = await sb.from('player_saves').select('data').eq('user_id', userId).maybeSingle();
    const remote = data?.data as SaveData | undefined;
    if (remote && remote.updatedAt > save.updatedAt) {
      save = migrate(remote);
      try { localStorage.setItem(KEY, encode(save)); } catch { /* ignore */ }
      onMerged();
    } else {
      void pushCloud();
    }
    flushEvents();
  } catch (e) {
    console.warn('[cloud] offline:', e);
    cloudOnline = false;
  }
}

async function pushCloud() {
  if (!sb || !userId) return;
  const { error } = await sb.from('player_saves').upsert({ user_id: userId, data: save, updated_at: new Date().toISOString() });
  if (error) console.warn('[cloud] save failed', error.message);
}

// Analytics — event names follow PRD section 9. Buffered, flushed in batches.
const queue: { name: string; params: Record<string, unknown> }[] = [];
const sessionStart = Date.now();
export function track(name: string, params: Record<string, unknown> = {}) {
  queue.push({ name, params });
  if (import.meta.env.DEV) console.debug('[analytics]', name, params);
  if (queue.length >= 10) flushEvents();
}
export async function flushEvents() {
  if (!sb || !userId || !queue.length) return;
  const batch = queue.splice(0, queue.length).map((e) => ({
    user_id: userId, name: e.name, params: e.params, session_id: sessionId, app_version: '0.1.0', locale: save.lang,
  }));
  const { error } = await sb.from('analytics_events').insert(batch);
  if (error) console.warn('[analytics] flush failed', error.message);
}
setInterval(flushEvents, 20000);
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    track('session_length', { seconds: Math.round((Date.now() - sessionStart) / 1000) });
    flushEvents();
  }
});

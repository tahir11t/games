// Real-money store. Purchases run in TEST mode: a mock checkout that grants the
// item. For release, replace `checkout()` with Google Play Billing (e.g. a
// Capacitor billing plugin) and verify the purchase token on a server before
// granting (PRD: "Play Integrity / server check before granting paid items").
import type { UnitId } from './data/units';

export interface Product { id: string; kind: 'hero' | 'sub' | 'gems'; price: string; usd: number; unit?: UnitId; plan?: 'weekly' | 'monthly'; gems?: number }

export const PRODUCTS: Product[] = [
  { id: 'hero_sultan', kind: 'hero', unit: 'sultan', price: '$3.99', usd: 3.99 },
  { id: 'hero_dragon', kind: 'hero', unit: 'dragon', price: '$4.99', usd: 4.99 },
  { id: 'hero_pharaoh', kind: 'hero', unit: 'pharaoh', price: '$3.99', usd: 3.99 },
  { id: 'hero_valkyrie', kind: 'hero', unit: 'valkyrie', price: '$4.99', usd: 4.99 },
  { id: 'hero_shadowqueen', kind: 'hero', unit: 'shadowqueen', price: '$3.99', usd: 3.99 },
  { id: 'hero_guardian', kind: 'hero', unit: 'guardian', price: '$4.99', usd: 4.99 },
  { id: 'hero_firebird', kind: 'hero', unit: 'firebird', price: '$5.99', usd: 5.99 },
  { id: 'sub_weekly', kind: 'sub', plan: 'weekly', price: '$1.99', usd: 1.99 },
  { id: 'sub_monthly', kind: 'sub', plan: 'monthly', price: '$5.99', usd: 5.99 },
  { id: 'gems_s', kind: 'gems', gems: 120, price: '$0.99', usd: 0.99 },
  { id: 'gems_m', kind: 'gems', gems: 700, price: '$4.99', usd: 4.99 },
  { id: 'gems_l', kind: 'gems', gems: 1600, price: '$9.99', usd: 9.99 },
];

/** Daily subscription rewards; a legend after `heroAfter` claimed days. */
export const SUB_PLANS = {
  weekly: { days: 7, gold: 200, gems: 20, heroAfter: 7 },
  monthly: { days: 30, gold: 400, gems: 40, heroAfter: 5 },
} as const;

export const TEST_MODE = true;

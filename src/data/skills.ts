import type { UnitId } from './units';

export type AbilityId = 'volley' | 'warcry' | 'oasis' | 'sandstorm' | 'meteor';
export type PassiveId = 'mining' | 'walls' | 'treasury' | 'eagle' | 'wisdom';
export type ChallengeId = 'hyenas' | 'archery' | 'scorpion' | 'roc' | 'worm' | 'titan' | 'djinn' | 'warlord';

/** What it takes to buy something: campaign progress or a challenge trophy, plus a price. */
export interface Requirement { level?: number; challenge?: ChallengeId; gold?: number; gems?: number; }

export const ABILITIES: Record<AbilityId, { icon: string; charge: number; req: Requirement }> = {
  volley:    { icon: '🏹', charge: 28, req: {} },
  warcry:    { icon: '📯', charge: 30, req: { level: 10, gold: 2500 } },
  oasis:     { icon: '💧', charge: 34, req: { level: 16, gems: 80 } },
  sandstorm: { icon: '🌪️', charge: 32, req: { challenge: 'worm', gems: 120 } },
  meteor:    { icon: '☄️', charge: 38, req: { challenge: 'djinn', gems: 200 } },
};

export const PASSIVES: Record<PassiveId, { icon: string; costs: number[]; req: Requirement }> = {
  mining:   { icon: '⛏️', costs: [800, 2000, 4500], req: { level: 4 } },
  walls:    { icon: '🏰', costs: [800, 2000, 4500], req: { level: 6 } },
  treasury: { icon: '💰', costs: [600, 1600, 3600], req: { level: 3 } },
  eagle:    { icon: '🦅', costs: [1500, 3500, 7000], req: { challenge: 'archery' } },
  wisdom:   { icon: '📜', costs: [1200, 3000, 6000], req: { level: 12 } },
};
export const PASSIVE_MAX = 3;

/** Shop requirements for the non-campaign units. */
export const UNIT_SHOP: Partial<Record<UnitId, Requirement>> = {
  healer:   { level: 8, gold: 1200 },
  fire:     { level: 18, gold: 3000 },
  falcon:   { challenge: 'roc', gold: 2000 },
  lion:     { challenge: 'hyenas', gems: 60 },
  assassin: { challenge: 'scorpion', gems: 100 },
  giant:    { challenge: 'titan', gems: 150 },
  genie:    { challenge: 'djinn', gems: 250 },
  hero:     { challenge: 'warlord', gems: 400 },
};

/** Passive effects, per level. */
export const passiveFx = {
  mining: (l: number) => 1 + 0.1 * l, // gold rate
  walls: (l: number) => 1 + 0.15 * l, // fort hp
  treasury: (l: number) => 50 * l, // starting gold
  eagle: (l: number) => 1 + 0.12 * l, // ranged dmg + range
  wisdom: (l: number) => 1 + 0.15 * l, // ability charge speed
};

export interface Perks {
  unitLevels: Record<UnitId, number>;
  ability: AbilityId;
  passives: Record<PassiveId, number>;
}

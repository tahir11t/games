// Relics (PRD §6 "gear"): equipment the player levels with shards from chests.
// Two can be equipped; each gives a small boost to the player's own army.
export type RelicId = 'horn' | 'aegis' | 'boots' | 'hourglass' | 'lamp' | 'eye' | 'scarab' | 'banner';
export type BoostKey = 'dmg' | 'hp' | 'speed' | 'charge' | 'gold' | 'range' | 'mining' | 'tower';
export interface RelicDef { id: RelicId; icon: string; boost: BoostKey; per: number; pct: boolean }
export const RELICS: RelicDef[] = [
  { id: 'horn', icon: '📯', boost: 'dmg', per: 0.025, pct: true }, // War Horn: unit damage
  { id: 'aegis', icon: '🛡️', boost: 'hp', per: 0.03, pct: true }, // Bronze Aegis: unit health
  { id: 'boots', icon: '🥾', boost: 'speed', per: 0.025, pct: true }, // Sand Boots: unit speed
  { id: 'hourglass', icon: '⏳', boost: 'charge', per: 0.05, pct: true }, // Hourglass: ability charge
  { id: 'lamp', icon: '🪔', boost: 'gold', per: 30, pct: false }, // Djinn Lamp: starting gold
  { id: 'eye', icon: '🦅', boost: 'range', per: 0.025, pct: true }, // Falcon Eye: ranged range
  { id: 'scarab', icon: '🪲', boost: 'mining', per: 0.035, pct: true }, // Golden Scarab: mining
  { id: 'banner', icon: '🚩', boost: 'tower', per: 0.08, pct: true }, // Tribal Banner: fort archers
];
export const RELIC_MAX = 5;
export const RELIC_SLOTS = 2;
/** Shards and gold to reach the next level (level 0 → 1 unlocks the relic). */
export const relicCost = (lvl: number) => ({ shards: 5 + lvl * 5, gold: lvl * 300 });
export type Boosts = Partial<Record<BoostKey, number>>;
/** Sum of the boosts of the equipped relics. */
export function relicBoosts(equip: string[], levels: Record<string, { lvl: number; shards: number }>): Boosts {
  const out: Boosts = {};
  for (const id of equip) {
    const r = RELICS.find((x) => x.id === id); const lvl = levels[id]?.lvl ?? 0;
    if (r && lvl > 0) out[r.boost] = (out[r.boost] ?? 0) + r.per * lvl;
  }
  return out;
}
/** Unit mastery: stars from lifetime kills with a unit type; each star is +2% damage and health. */
export const MASTERY_KILLS = [25, 100, 300, 800, 2000];
export const masteryStars = (kills: number) => MASTERY_KILLS.filter((k) => kills >= k).length;
export const MASTERY_PER_STAR = 0.02;
/** Army colours: cosmetic palettes for your own soldiers, unlocked by campaign stars. */
export interface Palette { id: string; cloth: string; trim: string; ring: string; stars: number }
export const PALETTES: Palette[] = [
  { id: 'gold', cloth: '#f4b942', trim: '#1f9e8f', ring: '#e0a82e', stars: 0 },
  { id: 'emerald', cloth: '#3fae5a', trim: '#f2d16b', ring: '#3fae5a', stars: 25 },
  { id: 'sapphire', cloth: '#3d7fd9', trim: '#f4e3b0', ring: '#4a8ae6', stars: 60 },
  { id: 'ivory', cloth: '#efe6d2', trim: '#b0362c', ring: '#efe6d2', stars: 100 },
  { id: 'violet', cloth: '#8a4fc9', trim: '#f2c14e', ring: '#9b5fe0', stars: 150 },
  { id: 'onyx', cloth: '#34343c', trim: '#d9a22e', ring: '#8a8a99', stars: 195 },
];
export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

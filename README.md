# حرب الرمال · Sand Wars (web prototype)

A playable HTML5 prototype of the «حرب الرمال» Stickman lane-battle game, built from the PRD of Nov 23, 2026.
It's for checking the core loop, balance and UX before committing to a Unity/Godot Android build. It can also be wrapped as an Android app (Capacitor or a TWA).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.

Desktop keys: `1–6` train units · `E` take/release control · `A`/`D` move · `Space` attack · `Q` commander ability.

## What's implemented (PRD mapping)

| PRD | Status |
|---|---|
| §4 Battle: single lane, forts + mines, 2 miners + 150 gold start, 5 gold / 3 s per miner, max 8 miners | ✅ |
| §4 Train queue with cost + time, Defend / Hold / Attack modes | ✅ |
| §4 Direct control of one unit (+30% damage), on-screen ◀ ▶ ⚔ pad | ✅ |
| §4 Commander ability (Arrow Volley) on a charge meter | ✅ (one ability; more come with the skill tree) |
| §4 Stars: win · fort > 50% · under 3 min; double loot via rewarded ad | ✅ |
| §4 Enemy AI: pre-built wave scripts + defend when you push + counters your most-built unit | ✅ |
| §5 Six player units with the counter triangle (spear > camel > archer > spear) | ✅ |
| §5 40 levels, 4 regions (oasis, red dunes with sandstorm, mountains, night city), 4 bosses | ✅ |
| §6 Unit upgrades 1–20 (+8% / level, cost doubles every 4 levels) | ✅ |
| §6 7-day reward calendar, 3 daily quests, free chest every 4 h (+ ad to open now, 5/day) | ✅ |
| §6 Gear, skill tree, cosmetics | ⏳ not yet |
| §7 Rewarded placements: double loot, revive at 50%, chest, +150 starting gold (3/day) | ✅ mock ads |
| §7 Interstitial rules: after result only, level ≥ 6, ≤ 1 per 3 battles, none within 3 min of a rewarded ad | ✅ mock ads |
| §7 IAP (remove ads, starter pack, gems) | ⏳ needs Play Billing |
| §8 Stickman art, gold vs. dark-red armies, no blood (dust/sparks), parallax backgrounds | ✅ procedural canvas art |
| §8 Oriental music (Hijaz-scale melody + doumbek) and SFX | ✅ synthesized with WebAudio, so no licensing needed |
| §8 Arabic + English, full RTL | ✅ |
| §9 Offline-first, encrypted local save + cloud backup | ✅ checksummed local save + Supabase |
| §9 Analytics events (`tutorial_step`, `level_start/complete/fail`, `unit_spawned`, `upgrade_purchased`, `ad_offer_shown/ad_watched`, `session_length`) | ✅ sent to Supabase |
| §9 Max 40 units per army, landscape, thumb-reachable controls | ✅ |

## v0.2: more units, monster challenges, modes and a shop

- **14 player units** in a scrolling unit bar. The 6 PRD units come from the campaign; 8 new ones come from the shop:
  - Healer: heals the most wounded ally.
  - Falcon: flying.
  - Fire Breather: area flames.
  - Lion: fast, double-damage first pounce.
  - Shadow Blade: crits and dodges.
  - Giant: tank with area smash.
  - Emerald Genie: flying, exploding magic.
  - Legendary Hero: limit 1, +15% damage aura.
- **Flying units:** only ranged and flying units can hit them, so unit choice matters.
- **8 monster challenges**, each a boss fight with its own rules: Hyena Pack, Archers' Trial (ranged only), Scorpion King, the Roc (flying), Sand Worm, Stone Titan, Shadow Djinn, the Warlord. The first win gives a 🏆 trophy, gems, and unlocks the right to buy that challenge's unit or skill.
- **Shop:** buy units, 5 commander skills (Arrow Volley, War Cry, Oasis Water, Sandstorm, Meteor; choose one to equip) and 5 passive boosts (3 levels each: mining, fort walls, starting gold, Eagle Eye, ability charge).
  - The strong items need **a challenge trophy plus gems**, so every one of them can be earned through play.
- **Modes:** Campaign · Monster Challenges · Survival (endless waves, a boss every 5th wave, best score saved) · Daily Challenge (a rotating rule, e.g. ranged only, fast enemies, no miners; 💎25 + 🪙300 once a day).
- **Art:** an original colourful cartoon style (big-headed characters with faces, coloured outfits, beasts and monsters), drawn procedurally in `src/game/art.ts`.

`npx tsx scripts/challenges.ts --tune` tunes each challenge so the bot wins about 50% at 2 upgrade levels above expected.

## v0.3: smarter enemy, difficulty modes, more content, Turkish, music

- **The enemy has an economy:** it mines gold with its own miners and buys units like you do. Killing its miners starves it.
- **Difficulty (easy / medium / hard)** sets the enemy commander's intelligence as well as its stats:
  - Easy: picks units at random.
  - Medium: counters your most common unit.
  - Hard: saves up for counters, keeps a ranged backline, retreats when losing, raids your miners with fast units, and fires arrow volleys.
  - Rewards scale ×0.8 / ×1 / ×1.5.
- **Tower archers** on both forts; yours can be upgraded in the shop.
- **Guided arrows:** shots track their target, so archers hit units that are moving.
- **Units queue and sidestep** into free lanes instead of stacking; knockback on heavy hits; charges re-arm.
- **Veteran ranks** ★/★★ after 3 and 7 kills (+15% HP and damage each).
- **18 player units:** Horse Knight and Crossbowman from the campaign; War Drummer and War Elephant from new challenges.
- **New monsters:** mummy, skeleton, cobra, plus bosses Mummy King, Cobra Queen and Phoenix.
- **Fifth region, Forgotten Tombs:** 50 levels in total.
- **12 challenges.** New ones:
  - The Siege: survive 150 s.
  - The Stampede.
  - Cobra Queen.
  - The Phoenix.
- **New skills:** Reinforcements and Phoenix Inferno; Tower Archers boost.
- **Turkish** (full translation in `src/i18n-tr.ts`), alongside Arabic and English.
- **5 original music tracks** in Arabic maqams (Hijaz, Bayati, Kurd, Nahawand, Rast). Pick one in Settings or leave it on Auto (the music follows the screen and region). Separate music and effects switches.
- **×2 game speed**, a battle stats panel with the MVP unit, and upgraded graphics (shading, idle breathing, clouds, sun glow, snow caps, mud-brick forts with wooden gates, mine with cart, vignette).

Balance: `scripts/tune.ts` (now with `FROM`/`TO`/`CAP`) tunes the campaign on medium. Run `DIFF=hard UPG_BONUS=3 npx tsx scripts/balance.ts` to check hard.

## Backend (Supabase project `game`)

- `player_saves`: one JSON save per user. RLS lets users read and write only their own row.
- `analytics_events`: insert-only event log. RLS lets users insert only their own events.
- Players sign in with **anonymous sign-in** (`signInAnonymously`). **Turn it on in the Supabase dashboard → Authentication → Sign In / Providers → Anonymous sign-ins.** While it's off, the game stays fully playable on the local save.
- Schema: `supabase/migrations/`.

Example analytics query (per-level difficulty):

```sql
select (params->>'level')::int as level,
       count(*) filter (where name = 'level_complete') as wins,
       count(*) filter (where name = 'level_fail') as fails
from analytics_events
where name in ('level_complete', 'level_fail')
group by 1 order by 1;
```

## Balance tooling

- `npx tsx scripts/balance.ts`: a bot playing as an "average player" (random unit mix, no direct control, upgrades at the expected pace) plays every level 8 times and reports win rate, time and stars.
- `npx tsx scripts/tune.ts`: searches a per-level difficulty factor (`TUNE` in `src/data/levels.ts`) so the bot wins about 95% on levels 1–5, about 75% on normal levels and about 65% on bosses. Re-run it after changing unit stats.

Enemy waves are generated from a gold **budget** that grows each level, so wave size always tracks what the player's economy can answer. No expensive enemies appear in the first 35 seconds.

## Project layout

```
src/
  main.ts          screens, HUD, tutorial, ads/rewards flow
  i18n.ts          Arabic/English strings, RTL switching
  save.ts          local save, Supabase cloud save + analytics
  data/units.ts    unit stats (PRD §5) and upgrade formulas
  data/levels.ts   40 levels: regions, wave budgets, tuning
  game/battle.ts   simulation (economy, AI, combat, projectiles)
  data/skills.ts   commander skills, passives, shop requirements
  data/challenges.ts monster challenges, daily rules, survival waves
  game/render.ts   canvas renderer (world, forts, effects)
  game/art.ts      character art for all units and monsters
  game/audio.ts    synthesized music + SFX
scripts/           headless balance + tuning
supabase/          SQL migrations
```

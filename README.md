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
  game/render.ts   procedural Stickman/canvas renderer
  game/audio.ts    synthesized music + SFX
scripts/           headless balance + tuning
supabase/          SQL migrations
```

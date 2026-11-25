import './style.css';
import { t, tk, tn, setLang, num, price, isRtl, LANGS, getLang, type Key, type Lang } from './i18n';
import { BOARDS, submitAll, fetchTop, rankOf, myBest, flag, displayName, cleanName, COUNTRIES, type Board } from './leaderboard';
import { a11y } from './game/render';
import { save, persist, initCloud, track, rolloverDaily, cloudOnline, flushEvents, currentUser, progress } from './save';
import { dailyQuests, weeklyQuests, msToReset, WEEKLY_BONUS, type QuestDef } from './data/quests';
import { WAR_MODES, WAR_TIERS, WAR_ICON, warLevel, warLineup, blitzLevel, BLITZ_BOSSES, BLITZ_TIME, type WarMode } from './data/war';
import { ROLES } from './game/battle';
import { UNITS, PLAYER_UNITS, BASE_UNITS, MAX_UNIT_LEVEL, upgradeCost, upgradeMult, type UnitId } from './data/units';
import { LEVELS, REGIONS, type RegionId, type LevelDef } from './data/levels';
import { ABILITIES, PASSIVES, PASSIVE_MAX, UNIT_SHOP, type AbilityId, type PassiveId, type Requirement, type Perks } from './data/skills';
import { CHALLENGES, challengeById, challengeLevel, dailyFor, survivalLevel, type ChallengeDef } from './data/challenges';
import { Battle, W } from './game/battle';
import { Renderer } from './game/render';
import { sfx, setSound, setMusicOn, startMusic, stopMusic, unlockAudio, playTrack, setRotation, TRACKS } from './game/audio';
import { FACTIONS, CONQUEST_BATTLES, HERO_BATTLE, SIEGE_BATTLE, ELITE_BATTLE, conquestLevel, factionById, conquered, rosterOf, type FactionDef, type ArmyId } from './data/factions';
import { PREMIUM_UNITS, type EnemyId } from './data/units';
import { PRODUCTS, SUB_PLANS, TEST_MODE, type Product } from './store';
import { TOWER_FLOORS, towerLevel, towerRule } from './data/challenges';
import { DIFFICULTY, tierOf, MAX_TOWER_ARCHERS, FORMATIONS, BONDS, type Difficulty, type BondId } from './game/battle';
import { setLowQuality, drawArt, setColorblind } from './game/art';
import { LEVEL_COUNT } from './data/levels';

const ui = document.getElementById('ui')!;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const iconCache = new Map<string, string>();
/** Unit portrait in its current look (tier changes every 5 upgrade levels). */
function iconFor(id: UnitId, lvl = save.unitLevels[id] ?? 1) {
  const tier = tierOf(lvl);
  const key = id + ':' + tier;
  let v = iconCache.get(key);
  if (!v) { v = Renderer.icon(UNITS[id], 96, 0, tier); iconCache.set(key, v); }
  return v;
}
const bossIcons: Record<string, string> = {};
for (const c of CHALLENGES) bossIcons[c.id] = Renderer.icon(UNITS[c.boss], 96, 1);

const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const starsHtml = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
let lastRewardedAd = 0;

// ---------------- Ownership / requirements ----------------
const isBase = (id: UnitId) => BASE_UNITS.includes(id);
function unitAvailable(id: UnitId) { return isBase(id) ? save.unlocked >= UNITS[id].unlock || !!save.stars[UNITS[id].unlock] : save.owned.includes(id); }
function reqMet(r: Requirement) { return (!r.level || save.unlocked > r.level || !!save.stars[r.level]) && (!r.challenge || (save.trophies[r.challenge] ?? 0) > 0); }
function canAfford(r: Requirement) { return save.gold >= (r.gold ?? 0) && save.gems >= (r.gems ?? 0); }
function pay(r: Requirement) { save.gold -= r.gold ?? 0; save.gems -= r.gems ?? 0; }
const priceHtml = (r: Requirement) => [r.gold ? `🪙 ${num(r.gold)}` : '', r.gems ? `💎 ${num(r.gems)}` : ''].filter(Boolean).join(' ') || '✓';
function reqHtml(r: Requirement) {
  if (r.level && !(save.unlocked > r.level || save.stars[r.level])) return `🔒 ${t('needLevel')} ${num(r.level)}`;
  if (r.challenge && !(save.trophies[r.challenge] ?? 0)) return `🔒 ${t('needChallenge')} «${tk('ch_' + r.challenge)}»`;
  return '';
}
function armyFor(L?: LevelDef): ArmyId {
  // Challenges are built around the desert army; everywhere else you field your chosen civilization.
  const a = (save.army ?? 'desert') as ArmyId;
  if (L?.kind === 'challenge' || a === 'desert') return 'desert';
  return conquered(save.conquest[a] ?? 0) ? a : 'desert';
}
function perks(L?: LevelDef): Perks & { difficulty: Difficulty; army: ArmyId; extra: EnemyId[] } { return { unitLevels: save.unitLevels, ability: save.ability, passives: save.passives, difficulty: save.difficulty, army: armyFor(L), extra: PREMIUM_UNITS.filter((u) => save.owned.includes(u)) }; }
/** Portrait of any unit in the current look (civilization units borrow their role's upgrade tier). */
function unitIcon(id: EnemyId) {
  if (id in save.unitLevels && !FACTIONS.some((f) => f.roles[id])) return iconFor(id as UnitId);
  const role = FACTIONS.find((f) => f.roles[id])?.roles[id];
  const tier = tierOf(role ? save.unitLevels[role] ?? 1 : 1);
  const key = id + ':p' + tier;
  let v = iconCache.get(key);
  if (!v) { v = Renderer.icon(UNITS[id], 96, 0, tier); iconCache.set(key, v); }
  return v;
}
const diffIcon: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' };
function diffPicker() {
  return `<div class="diff-row">${(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => `<button class="diff ${save.difficulty === d ? 'on' : ''}" data-diff="${d}">${diffIcon[d]} ${t(('d_' + d) as Key)}</button>`).join('')}</div><div class="diff-desc">🧠 ${t(('dd_' + save.difficulty) as Key)}</div>`;
}
function bindDiff(el: HTMLElement, redraw: () => void) {
  el.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) => b.addEventListener('click', () => { save.difficulty = b.dataset.diff as Difficulty; sfx('click'); persist(); redraw(); }));
}
const unlockName = (k: string) => (k in UNITS ? tk('u_' + k) : k in ABILITIES ? tk('a_' + k) : tk('p_' + k));
const unlockIcon = (k: string) => (k in UNITS ? `<img src="${iconFor(k as UnitId)}" style="width:40px;height:40px;vertical-align:middle">` : k in ABILITIES ? ABILITIES[k as AbilityId].icon : PASSIVES[k as PassiveId].icon);

function applySettings() {
  setLang(save.lang);
  setSound(save.sound);
  setMusicOn(save.musicOn);
  setLowQuality(save.quality === 'low');
  setRotation(save.musicRotate);
  renderer.showHp = save.showHp;
  if (a11y.colorblind !== save.a11y.colorblind) { enemyIcons.clear(); for (const k in facIcons) delete facIcons[k]; for (const k in bossIcons) delete bossIcons[k]; }
  a11y.colorblind = save.a11y.colorblind; a11y.calm = save.a11y.calm;
  setColorblind(save.a11y.colorblind);
  document.documentElement.classList.toggle('calm', save.a11y.calm);
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
}

function topbar(back = true) {
  return `<div class="topbar">
    ${back ? `<button class="btn secondary small" data-act="back">${isRtl() ? '→' : '←'} ${t('back')}</button>` : ''}
    <div class="grow"></div>
    <span class="chip"><span class="ico">⭐</span>${num(totalStars())}</span>
    <span class="chip gold-chip"><span class="ico">🪙</span>${num(save.gold)}</span>
    <span class="chip"><span class="ico">💎</span>${num(save.gems)}</span>
  </div>`;
}

function mount(el: HTMLElement) {
  ui.innerHTML = '';
  ui.appendChild(el);
  el.querySelectorAll<HTMLElement>('[data-act="back"]').forEach((b) => b.addEventListener('click', () => { sfx('click'); showMenu(); }));
}

// ---------------- Mock ads (AdMob placeholder) ----------------
function showAd(kind: 'rewarded' | 'interstitial', placement: string): Promise<boolean> {
  if (kind === 'rewarded') track('ad_offer_shown', { placement });
  return new Promise((resolve) => {
    const secs = kind === 'rewarded' ? 3 : 2;
    const el = h(`<div class="ad-overlay"><div>${kind === 'rewarded' ? t('adPlaying') : 'Ad'}</div><div class="count">${secs}</div><div style="opacity:.6;font-size:13px">TEST AD · ${placement}</div></div>`);
    document.getElementById('app')!.appendChild(el);
    let n = secs;
    const iv = setInterval(() => {
      n--;
      $(el, '.count').textContent = String(Math.max(0, n));
      if (n <= 0) {
        clearInterval(iv);
        if (kind === 'interstitial') {
          const close = h(`<button class="close">✕</button>`);
          close.onclick = () => { el.remove(); resolve(true); };
          el.appendChild(close);
        } else {
          el.remove();
          lastRewardedAd = Date.now();
          track('ad_watched', { placement });
          resolve(true);
        }
      }
    }, 1000);
  });
}

// ---------------- Achievements ----------------
const ACH: { id: string; icon: string; gems: number }[] = [
  { id: 'first_win', icon: '🏁', gems: 10 }, { id: 'kills_100', icon: '⚔️', gems: 15 }, { id: 'kills_1000', icon: '🗡️', gems: 40 },
  { id: 'boss', icon: '👑', gems: 20 }, { id: 'stars_30', icon: '⭐', gems: 20 }, { id: 'stars_100', icon: '🌟', gems: 50 },
  { id: 'veteran', icon: '🎖️', gems: 15 }, { id: 'towers', icon: '🏰', gems: 10 }, { id: 'hard', icon: '🔥', gems: 25 },
  { id: 'survivor', icon: '♾️', gems: 25 }, { id: 'hunter', icon: '🐲', gems: 40 }, { id: 'raider', icon: '⛏️', gems: 20 },
  { id: 'legend', icon: '💠', gems: 30 }, { id: 'campaign', icon: '🏆', gems: 100 }, { id: 'conqueror', icon: '🌍', gems: 150 },
];
/** Short vibration on supported phones (Settings → Vibration). */
function buzz(pattern: number | number[]) { try { if (save.vibrate && 'vibrate' in navigator) navigator.vibrate(pattern); } catch { /* not supported */ } }
/** Compact battle feed (nation powers): a short line that slides in at the side and fades. */
function feed(html: string, cls = '') {
  let box = ui.querySelector<HTMLElement>('.battle-feed');
  if (!box) { box = h('<div class="battle-feed"></div>'); ui.appendChild(box); }
  const line = h(`<div class="feed-line ${cls}">${html}</div>`);
  box.appendChild(line);
  while (box.children.length > 4) box.firstElementChild!.remove();
  setTimeout(() => line.remove(), 4200);
}
/** A brief banner across the battlefield. */
function bannerMsg(html: string, cls = '') {
  // banners that fire together stack downward instead of overlapping
  const live = ui.querySelectorAll('.boss-banner').length;
  const el = h(`<div class="boss-banner ${cls}" style="top:${22 + Math.min(3, live) * 12}%">${html}</div>`);
  ui.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

function toast(html: string) {
  const el = h(`<div class="toast">${html}</div>`);
  document.getElementById('app')!.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}
function unlockAch(id: string) {
  if (save.achievements.includes(id)) return;
  const a = ACH.find((x) => x.id === id);
  if (!a) return;
  save.achievements.push(id);
  save.gems += a.gems;
  persist();
  sfx('rank');
  track('achievement', { id });
  toast(`<span class="toast-ico">${a.icon}</span><div><b>${t('achUnlocked')}</b><div>${tk('ach_' + id)} · 💎 ${num(a.gems)}</div></div>`);
}
function checkAchievements(b?: Battle, win?: boolean) {
  if (b) {
    save.totals.kills += b.stats.kills;
    save.totals.bosses += b.stats.bossKills;
    if (win) unlockAch('first_win');
    if (win && save.difficulty === 'hard' && b.level.kind !== 'survival') unlockAch('hard');
    if (b.stats.enemyMinersKilled >= 10) unlockAch('raider');
  }
  if (save.totals.kills >= 100) unlockAch('kills_100');
  if (save.totals.kills >= 1000) unlockAch('kills_1000');
  if (save.totals.bosses > 0) unlockAch('boss');
  if (totalStars() >= 30) unlockAch('stars_30');
  if (totalStars() >= 100) unlockAch('stars_100');
  if (save.survivalBest >= 10) unlockAch('survivor');
  if (CHALLENGES.filter((c) => save.trophies[c.id]).length >= 5) unlockAch('hunter');
  if (Object.values(save.unitLevels).some((l) => l >= 20)) unlockAch('legend');
  if (save.stars[50]) unlockAch('campaign');
  if (FACTIONS.every((f) => (save.conquest[f.id] ?? 0) >= CONQUEST_BATTLES)) unlockAch('conqueror');
  persist();
}
function showAchievements() {
  const el = h(`<div class="screen">${topbar()}
    <div class="ach-grid">${ACH.map((a) => { const got = save.achievements.includes(a.id); return `<div class="ach ${got ? 'got' : ''}"><div class="ach-ico">${got ? a.icon : '🔒'}</div><div class="meta"><b>${tk('ach_' + a.id)}</b><small>${tk('achd_' + a.id)}</small></div><span class="chip">💎 ${num(a.gems)}</span></div>`; }).join('')}</div>
  </div>`);
  mount(el);
}

// ---------------- Codex: every unit with live art, stats and counters ----------------
const ALL_ENEMIES = (Object.keys(UNITS) as EnemyId[]).filter((id) => !(PLAYER_UNITS as EnemyId[]).includes(id));
const enemyIcons = new Map<string, string>();
const enemyIcon = (id: EnemyId) => { let s2 = enemyIcons.get(id); if (!s2) { s2 = Renderer.icon(UNITS[id], 96, 1); enemyIcons.set(id, s2); } return s2; };
/** Display names for monsters that are named after their challenge or region. */
const NAME_ALIAS: Partial<Record<EnemyId, string>> = { boss: 'b_oasis', scorpking: 'ch_scorpion', roc: 'ch_roc', worm: 'ch_worm', titan: 'ch_titan', djinn: 'ch_djinn', warlord: 'ch_warlord', mummyking: 'b_tombs', cobraqueen: 'ch_cobra', phoenix: 'ch_phoenix' };
const unitName = (id: EnemyId) => (tk('u_' + id) !== 'u_' + id ? tk('u_' + id) : NAME_ALIAS[id] ? tk(NAME_ALIAS[id]!) : id);
/** Player units that deal bonus damage to `id` (the counter triangle). */
function countersOf(id: EnemyId): UnitId[] {
  const d = UNITS[id];
  const out = PLAYER_UNITS.filter((p) => UNITS[p].bonusVs?.includes(id));
  if (d.flying) for (const p of ['archer', 'crossbow', 'falcon'] as UnitId[]) if (!out.includes(p)) out.push(p);
  if (!out.length && (d.ranged || d.id === 'sandmage')) out.push('camel', 'assassin');
  if (!out.length && d.hp >= 1000) out.push('catapult', 'spear');
  return out.slice(0, 3);
}
let codexTab: 'mine' | 'enemies' | 'help' = 'mine';
function showCodex() {
  const mine = PLAYER_UNITS;
  const seen = new Set(save.seen);
  const tags = (id: EnemyId) => { const d = UNITS[id]; return [d.flying && `🪽 ${t('tagFlying')}`, d.ranged && `🏹 ${t('tagRanged')}`, d.splash && `💥 ${t('tagSplash')}`, d.heal && '✚'].filter(Boolean).join(' · '); };
  const card = (id: EnemyId, side: 0 | 1) => {
    const known = side === 0 || seen.has(id);
    return `<button class="codex-card ${known ? '' : 'unknown'}" data-cx="${id}" data-side="${side}" ${known ? '' : 'disabled'}>
      <img src="${side === 0 ? iconFor(id as UnitId) : enemyIcon(id)}" alt="">
      <b>${known ? unitName(id) : '???'}</b>
    </button>`;
  };
  const found = ALL_ENEMIES.filter((id) => seen.has(id)).length;
  const help = (['well', 'drops', 'last', 'perfect', 'bonds', 'formation'] as const).map((k, i) => `<div class="help-row"><span>${['🌴', '📦', '🏰', '✦', '🤝', '🔺'][i]}</span><p>${t(('help_' + k) as Key)}</p></div>`).join('')
    + `<div class="help-row"><span>🤝</span><p>${(Object.keys(BONDS) as BondId[]).map((b) => `${BONDS[b].icon} <b>${t(('bond_' + b) as Key)}</b>: ${t(('bondd_' + b) as Key)}`).join('<br>')}</p></div>`;
  const el = h(`<div class="screen">${topbar()}
    <div class="tabs" style="margin-top:8px">
      <button class="tab ${codexTab === 'mine' ? 'on' : ''}" data-tab="mine">🛡️ ${t('myUnits')}</button>
      <button class="tab ${codexTab === 'enemies' ? 'on' : ''}" data-tab="enemies">💀 ${t('enemies')} <small>${num(found)}/${num(ALL_ENEMIES.length)}</small></button>
      <button class="tab ${codexTab === 'help' ? 'on' : ''}" data-tab="help">📜 ${t('mechanics')}</button>
    </div>
    ${codexTab === 'help' ? `<div class="panel help-box">${help}</div>` : `<div class="codex-grid">${(codexTab === 'mine' ? mine.map((id) => card(id, 0)) : ALL_ENEMIES.map((id) => card(id, 1))).join('')}</div>`}
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { sfx('click'); codexTab = b.dataset.tab as typeof codexTab; showCodex(); }));
  el.querySelectorAll<HTMLElement>('[data-cx]').forEach((b) => b.addEventListener('click', () => { sfx('click'); codexDetail(b.dataset.cx as EnemyId, Number(b.dataset.side) as 0 | 1, tags); }));
  mount(el);
}
/** Detail card with the unit animating through its walk and attack cycle. */
function codexDetail(id: EnemyId, side: 0 | 1, tags: (id: EnemyId) => string) {
  const d = UNITS[id];
  const lvl = side === 0 ? save.unitLevels[id as UnitId] ?? 1 : 1;
  const m = side === 0 ? upgradeMult(lvl) : 1;
  const counters = side === 1 ? countersOf(id) : [];
  const strong = (d.bonusVs ?? []).filter((x) => x in UNITS);
  const ov = h(`<div class="screen dim codex-ov" style="z-index:30"><div class="panel codex-detail">
    <canvas class="codex-stage" width="360" height="300"></canvas>
    <div class="col" style="gap:6px;min-width:0">
      <h2 style="color:var(--gold2);margin:0">${unitName(id)}</h2>
      ${side === 0 ? `<div class="chip" style="align-self:flex-start">${t('lvShort')} ${num(lvl)}</div>` : ''}
      <div class="stat-line">❤️ ${num(Math.round(d.hp * m))} · ${d.heal ? '✚ ' + num(Math.round(d.heal * m)) : '⚔️ ' + num(Math.round(d.dmg * m))} · 🎯 ${t('range')} ${num(d.range)} · 👟 ${t('speedStat')} ${num(d.speed)}</div>
      ${tags(id) ? `<div class="stat-line">${tags(id)}</div>` : ''}
      ${tk('ud_' + id) !== 'ud_' + id ? `<div style="color:var(--sand2)">${tk('ud_' + id)}</div>` : ''}
      ${strong.length ? `<div class="stat-line">💪 ${t('strongVs')}: ${strong.map((x) => unitName(x as EnemyId)).join(isRtl() ? '، ' : ', ')}</div>` : ''}
      ${counters.length ? `<div class="stat-line counters">🗡️ ${t('counterWith')}: ${counters.map((c2) => `<img src="${iconFor(c2)}" alt="" title="${unitName(c2)}">`).join('')}</div>` : ''}
      <button class="btn secondary small" data-a="close" style="align-self:flex-start">${t('back')}</button>
    </div>
  </div></div>`);
  document.getElementById('ui')!.appendChild(ov);
  const cv = $<HTMLCanvasElement>(ov, '.codex-stage');
  const ctx = cv.getContext('2d')!;
  const u = { uid: 7, def: d, side, x: 180, lane: 0, hp: 1, maxHp: 1, dmg: 0, cd: 0, anim: 0, moving: true, attacking: 0, chargeReady: false, calm: 0, mineTimer: 0, dead: 0, hitFlash: 0, healFx: 0, kills: 0, rank: 0, raid: false, lastDx: 0, summonCd: 0, stun: 0, stompCd: 0, auraCd: 0, carry: 0, tripT: 0, hidden: false, tier: side === 0 ? tierOf(lvl) : 0 };
  let anim = 0, t0 = performance.now(), live = true;
  const frame = (now: number) => {
    if (!live) return;
    const tt = (now - t0) / 1000;
    const phase = tt % 4; // 2.4 s walking, then two attacks
    u.moving = phase < 2.4;
    if (u.moving) u.anim += 0.016 * (d.speed / 9);
    else if (d.flying) u.anim += 0.016 * 6;
    const atkT = phase < 2.4 ? 0 : (phase - 2.4) % 0.8;
    u.attacking = atkT > 0 && atkT < 0.3 ? 0.3 - atkT : 0;
    const k = Math.min(1, 210 / (d.height * 1.4 + 40));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const g = ctx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#f6dfae'); g.addColorStop(1, '#c99a5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(80,50,20,.25)'; ctx.fillRect(0, 250, cv.width, 50);
    ctx.setTransform(k, 0, 0, k, 180 * (1 - k), 250 * (1 - k));
    ctx.fillStyle = 'rgba(40,20,5,.25)'; ctx.beginPath(); ctx.ellipse(180, 252, Math.min(70, d.height * 0.5), 9, 0, 0, 7); ctx.fill();
    const swing = u.moving ? Math.sin(u.anim) * 0.55 : 0;
    const atk = u.attacking > 0 ? Math.sin((1 - u.attacking / 0.3) * Math.PI) : 0;
    drawArt({ c: ctx, u: u as never, x: 180, gy: d.flying ? 200 : 250, f: side === 0 ? 1 : -1, t: tt, swing, atk, side, region: 'oasis', flash: false, tier: u.tier });
    anim = requestAnimationFrame(frame);
  };
  anim = requestAnimationFrame(frame);
  const close = () => { live = false; cancelAnimationFrame(anim); ov.remove(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  $(ov, '[data-a="close"]').addEventListener('click', () => { sfx('click'); close(); });
}

// ---------------- Global leaderboard ----------------
let lbBoard: Board = 'survival';
const BOARD_ICON: Record<Board, string> = { survival: '♾️', tower: '🗼', stars: '⭐' };
/** Localised country name ("Saudi Arabia" / "السعودية" / "サウジアラビア"). */
function countryName(cc: string) { try { return new Intl.DisplayNames([getLang()], { type: 'region' }).of(cc) ?? cc; } catch { return cc; } }
/** Posts best scores when online; quiet when offline. */
function syncScores() { if (cloudOnline) void submitAll(t('defaultName')); }
function showLeaderboard() {
  const countries = [...COUNTRIES].sort((a, b) => countryName(a).localeCompare(countryName(b), getLang()));
  const el = h(`<div class="screen">${topbar()}
    <div class="lb-wrap">
      <div class="panel lb-profile">
        <div class="lb-me">${flag(save.profile.country)} <b data-r="myname"></b></div>
        <label>${t('playerName')}<input data-r="name" maxlength="20" value="${cleanName(save.profile.name).replace(/"/g, '')}" placeholder="${displayName(t('defaultName'))}" dir="auto"></label>
        <label>${t('country')}<select data-r="cc"><option value="">🏳️ ${t('noCountry')}</option>${countries.map((cc) => `<option value="${cc}" ${save.profile.country === cc ? 'selected' : ''}>${flag(cc)} ${countryName(cc)}</option>`).join('')}</select></label>
        <button class="btn small" data-a="savep">✓ ${t('saveBtn')}</button>
      </div>
      <div class="col lb-main">
        <div class="tabs">${BOARDS.map((bd) => `<button class="tab ${bd === lbBoard ? 'on' : ''}" data-b="${bd}">${BOARD_ICON[bd]} ${t(('lb_' + bd) as Key)}</button>`).join('')}</div>
        <div class="lb-mine chip">${t('yourRank')}: <b data-r="rank">…</b> · ${BOARD_ICON[lbBoard]} ${num(myBest(lbBoard))}</div>
        <div class="lb-list" data-r="list"><div class="lb-note">…</div></div>
      </div>
    </div>
  </div>`);
  $(el, '[data-r="myname"]').textContent = displayName(t('defaultName'));
  el.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => b.addEventListener('click', () => { sfx('click'); lbBoard = b.dataset.b as Board; showLeaderboard(); }));
  $(el, '[data-a="savep"]').addEventListener('click', () => {
    save.profile.name = cleanName($<HTMLInputElement>(el, '[data-r="name"]').value);
    save.profile.country = $<HTMLSelectElement>(el, '[data-r="cc"]').value || null;
    persist(); sfx('coin'); syncScores(); setTimeout(showLeaderboard, 600);
  });
  mount(el);
  const list = $(el, '[data-r="list"]');
  if (!cloudOnline) { list.innerHTML = `<div class="lb-note">📡 ${t('lbOffline')}</div>`; $(el, '[data-r="rank"]').textContent = '—'; return; }
  void (async () => {
    await submitAll(t('defaultName'));
    const [rows, rank] = await Promise.all([fetchTop(lbBoard), rankOf(lbBoard, myBest(lbBoard))]);
    if (!el.isConnected) return;
    $(el, '[data-r="rank"]').textContent = rank ? '#' + num(rank) : '—';
    if (!rows) { list.innerHTML = `<div class="lb-note">📡 ${t('lbOffline')}</div>`; return; }
    if (!rows.length) { list.innerHTML = `<div class="lb-note">🏁 ${t('lbEmpty')}</div>`; return; }
    const me = currentUser();
    list.innerHTML = rows.map((r, i) => `<div class="lb-row ${r.user_id === me ? 'me' : ''}"><span class="lb-pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : num(i + 1)}</span><span class="lb-flag" title="${r.country ? countryName(r.country) : ''}">${flag(r.country)}</span><bdi class="lb-name"></bdi>${r.user_id === me ? `<small>${t('you')}</small>` : ''}<b class="lb-score">${num(r.score)}</b></div>`).join('');
    list.querySelectorAll('.lb-name').forEach((n, i) => (n.textContent = rows[i].name)); // names via textContent: never parsed as HTML
  })();
}

// ---------------- Menu ----------------
function showMenu() {
  stopBattleLoop();
  startMusic('menu', save.music);
  const el = h(`<div class="screen">
    ${topbar(false)}
    <div class="menu-main">
      <img class="menu-art" src="icon.svg" alt="">
      <div class="col" style="align-items:center">
        <div class="title">${t('title')}</div>
        <div style="margin:-6px 0 14px;color:var(--sand2);font-weight:700">${t('tagline')}</div>
        ${festival() ? `<div class="festival">🎉 ${t('festival')}</div>` : ''}
        <div class="menu-buttons">
          <button class="btn play" data-go="play">${t('play')} · ${t('level')} ${num(save.unlocked)}</button>
          <button class="btn secondary" data-go="modes">🏟️ ${t('modes')}</button>
          <button class="btn secondary" data-go="shop">🛒 ${t('shop')}</button>
          <button class="btn secondary" data-go="upgrades">⚔️ ${t('upgrades')}</button>
          <button class="btn secondary" data-go="rewards">🎁 ${t('daily')}${rewardsBadge() ? ' •' : ''}</button>
          <button class="btn secondary" data-go="army">🛡️ ${t('myArmy')}</button>
          <button class="btn secondary" data-go="ach">🏅 ${t('achievements')} <small>${num(save.achievements.length)}/${num(ACH.length)}</small></button>
          <button class="btn secondary" data-go="codex">📖 ${t('codex')}</button>
          <button class="btn secondary" data-go="world">🌍 ${t('leaderboard')}</button>
          <button class="btn secondary" data-go="settings">⚙️ ${t('settings')}</button>
        </div>
      </div>
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
    unlockAudio(); sfx('click');
    const go = b.dataset.go;
    if (go === 'play') preBattle(save.unlocked);
    if (go === 'modes') showModes();
    if (go === 'shop') showShop('units');
    if (go === 'upgrades') showUpgrades();
    if (go === 'rewards') showRewards();
    if (go === 'settings') showSettings();
    if (go === 'ach') showAchievements();
    if (go === 'army') showArmies();
    if (go === 'codex') showCodex();
    if (go === 'world') showLeaderboard();
  }));
  mount(el);
}

function rewardsBadge() {
  rolloverDaily();
  const questReady = dailyQuests(save.dq.date, save.dq.swapped).some((q) => !save.dq.claimed.includes(q.id) && (save.dq.c[q.key] ?? 0) >= q.goal)
    || weeklyQuests(save.wq.week).some((q) => !save.wq.claimed.includes(q.id) && (save.wq.c[q.key] ?? 0) >= q.goal);
  return canClaimDaily() || Date.now() >= save.chestAt || questReady;
}

// ---------------- Campaign ----------------
let campaignRegion: RegionId | null = null;
function showCampaign() {
  const cur = campaignRegion ?? REGIONS.find((r) => save.unlocked >= r.from && save.unlocked <= r.to)?.id ?? 'oasis';
  campaignRegion = cur;
  const reg = REGIONS.find((r) => r.id === cur)!;
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="tabs" style="margin-top:10px">${REGIONS.map((r) => `<button class="tab ${r.id === cur ? 'on' : ''}" data-r="${r.id}">${tk('r_' + r.id)} ${save.unlocked < r.from ? '🔒' : ''}</button>`).join('')}</div>
    <div class="levels">${LEVELS.slice(reg.from - 1, reg.to).map((L) => {
      const locked = L.index > save.unlocked;
      return `<button class="lvl ${L.boss ? 'boss' : ''} ${locked ? 'locked' : ''} ${L.index === save.unlocked ? 'current' : ''}" data-l="${L.index}" ${locked ? 'disabled' : ''}>
        ${L.boss ? '👑' : ''}${locked ? '🔒' : num(L.index)}
        <span class="stars">${locked ? '' : starsHtml(save.stars[L.index] ?? 0)}</span>
      </button>`;
    }).join('')}</div>
    <div style="text-align:center;color:var(--muted);font-size:13px">★ ${t('starRules')} · 👑 ${tk('b_' + cur)}</div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => b.addEventListener('click', () => { sfx('click'); campaignRegion = b.dataset.r as RegionId; showCampaign(); }));
  el.querySelectorAll<HTMLElement>('[data-l]').forEach((b) => b.addEventListener('click', () => { sfx('click'); preBattle(Number(b.dataset.l)); }));
  mount(el);
}

// ---------------- Upgrades ----------------
function showUpgrades() {
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="cards">${PLAYER_UNITS.filter((id) => isBase(id) || unitAvailable(id)).map((id) => {
      const d = UNITS[id];
      const lvl = save.unitLevels[id];
      const locked = !unitAvailable(id);
      const cost = upgradeCost(lvl, id);
      const m = upgradeMult(lvl);
      return `<div class="card ${locked ? 'locked' : ''}">
        <img src="${iconFor(id)}" alt="">
        <div class="meta">
          <div class="name">${tk('u_' + id)} <span style="color:var(--gold2)">Lv ${num(lvl)}</span>${tierOf(lvl) ? ` <span class="tier t${tierOf(lvl)}">${t(('tier_' + tierOf(lvl)) as Key)}</span>` : ''}</div>
          <div class="stat">${t('hp')} ${num(Math.round(d.hp * m))} · ${d.heal ? '✚ ' + num(Math.round(d.heal * m)) : t('dmg') + ' ' + num(Math.round(d.dmg * m))}</div>
          ${locked ? `<div class="stat">🔒 ${t('unlocksAt')} ${num(d.unlock)}</div>` : lvl < MAX_UNIT_LEVEL ? `<div class="stat">✨ ${t('nextLook')} ${num(Math.min(20, (tierOf(lvl) + 1) * 5))}</div>` : ''}
        </div>
        ${locked ? '' : lvl >= MAX_UNIT_LEVEL ? `<span class="chip">${t('max')}</span>` :
        `<button class="btn small" data-up="${id}" ${save.gold < cost ? 'disabled' : ''}>🪙 ${num(cost)}</button>`}
      </div>`;
    }).join('')}</div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-up]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.up as UnitId;
    const cost = upgradeCost(save.unitLevels[id], id);
    if (save.gold < cost) return;
    save.gold -= cost;
    save.unitLevels[id]++;
    if (tierOf(save.unitLevels[id]) > tierOf(save.unitLevels[id] - 1)) sfx('rank'); else sfx('coin');
    track('upgrade_purchased', { unit: id, level: save.unitLevels[id], cost });
    progress('upgrade');
    if (save.unitLevels[id] >= 20) unlockAch('legend');
    persist();
    showUpgrades();
  }));
  mount(el);
}

// ---------------- Rewards: 7-day calendar, free chest, daily quests ----------------
const DAILY = [{ g: 100 }, { g: 150 }, { gems: 10 }, { g: 250 }, { g: 300 }, { gems: 25 }, { g: 500, gems: 50 }];
const todayStr = () => new Date().toISOString().slice(0, 10);
function canClaimDaily() { return save.daily.lastClaim !== todayStr(); }
const hms = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`; };
const dhm = (ms: number) => { const h2 = Math.floor(ms / 3600000); return h2 >= 24 ? `${tn('daysLeft', Math.floor(h2 / 24))}` : hms(ms); };
/** One quest line: description, progress bar, claim (and the daily swap) button. */
function questRow(q: QuestDef, book: { c: Record<string, number>; claimed: string[] }, daily: boolean) {
  const v = Math.min(q.goal, book.c[q.key] ?? 0);
  const done = book.claimed.includes(q.id);
  const canSwap = daily && !done && v === 0 && !save.dq.swapped.length;
  return `<div class="quest ${done ? 'done' : ''}"><div class="grow"><div style="font-weight:700">${tn(('qk_' + q.key) as Key, q.goal)} <span style="color:var(--muted)">${num(v)}/${num(q.goal)}</span></div><div class="bar"><i style="width:${(v / q.goal) * 100}%"></i></div></div>
    ${canSwap ? `<button class="btn secondary small" data-swap="${q.id}" title="${t('swapQuest')}">🔄</button>` : ''}<button class="btn small" data-q="${q.id}" data-w="${daily ? 0 : 1}" ${v >= q.goal && !done ? '' : 'disabled'}>${done ? '✓' : rewardLabel(q.reward)}</button></div>`;
}
/** Weekend festival (Friday–Sunday, UTC): battle gold ×1.5 for everyone worldwide. */
const festival = () => [5, 6, 0].includes(new Date().getUTCDay());
const eventMult = () => (festival() ? 1.5 : 1);
function grant(r: { g?: number; gems?: number }) { save.gold += r.g ?? 0; save.gems += r.gems ?? 0; sfx('coin'); }
const rewardLabel = (r: { g?: number; gems?: number }) => [r.g ? `🪙${num(r.g)}` : '', r.gems ? `💎${num(r.gems)}` : ''].filter(Boolean).join(' ');

let chestTimer: number | undefined;
function showRewards() {
  rolloverDaily();
  const dayIdx = save.daily.day % 7;
  const chestReady = Date.now() >= save.chestAt;
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="rewards">
      <div class="col panel">
        <h3>📅 ${t('daily')}</h3>
        <div class="calendar">${DAILY.map((r, i) => `<div class="day ${i < dayIdx ? 'done' : ''} ${i === dayIdx ? 'today' : ''}">${tn('day', i + 1)}<b>${rewardLabel(r)}</b></div>`).join('')}</div>
        <button class="btn" data-a="daily" ${canClaimDaily() ? '' : 'disabled'}>${canClaimDaily() ? t('claim') : t('claimed')}</button>
        <h3 style="margin-top:6px">📜 ${t('quests')} <small class="reset-in">⏳ ${hms(msToReset().day)}</small></h3>
        ${dailyQuests(save.dq.date, save.dq.swapped).map((q) => questRow(q, save.dq, true)).join('')}
        <h3 style="margin-top:6px">🗓️ ${t('weeklyQuests')} <small class="reset-in">⏳ ${dhm(msToReset().week)}</small></h3>
        ${weeklyQuests(save.wq.week).map((q) => questRow(q, save.wq, false)).join('')}
        ${(() => { const all = weeklyQuests(save.wq.week).every((q) => save.wq.claimed.includes(q.id)); return `<div class="quest weekly-bonus"><div class="grow"><b>🎁 ${t('weeklyBonus')}</b> <span style="color:var(--muted)">${num(weeklyQuests(save.wq.week).filter((q) => save.wq.claimed.includes(q.id)).length)}/${num(5)}</span></div><button class="btn small" data-a="wbonus" ${all && !save.wq.bonus ? '' : 'disabled'}>${save.wq.bonus ? '✓' : rewardLabel(WEEKLY_BONUS)}</button></div>`; })()}
      </div>
      <div class="col panel" style="align-items:center;justify-content:center;text-align:center">
        <div style="font-size:72px">🧰</div>
        <h3>${t('chest')}</h3>
        <div id="chestTime" style="font-size:22px;font-weight:900;color:var(--gold2)">${chestReady ? t('chestReady') : ''}</div>
        <button class="btn" data-a="chest" ${chestReady ? '' : 'disabled'}>${t('open')}</button>
        ${chestReady ? '' : `<button class="btn ad" data-a="chestAd" ${save.chestAdsToday >= 5 ? 'disabled' : ''}>${t('openNowAd')} (${num(5 - save.chestAdsToday)})</button>`}
      </div>
    </div>
  </div>`);
  clearInterval(chestTimer);
  if (!chestReady) {
    const tick = () => {
      const ms = save.chestAt - Date.now();
      if (ms <= 0) { clearInterval(chestTimer); showRewards(); return; }
      const s = Math.floor(ms / 1000);
      const ct = el.querySelector('#chestTime');
      if (ct) ct.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    tick(); chestTimer = window.setInterval(tick, 1000);
  }
  const openChest = () => {
    const r = { g: 80 + Math.floor(Math.random() * 120) + save.unlocked * 5, gems: Math.random() < 0.3 ? 5 : 0 };
    grant(r);
    save.chestAt = Date.now() + 4 * 3600 * 1000;
    persist(); showRewards();
  };
  el.querySelector('[data-a="daily"]')?.addEventListener('click', () => {
    if (!canClaimDaily()) return;
    grant(DAILY[dayIdx]);
    save.daily = { day: save.daily.day + 1, lastClaim: todayStr() };
    persist(); showRewards();
  });
  el.querySelector('[data-a="chest"]')?.addEventListener('click', openChest);
  el.querySelector('[data-a="chestAd"]')?.addEventListener('click', async () => {
    if (save.chestAdsToday >= 5) return;
    await showAd('rewarded', 'free_chest');
    save.chestAdsToday++;
    openChest();
  });
  el.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const daily = b.dataset.w !== '1';
    const book = daily ? save.dq : save.wq;
    const q = (daily ? dailyQuests(save.dq.date, save.dq.swapped) : weeklyQuests(save.wq.week)).find((x) => x.id === b.dataset.q)!;
    if (!q || book.claimed.includes(q.id) || (book.c[q.key] ?? 0) < q.goal) return;
    book.claimed.push(q.id);
    grant(q.reward); persist(); showRewards();
  }));
  el.querySelectorAll<HTMLElement>('[data-swap]').forEach((b) => b.addEventListener('click', () => {
    if (save.dq.swapped.length) return; // one free swap per day
    save.dq.swapped.push(b.dataset.swap!); sfx('click'); persist(); showRewards();
  }));
  el.querySelector('[data-a="wbonus"]')?.addEventListener('click', () => {
    if (save.wq.bonus || !weeklyQuests(save.wq.week).every((q) => save.wq.claimed.includes(q.id))) return;
    save.wq.bonus = true; grant(WEEKLY_BONUS); persist(); showRewards();
  });
  mount(el);
}

// ---------------- Settings ----------------
function showSettings() {

  const el = h(`<div class="screen">
    ${topbar()}
    <div class="grow settings-wrap">
      <div class="panel col settings">
        <div class="row lang-row"><b class="grow">🌐 ${t('language')}</b><div class="lang-grid">${LANGS.map((l) => `<button class="btn small ${save.lang === l.id ? '' : 'secondary'}" data-lang="${l.id}" lang="${l.id}" dir="${l.rtl ? 'rtl' : 'ltr'}">${l.name}</button>`).join('')}</div></div>
        <div class="row"><b class="grow">${t('difficulty')}</b></div>
        ${diffPicker()}
        <div class="row"><b class="grow">🎵 ${t('music')}</b><button class="btn small ${save.musicOn ? '' : 'secondary'}" data-a="music">${save.musicOn ? t('on') : t('off')}</button>
          <b>🔊 ${t('sfx')}</b><button class="btn small ${save.sound ? '' : 'secondary'}" data-a="sound">${save.sound ? t('on') : t('off')}</button></div>
        <div class="row"><b class="grow">🔁 ${t('musicRotate')}</b>${[0, 1, 2, 3, 5].map((m) => `<button class="btn small ${save.musicRotate === m ? '' : 'secondary'}" data-rot="${m}">${m ? num(m) + ' ' + t('min') : t('off')}</button>`).join('')}</div>
        <div class="tracks">${['auto', ...TRACKS.map((x) => x.id)].map((id) => `<button class="track ${save.music === id ? 'on' : ''}" data-track="${id}">${id === 'auto' ? '✨ ' + t('auto') : '🎶 ' + tk('t_' + id)}</button>`).join('')}</div>
        <div class="row"><b class="grow">❤️ ${t('hpNumbers')}</b><button class="btn small ${save.showHp ? '' : 'secondary'}" data-a="hp">${save.showHp ? t('on') : t('off')}</button>
          <b>📳 ${t('vibrate')}</b><button class="btn small ${save.vibrate ? '' : 'secondary'}" data-a="vib">${save.vibrate ? t('on') : t('off')}</button></div>
        <div class="row"><b class="grow">🎥 ${t('camera')}</b>${(['both', 'arrows', 'touch'] as const).map((m) => `<button class="btn small ${save.camMode === m ? '' : 'secondary'}" data-cam="${m}">${t(m === 'both' ? 'camBoth' : m === 'arrows' ? 'camArrows' : 'camTouch')}</button>`).join('')}</div>
        <div class="row"><b class="grow">🖼️ ${t('quality')}</b>${(['auto', 'high', 'low'] as const).map((q) => `<button class="btn small ${save.quality === q ? '' : 'secondary'}" data-q="${q}">${t(('q_' + q) as Key)}</button>`).join('')}</div>
        <div class="row"><b class="grow">♿ ${t('accessibility')}</b>
          <button class="btn small ${save.a11y.colorblind ? '' : 'secondary'}" data-a="cb">🎨 ${t('colorblind')}</button>
          <button class="btn small ${save.a11y.calm ? '' : 'secondary'}" data-a="calm">🌙 ${t('calm')}</button></div>
        <div class="row"><b class="grow">${t('cloud')}</b><span class="chip">${cloudOnline ? '☁️ ' + t('cloudOk') : '📱 ' + t('cloudOff')}</span></div>
        <div style="font-size:12px;color:var(--muted)">v1.3.0</div>
      </div>
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { save.lang = b.dataset.lang as Lang; persist(); applySettings(); showSettings(); }));
  el.querySelector('[data-a="cb"]')!.addEventListener('click', () => { save.a11y.colorblind = !save.a11y.colorblind; persist(); applySettings(); showSettings(); });
  el.querySelector('[data-a="calm"]')!.addEventListener('click', () => { save.a11y.calm = !save.a11y.calm; persist(); applySettings(); showSettings(); });
  el.querySelector('[data-a="vib"]')!.addEventListener('click', () => { save.vibrate = !save.vibrate; persist(); if (save.vibrate) buzz(40); showSettings(); });
  el.querySelector('[data-a="sound"]')!.addEventListener('click', () => { save.sound = !save.sound; persist(); setSound(save.sound); showSettings(); });
  el.querySelector('[data-a="music"]')!.addEventListener('click', () => { save.musicOn = !save.musicOn; persist(); setMusicOn(save.musicOn); if (save.musicOn) startMusic('menu', save.music); showSettings(); });
  el.querySelectorAll<HTMLElement>('[data-track]').forEach((b) => b.addEventListener('click', () => {
    unlockAudio(); save.music = b.dataset.track!; persist();
    if (!save.musicOn) { save.musicOn = true; setMusicOn(true); }
    // Preview the chosen track right away.
    if (save.music === 'auto') startMusic('menu', 'auto'); else playTrack(save.music);
    showSettings();
  }));
  el.querySelectorAll<HTMLElement>('[data-rot]').forEach((b) => b.addEventListener('click', () => { save.musicRotate = Number(b.dataset.rot); setRotation(save.musicRotate); persist(); sfx('click'); showSettings(); }));
  el.querySelector('[data-a="hp"]')!.addEventListener('click', () => { save.showHp = !save.showHp; renderer.showHp = save.showHp; persist(); showSettings(); });
  el.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.addEventListener('click', () => { save.camMode = b.dataset.cam as 'both' | 'arrows' | 'touch'; persist(); sfx('click'); showSettings(); }));
  el.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => { save.quality = b.dataset.q as 'auto' | 'high' | 'low'; setLowQuality(save.quality === 'low'); persist(); sfx('click'); showSettings(); }));
  bindDiff(el, showSettings);
  mount(el);
}

// ---------------- Modes hub ----------------
function showModes() {
  const today = todayStr();
  const daily = dailyFor(today, save.unlocked);
  const trophies = CHALLENGES.filter((c) => save.trophies[c.id]).length;
  const survOpen = save.unlocked > 5 || !!save.stars[5];
  const dailyOpen = save.unlocked > 3 || !!save.stars[3];
  const card = (go: string, icon: string, title: string, desc: string, extra: string, locked: string) => `
    <button class="mode-card ${locked ? 'locked' : ''}" data-go="${go}" ${locked ? 'disabled' : ''}>
      <div class="mode-ico">${icon}</div><div class="mode-title">${title}</div><div class="mode-desc">${locked || desc}</div><div class="mode-extra">${extra}</div>
    </button>`;
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="modes-grid">
      ${card('campaign', '🗺️', t('campaign'), t('campaignDesc'), `⭐ ${num(totalStars())}/${num(LEVEL_COUNT * 3)}`, '')}
      ${card('challenges', '🐲', t('challenges'), t('challengesDesc'), `🏆 ${num(trophies)}/${num(CHALLENGES.length)}`, save.unlocked > 6 || save.stars[6] ? '' : `🔒 ${t('needLevel')} ${num(6)}`)}
      ${card('conquest', '⚔️', t('conquest'), t('conquestDesc'), `🏆 ${num(FACTIONS.filter((f) => (save.conquest[f.id] ?? 0) >= CONQUEST_BATTLES).length)}/${num(FACTIONS.length)}`, save.unlocked > 6 || save.stars[6] ? '' : `🔒 ${t('needLevel')} ${num(6)}`)}
      ${card('tower', '🗼', t('tower'), t('towerShort'), `🏆 ${num(save.tower)}/${num(TOWER_FLOORS)}`, save.unlocked > 8 || save.stars[8] ? '' : `🔒 ${t('needLevel')} ${num(8)}`)}
      ${card('survival', '♾️', t('survival'), t('survivalDesc'), `${t('best')}: ${num(save.survivalBest)} ${t('waves')}`, survOpen ? '' : `🔒 ${t('needLevel')} ${num(5)}`)}
      ${card('daily', daily.mod.icon, t('dailyCh'), tk(daily.mod.id), save.dailyDone === today ? t('doneToday') : '💎 25 · 🪙 300', dailyOpen ? '' : `🔒 ${t('needLevel')} ${num(3)}`)}
      ${card('war', '🌐', t('war'), t('warDesc'), `🏆 ${num(Object.keys(save.war.won).length)}/${num(WAR_MODES.length * WAR_TIERS)}`, warOpen() ? '' : `🔒 ${t('needLevel')} ${num(12)}`)}
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
    sfx('click');
    const go = b.dataset.go;
    if (go === 'campaign') showCampaign();
    if (go === 'challenges') showChallenges();
    if (go === 'conquest') showConquest();
    if (go === 'tower') showTower();
    if (go === 'survival') startLevel(survivalLevel(), 0);
    if (go === 'daily') startLevel(daily.level, 0);
    if (go === 'war') showWar();
  }));
  mount(el);
}

// ---------------- Nations War ----------------
const warOpen = () => save.unlocked > 12 || !!save.stars[12];
let blitzBoss = 0;
/** Boss Blitz panel: pick a boss, then fight alone or with an ally; best times per boss. */
function blitzPanel() {
  const best = save.war.blitzBest ?? {};
  const fmt = (s?: number) => (s === undefined ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  const B = BLITZ_BOSSES[blitzBoss];
  return `<div class="panel war-card blitz-card"><div class="war-h">⏱️ <b>${t('blitz')}</b>${save.war.firstWin.blitz !== todayStr() ? '<span class="chip">💎 +20</span>' : ''}</div>
    <div class="war-desc">${t('blitzDesc')}</div>
    <div class="blitz-bosses">${BLITZ_BOSSES.map((bb, i) => `<button class="blitz-boss ${i === blitzBoss ? 'on' : ''}" data-bb="${i}" title="${unitName(bb.id)}"><img src="${enemyIcon(bb.id)}" alt="">${best[`${i}-0`] !== undefined || best[`${i}-1`] !== undefined ? '<i>✓</i>' : ''}</button>`).join('')}</div>
    <div class="blitz-pick"><b>${unitName(B.id)}</b><small>⏱ ${fmt(BLITZ_TIME)} · ${t('bestTime')}: 🛡️ ${fmt(best[`${blitzBoss}-0`])} · 🤝 ${fmt(best[`${blitzBoss}-1`])}</small></div>
    <div class="row war-tiers"><button class="btn small" data-blitz="0">🛡️ ${t('solo')}</button><button class="btn small" data-blitz="1">🤝 ${t('withAlly')}</button></div></div>`;
}
function showWar() {
  const today = todayStr();
  const fac = (id: string) => `<span class="war-fac" title="${t(('role_' + id) as Key)}: ${t(('roled_' + id) as Key)} · ⚡ ${t(('power_' + ROLES[id].power) as Key)}: ${t(('powerd_' + ROLES[id].power) as Key)}"><img src="${facIcon(factionById(id).showcase)}" alt=""><small>${factionById(id).icon} ${tk('f_' + id)}</small><i class="role">${t(('role_' + id) as Key)}</i></span>`;
  const panel = (mode: WarMode) => {
    const { foes, allies } = warLineup(mode, today);
    const you = `<span class="war-fac you"><img src="${iconFor('hero')}" alt=""><small>🛡️ ${t('you')}</small></span>`;
    const side = (list: string[], extra = '') => `<div class="war-side">${extra}${list.map(fac).join('')}</div>`;
    const lineup = mode === 'ffa' ? `${side([], you)}<b class="vs">⚔</b>${side([foes[1]])}<b class="vs">⚔</b>${side([foes[0]])}`
      : mode === 'duo' ? `${side(allies, you)}<b class="vs">VS</b>${side(foes)}`
      : `${side(allies, you)}<b class="vs">VS</b><div class="war-side"><span class="war-fac boss"><img src="${enemyIcon('ifrit')}" alt=""><small>🔥 ${tk('u_ifrit')}</small></span>${fac(foes[0])}</div>`;
    const tiers = Array.from({ length: WAR_TIERS }, (_, k) => {
      const won = save.war.won[`${mode}-${k}`] ?? 0;
      const open = k === 0 || (save.war.won[`${mode}-${k - 1}`] ?? 0) > 0;
      return `<button class="btn small ${won ? '' : 'secondary'}" data-war="${mode}" data-tier="${k}" ${open ? '' : 'disabled'}>${open ? '' : '🔒 '}${'★'.repeat(k + 1)}${won ? ' ✓' : ''}</button>`;
    }).join('');
    return `<div class="panel war-card"><div class="war-h">${WAR_ICON[mode]} <b>${t(('war_' + mode) as Key)}</b>${save.war.firstWin[mode] !== today ? '<span class="chip">💎 +20</span>' : ''}</div>
      <div class="war-desc">${t(('ward_' + mode) as Key)}</div><div class="war-lineup">${lineup}</div><div class="row war-tiers">${tiers}</div></div>`;
  };
  const el = h(`<div class="screen war-screen">${topbar()}
    <div class="war-note">🗓️ ${t('warRotates')} · ⏳ ${hms(msToReset().day)}</div>
    <div class="war-grid">${WAR_MODES.map(panel).join('')}${blitzPanel()}</div>
    <div class="panel roles-box"><b>🎭 ${t('roles')}</b>${Object.keys(ROLES).map((id) => `<div class="role-row"><span>${ROLES[id].icon}</span><b>${id === 'desert' ? t('desertArmy') : tk('f_' + id)} · ${t(('role_' + id) as Key)}</b><small>${t(('roled_' + id) as Key)}${ROLES[id].power !== 'command' ? ` · ⚡ ${t(('power_' + ROLES[id].power) as Key)}: ${t(('powerd_' + ROLES[id].power) as Key)}` : ''}</small></div>`).join('')}</div>
    <div class="row" style="justify-content:center">${diffPicker()}</div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-bb]').forEach((b) => b.addEventListener('click', () => { sfx('click'); blitzBoss = Number(b.dataset.bb); showWar(); }));
  el.querySelectorAll<HTMLElement>('[data-blitz]').forEach((b) => b.addEventListener('click', () => { sfx('click'); startLevel(blitzLevel(blitzBoss, b.dataset.blitz === '1', save.unlocked, todayStr()), 0); }));
  el.querySelectorAll<HTMLElement>('[data-war]').forEach((b) => b.addEventListener('click', () => {
    sfx('click');
    startLevel(warLevel(b.dataset.war as WarMode, Number(b.dataset.tier), save.unlocked, todayStr()), 0);
  }));
  bindDiff(el, showWar);
  mount(el);
}

// ---------------- Clash of civilizations ----------------
const facIcons: Record<string, string> = {};
function facIcon(id: string) { return (facIcons[id] ??= Renderer.icon(UNITS[id as UnitId], 96, 1)); }
function factionOpen(f: FactionDef) { return save.unlocked > f.reqLevel || !!save.stars[f.reqLevel]; }
function showConquest() {
  const el = h(`<div class="screen">${topbar()}
    <div class="fac-list">${FACTIONS.map((f) => {
      const won = save.conquest[f.id] ?? 0, open = factionOpen(f);
      return `<button class="fac-card ${open ? '' : 'locked'}" data-f="${f.id}" ${open ? '' : 'disabled'} style="--fc:${f.color}">
        <div class="fac-portraits"><img src="${facIcon(f.showcase)}" alt=""><img class="boss" src="${facIcon(f.boss)}" alt=""></div>
        <div class="meta"><div class="name">${f.icon} ${tk('f_' + f.id)} ${won >= CONQUEST_BATTLES ? '🏆' : ''}</div>
          <div class="stat">${tk('fd_' + f.id)}</div>
          <div class="pips">${Array.from({ length: CONQUEST_BATTLES }, (_, i) => `<i class="${i < won ? 'on' : ''} ${i === CONQUEST_BATTLES - 1 ? 'boss' : ''}"></i>`).join('')}</div>
          ${conquered(won) ? `<div class="stat" style="color:var(--ok)">🛡️ ${t('armyUnlocked')}</div>` : ''}
          ${open ? '' : `<div class="stat lockmsg">🔒 ${t('needLevel')} ${num(f.reqLevel)}</div>`}</div>
      </button>`;
    }).join('')}</div></div>`);
  el.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => b.addEventListener('click', () => { sfx('click'); showFaction(factionById(b.dataset.f!)); }));
  mount(el);
}
function showFaction(f: FactionDef) {
  const won = save.conquest[f.id] ?? 0;
  const units = [f.miner, ...new Set(f.pool), f.special];
  const el = h(`<div class="screen">${topbar()}
    <div class="fac-head" style="--fc:${f.color}"><b>${f.icon} ${tk('f_' + f.id)}</b><span>${tk('r_' + f.region)}</span></div>
    <div class="fac-units">${units.map((u) => `<div class="fu"><img src="${facIcon(u)}" alt=""><small>${tk('u_' + u)}</small></div>`).join('')}<div class="fu hero"><img src="${facIcon(f.hero)}" alt=""><small>⭐ ${tk('u_' + f.hero)}</small></div><div class="fu boss"><img src="${facIcon(f.boss)}" alt=""><small>👑 ${tk('u_' + f.boss)}</small></div></div>
    <div class="fac-battles">${Array.from({ length: CONQUEST_BATTLES }, (_, i) => {
      const k = i + 1, locked = k > won + 1, stars = save.conquestStars[`${f.id}-${k}`] ?? 0;
      const tag = k === CONQUEST_BATTLES ? '👑' : k === HERO_BATTLE ? '⭐' : k === SIEGE_BATTLE ? '🏰' : k === ELITE_BATTLE ? '💀' : '';
      return `<button class="lvl ${k === CONQUEST_BATTLES || k === HERO_BATTLE ? 'boss' : ''} ${locked ? 'locked' : ''} ${k === won + 1 ? 'current' : ''}" data-k="${k}" ${locked ? 'disabled' : ''} title="${tag ? tk('tag_' + k) : ''}">${tag}${locked ? '🔒' : num(k)}<span class="stars">${locked ? '' : starsHtml(stars)}</span></button>`;
    }).join('')}</div>
    <div class="tag-legend">🏰 ${t('tag_3')} · ⭐ ${t('tag_5')} · 💀 ${t('tag_7')} · 👑 ${t('tag_10')}</div>
    <div class="row" style="justify-content:center">${diffPicker()}</div>
  </div>`);
  el.querySelector('[data-act="back"]')?.addEventListener('click', (e) => { e.stopImmediatePropagation(); showConquest(); }, true);
  el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.addEventListener('click', () => { sfx('click'); startLevel(conquestLevel(f, Number(b.dataset.k)), 0); }));
  bindDiff(el, () => showFaction(f));
  mount(el);
}

// ---------------- Choose your army ----------------
function showArmies() {
  const armies: { id: ArmyId; icon: string; show: EnemyId; open: boolean; roster: EnemyId[] }[] = [
    { id: 'desert', icon: '🏜️', show: 'sword', open: true, roster: PLAYER_UNITS.filter((u) => unitAvailable(u)) },
    ...FACTIONS.map((f) => ({ id: f.id as ArmyId, icon: f.icon, show: f.hero, open: conquered(save.conquest[f.id] ?? 0), roster: rosterOf(f) })),
  ];
  const el = h(`<div class="screen">${topbar()}
    <div class="army-list">${armies.map((a) => `<button class="army-card ${save.army === a.id ? 'on' : ''} ${a.open ? '' : 'locked'}" data-army="${a.id}" ${a.open ? '' : 'disabled'}>
      <div class="army-head"><img src="${unitIcon(a.show)}" alt=""><div><b>${a.icon} ${a.id === 'desert' ? t('desertArmy') : tk('f_' + a.id)}</b>${save.army === a.id ? `<span class="chip">✓ ${t('equipped')}</span>` : ''}</div></div>
      <div class="army-units">${a.roster.slice(0, 10).map((u) => `<img src="${unitIcon(u)}" alt="" title="${tk('u_' + u)}">`).join('')}</div>
      ${a.open ? '' : `<div class="stat lockmsg">🔒 ${t('conquerToUnlock')}</div>`}
    </button>`).join('')}</div></div>`);
  el.querySelectorAll<HTMLElement>('[data-army]').forEach((b) => b.addEventListener('click', () => { save.army = b.dataset.army as ArmyId; persist(); sfx('rank'); showArmies(); }));
  mount(el);
}

// ---------------- Monster challenges ----------------
function challengeLock(c: ChallengeDef) {
  if (!(save.unlocked > c.reqLevel || save.stars[c.reqLevel])) return `🔒 ${t('needLevel')} ${num(c.reqLevel)}`;
  const missing = (c.reqChallenge ?? []).filter((id) => !save.trophies[id]);
  if (missing.length) return `🔒 ${t('needChallenge')} ${missing.map((id) => '«' + tk('ch_' + id) + '»').join('، ')}`;
  return '';
}
function showChallenges() {
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="ch-list">${CHALLENGES.map((c) => {
      const lock = challengeLock(c);
      const won = save.trophies[c.id] ?? 0;
      return `<div class="ch-card ${lock ? 'locked' : ''} ${won ? 'won' : ''}">
        <img class="ch-boss" src="${bossIcons[c.id]}" alt="">
        <div class="meta">
          <div class="name">${c.icon} ${tk('ch_' + c.id)} ${won ? '🏆' : ''}</div>
          <div class="stat">${c.allowed ? `⚠️ ${t('onlyUnits')}: ${c.allowed.map((u) => tk('u_' + u)).join('، ')}` : tk('r_' + c.region)}</div>
          <div class="stat">${t('unlocks')}: ${c.reward.unlocks.map((k) => `<b style="color:var(--gold2)">${unlockName(k)}</b>`).join(' + ')} · 💎 ${num(c.reward.gems)}</div>
          ${lock ? `<div class="stat lockmsg">${lock}</div>` : ''}
        </div>
        ${lock ? '' : `<button class="btn small" data-ch="${c.id}">⚔️ ${t('fight')}</button>`}
      </div>`;
    }).join('')}</div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-ch]').forEach((b) => b.addEventListener('click', () => { sfx('click'); startLevel(challengeLevel(challengeById(b.dataset.ch!)), 0); }));
  mount(el);
}

// ---------------- Shop: units, commander skills, passive boosts ----------------
type ShopTab = 'units' | 'skills' | 'passives' | 'premium';
function showShop(tab: ShopTab) {
  if (tab === 'premium') return showPremium();
  const tabs = (['premium', 'units', 'skills', 'passives'] as ShopTab[]).map((k) => `<button class="tab ${k === tab ? 'on' : ''} ${k === 'premium' ? 'prem' : ''}" data-tab="${k}">${k === 'premium' ? '👑 ' + t('premium') : t(k === 'passives' ? 'passivesT' : k)}</button>`).join('');
  let items = '';
  if (tab === 'units') {
    items = (Object.keys(UNIT_SHOP) as UnitId[]).map((id) => {
      const r = UNIT_SHOP[id]!;
      const d = UNITS[id];
      const own = save.owned.includes(id);
      const lock = reqHtml(r);
      return `<div class="card shop ${own ? 'owned' : ''} ${lock ? 'locked' : ''}">
        <img src="${iconFor(id)}" alt="">
        <div class="meta"><div class="name">${tk('u_' + id)}</div>
          <div class="stat">${tk('ud_' + id)}</div>
          <div class="stat">🪙${num(d.cost)} · ${t('hp')} ${num(d.hp)} · ${d.heal ? '✚ ' + num(d.heal) : t('dmg') + ' ' + num(d.dmg)}${d.flying ? ' · 🪽' : ''}</div>
          ${lock ? `<div class="stat lockmsg">${lock}</div>` : ''}</div>
        ${own ? `<span class="chip">✓ ${t('owned')}</span>` : lock ? '' : `<button class="btn small" data-buy-unit="${id}" ${canAfford(r) ? '' : 'disabled'}>${priceHtml(r)}</button>`}
      </div>`;
    }).join('');
  } else if (tab === 'skills') {
    items = (Object.keys(ABILITIES) as AbilityId[]).map((id) => {
      const a = ABILITIES[id];
      const own = save.abilities.includes(id);
      const lock = own ? '' : reqHtml(a.req);
      const action = own
        ? (save.ability === id ? `<span class="chip">✓ ${t('equipped')}</span>` : `<button class="btn small secondary" data-equip="${id}">${t('equip')}</button>`)
        : lock ? '' : `<button class="btn small" data-buy-ab="${id}" ${canAfford(a.req) ? '' : 'disabled'}>${priceHtml(a.req)}</button>`;
      return `<div class="card shop ${lock ? 'locked' : ''}"><div class="big-ico">${a.icon}</div>
        <div class="meta"><div class="name">${tk('a_' + id)}</div><div class="stat">${tk('ad_' + id)}</div>${lock ? `<div class="stat lockmsg">${lock}</div>` : ''}</div>${action}</div>`;
    }).join('');
  } else {
    items = (Object.keys(PASSIVES) as PassiveId[]).map((id) => {
      const p = PASSIVES[id];
      const lvl = save.passives[id];
      const lock = reqHtml(p.req);
      const cost = p.costs[lvl];
      return `<div class="card shop ${lock ? 'locked' : ''}"><div class="big-ico">${p.icon}</div>
        <div class="meta"><div class="name">${tk('p_' + id)} <span style="color:var(--gold2)">${'●'.repeat(lvl)}${'○'.repeat(PASSIVE_MAX - lvl)}</span></div><div class="stat">${tk('pd_' + id)}</div>${lock ? `<div class="stat lockmsg">${lock}</div>` : ''}</div>
        ${lock ? '' : lvl >= PASSIVE_MAX ? `<span class="chip">${t('max')}</span>` : `<button class="btn small" data-buy-p="${id}" ${save.gold >= cost ? '' : 'disabled'}>🪙 ${num(cost)}</button>`}</div>`;
    }).join('');
  }
  const el = h(`<div class="screen">${topbar()}<div class="tabs" style="margin-top:10px">${tabs}</div><div class="cards shop-grid">${items}</div></div>`);
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { sfx('click'); showShop(b.dataset.tab as ShopTab); }));
  const bought = (what: string, price: Requirement) => { sfx('coin'); track('iap_view', { item: what, gold: price.gold ?? 0, gems: price.gems ?? 0 }); persist(); showShop(tab); };
  el.querySelectorAll<HTMLElement>('[data-buy-unit]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buyUnit as UnitId; const r = UNIT_SHOP[id]!;
    if (!reqMet(r) || !canAfford(r) || save.owned.includes(id)) return;
    pay(r); save.owned.push(id); bought(id, r);
  }));
  el.querySelectorAll<HTMLElement>('[data-buy-ab]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buyAb as AbilityId; const r = ABILITIES[id].req;
    if (!reqMet(r) || !canAfford(r) || save.abilities.includes(id)) return;
    pay(r); save.abilities.push(id); save.ability = id; bought(id, r);
  }));
  el.querySelectorAll<HTMLElement>('[data-equip]').forEach((b) => b.addEventListener('click', () => { save.ability = b.dataset.equip as AbilityId; sfx('click'); persist(); showShop(tab); }));
  el.querySelectorAll<HTMLElement>('[data-buy-p]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buyP as PassiveId; const cost = PASSIVES[id].costs[save.passives[id]];
    if (!reqMet(PASSIVES[id].req) || save.gold < cost || save.passives[id] >= PASSIVE_MAX) return;
    save.gold -= cost; save.passives[id]++; bought(id, { gold: cost });
  }));
  mount(el);
}

// ---------------- Premium store (real money, test mode) ----------------
function checkout(p: Product): Promise<boolean> {
  return new Promise((resolve) => {
    const el = h(`<div class="screen dim" style="z-index:70"><div class="panel col" style="align-items:center;text-align:center;min-width:300px">
      <div style="font-size:12px;color:#ffb38a">${TEST_MODE ? '🧪 ' + t('testPurchase') : ''}</div>
      <h3>${p.kind === 'hero' ? tk('u_' + p.unit) : p.kind === 'sub' ? tk('sub_' + p.plan) : '💎 ' + num(p.gems!)}</h3>
      <div style="font-size:30px;font-weight:900;color:var(--gold2)">${price(p.usd)}</div>
      <div class="row"><button class="btn secondary" data-a="no">${t('back')}</button><button class="btn" data-a="yes">${t('buy')}</button></div></div></div>`);
    document.getElementById('app')!.appendChild(el);
    el.querySelector('[data-a="no"]')!.addEventListener('click', () => { el.remove(); resolve(false); });
    el.querySelector('[data-a="yes"]')!.addEventListener('click', () => { el.remove(); track('iap_purchase', { product: p.id, usd: p.usd, test: TEST_MODE }); resolve(true); });
  });
}
function grantLegend(u: UnitId) {
  if (!save.owned.includes(u)) save.owned.push(u);
  toast(`<span class="toast-ico">👑</span><div><b>${t('newLegend')}</b><div>${tk('u_' + u)}</div></div>`);
  sfx('rank');
}
function subActive() { return !!save.sub.plan && Date.now() < save.sub.until; }
function claimSubDaily() {
  if (!subActive() || save.sub.lastClaim === todayStr()) return false;
  const plan = SUB_PLANS[save.sub.plan!];
  save.gold += plan.gold; save.gems += plan.gems;
  save.sub.lastClaim = todayStr(); save.sub.days++;
  if (save.sub.days % plan.heroAfter === 0) { // a legend for loyal subscribers
    const pool = PREMIUM_UNITS.filter((u) => !save.owned.includes(u));
    if (pool.length) grantLegend(pool[Math.floor(Math.random() * pool.length)]);
  }
  persist(); sfx('coin');
  return true;
}
function showPremium() {
  const tabs = (['premium', 'units', 'skills', 'passives'] as ShopTab[]).map((k) => `<button class="tab ${k === 'premium' ? 'on prem' : ''}" data-tab="${k}">${k === 'premium' ? '👑 ' + t('premium') : t(k === 'passives' ? 'passivesT' : k)}</button>`).join('');
  const heroes = PRODUCTS.filter((p) => p.kind === 'hero').map((p) => {
    const u = p.unit!, d = UNITS[u], own = save.owned.includes(u);
    return `<div class="legend-card ${own ? 'owned' : ''}"><img src="${iconFor(u)}" alt=""><div class="meta"><b>👑 ${tk('u_' + u)}</b><small>${tk('ud_' + u)}</small>
      <small>❤️ ${num(d.hp)} · ⚔️ ${num(d.dmg)}${d.flying ? ' · 🪽' : ''}</small></div>
      ${own ? `<span class="chip">✓ ${t('owned')}</span>` : `<button class="btn small" data-buy="${p.id}">${price(p.usd)}</button>`}</div>`;
  }).join('');
  const subs = (['weekly', 'monthly'] as const).map((plan) => {
    const p = PRODUCTS.find((x) => x.plan === plan)!, P = SUB_PLANS[plan], active = subActive() && save.sub.plan === plan;
    return `<div class="sub-card ${plan} ${active ? 'on' : ''}"><b>${tk('sub_' + plan)}</b><div class="sub-perks">🪙 ${num(P.gold)} + 💎 ${num(P.gems)} ${t('perDay')}<br>👑 ${t('legendEvery')} ${num(P.heroAfter)} ${t('daysWord')}</div>
      ${active ? `<div class="chip">⏳ ${num(Math.ceil((save.sub.until - Date.now()) / 86400000))} ${t('daysWord')}</div><button class="btn small ${save.sub.lastClaim === todayStr() ? 'secondary' : ''}" data-claim ${save.sub.lastClaim === todayStr() ? 'disabled' : ''}>${save.sub.lastClaim === todayStr() ? t('claimed') : t('claim')}</button>` : `<button class="btn small" data-buy="${p.id}">${price(p.usd)}</button>`}</div>`;
  }).join('');
  const gems = PRODUCTS.filter((p) => p.kind === 'gems').map((p) => `<button class="gem-pack" data-buy="${p.id}"><span>💎</span><b>${num(p.gems!)}</b><small>${price(p.usd)}</small></button>`).join('');
  const el = h(`<div class="screen">${topbar()}<div class="tabs" style="margin-top:10px">${tabs}</div>
    <div class="premium">
      <div class="prem-sec"><h3>👑 ${t('legends')}</h3><div class="legend-grid">${heroes}</div></div>
      <div class="prem-sec"><h3>📅 ${t('subscriptions')}</h3><div class="sub-grid">${subs}</div><h3>💎 ${t('gems')}</h3><div class="gem-row">${gems}</div>
      ${TEST_MODE ? `<div class="test-note">🧪 ${t('testNote')}</div>` : ''}</div>
    </div></div>`);
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { sfx('click'); showShop(b.dataset.tab as ShopTab); }));
  el.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', async () => {
    const p = PRODUCTS.find((x) => x.id === b.dataset.buy)!;
    if (!(await checkout(p))) return;
    save.purchases.push(p.id);
    if (p.kind === 'hero') grantLegend(p.unit!);
    else if (p.kind === 'gems') { save.gems += p.gems!; sfx('coin'); }
    else { save.sub = { plan: p.plan!, until: Math.max(Date.now(), save.sub.until) + SUB_PLANS[p.plan!].days * 86400000, lastClaim: null, days: save.sub.plan === p.plan ? save.sub.days : 0 }; claimSubDaily(); }
    persist(); showPremium();
  }));
  el.querySelector('[data-claim]')?.addEventListener('click', () => { claimSubDaily(); showPremium(); });
  mount(el);
}

// ---------------- Trials Tower ----------------
function showTower() {
  const next = Math.min(TOWER_FLOORS, save.tower + 1);
  const floors = Array.from({ length: TOWER_FLOORS }, (_, i) => TOWER_FLOORS - i);
  const el = h(`<div class="screen">${topbar()}
    <div class="tower-wrap"><div class="tower">${floors.map((n) => {
      const r = towerRule(n), done = n <= save.tower, cur = n === next && save.tower < TOWER_FLOORS;
      return `<button class="floor ${done ? 'done' : ''} ${cur ? 'current' : ''} ${n % 5 === 0 ? 'guard' : ''}" data-fl="${n}" ${n > next ? 'disabled' : ''}>
        <b>${num(n)}</b><span>${n % 5 === 0 ? '👹' : r.icon}</span><small>${tk(r.id)}</small>${done ? '<i>✓</i>' : ''}</button>`;
    }).join('')}</div>
    <div class="tower-side panel col"><h3>🗼 ${t('tower')}</h3><div>${t('towerDesc')}</div><div class="chip">🏆 ${num(save.tower)}/${num(TOWER_FLOORS)}</div>
      ${save.tower < TOWER_FLOORS ? `<button class="btn" data-fl="${next}">⚔️ ${t('floor')} ${num(next)}</button>` : ''}${diffPicker()}</div></div></div>`);
  el.querySelectorAll<HTMLElement>('[data-fl]').forEach((b) => b.addEventListener('click', () => { sfx('click'); startLevel(towerLevel(Number(b.dataset.fl)), 0); }));
  bindDiff(el, showTower);
  mount(el);
  requestAnimationFrame(() => el.querySelector('.floor.current')?.scrollIntoView({ block: 'center' }));
}

// ---------------- Pre-battle ----------------
function boostAdsLeft() {
  const k = 'boost:' + todayStr();
  return Math.max(0, 3 - Number(sessionStorageGet(k) ?? 0));
}
function sessionStorageGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

/** Scout report: the enemy types this level fields and the units that counter them. */
function scoutHtml(L: LevelDef) {
  const foes = [...new Set<EnemyId>([...(L.ai?.pool ?? []), ...L.waves.map((w) => w.unit)])].filter((id) => !UNITS[id].miner);
  if (!foes.length) return '';
  const have = (id: UnitId) => unitAvailable(id) || (isBase(id) && UNITS[id].unlock <= L.index);
  const rec = new Map<UnitId, number>();
  for (const f of foes) for (const c of countersOf(f)) if (have(c)) rec.set(c, (rec.get(c) ?? 0) + 1);
  const best = [...rec.entries()].sort((a, z) => z[1] - a[1]).slice(0, 4).map(([id]) => id);
  for (const f of foes) if (!save.seen.includes(f)) save.seen.push(f);
  return `<div class="scout"><div class="scout-h">🔭 ${t('scout')}</div>
    <div class="scout-row"><small>${t('scoutFace')}</small>${foes.map((f) => `<img src="${enemyIcon(f)}" alt="" title="${unitName(f)}">`).join('')}
    ${best.length ? `<span class="scout-sep"></span><small>${t('counterWith')}</small>${best.map((c) => `<img src="${iconFor(c)}" alt="" title="${unitName(c)}">`).join('')}` : ''}</div>
  </div>`;
}

function preBattle(index: number) {
  const L = LEVELS[index - 1];
  // First levels: straight into battle, no menus (PRD: understand in 30s).
  if (index <= 2 && !save.stars[index]) return startBattle(index, 0);
  const left = boostAdsLeft();
  const el = h(`<div class="screen dim">
    <div class="panel col prebattle" style="align-items:center;text-align:center;min-width:320px">
      <div style="color:var(--muted);font-weight:700">${tk('r_' + L.region)}</div>
      <h2 style="font-size:34px;color:var(--gold2)">${L.boss ? '👑 ' + tk('b_' + L.region) : t('level') + ' ' + num(index)}</h2>
      <div class="big-stars" style="font-size:30px">${starsHtml(save.stars[index] ?? 0)}</div>
      <div style="font-size:13px;color:var(--muted)">${t('starRules')}</div>
      ${scoutHtml(L)}
      ${diffPicker()}
      <button class="btn" data-a="go" style="font-size:22px;min-width:200px">⚔️ ${t('play')}</button>
      <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn secondary small" data-a="cancel">${t('back')}</button><button class="btn ad small" data-a="boost" ${left ? '' : 'disabled'}>${t('boostAd')} (${num(left)})</button></div>
    </div>
  </div>`);
  el.querySelector('[data-a="go"]')!.addEventListener('click', () => startBattle(index, 0));
  el.querySelector('[data-a="cancel"]')!.addEventListener('click', () => showCampaign());
  el.querySelector('[data-a="boost"]')!.addEventListener('click', async () => {
    if (!boostAdsLeft()) return;
    await showAd('rewarded', 'pre_battle_boost');
    const k = 'boost:' + todayStr();
    sessionStorageSet(k, String(Number(sessionStorageGet(k) ?? 0) + 1));
    startBattle(index, 150);
  });
  bindDiff(el, () => preBattle(index));
  mount(el);
}

// ---------------- Battle ----------------
let battle: Battle | null = null;
let raf = 0;
let lastT = 0;
let hudRefs: { gold: HTMLElement; time: HTMLElement; btns: Record<string, HTMLElement>; ability: HTMLElement; mini: HTMLElement; minic: HTMLCanvasElement; tower: HTMLElement; mine: HTMLElement; hide: HTMLElement; hint: HTMLElement | null; ctrl: HTMLElement; pads: HTMLElement[]; modes: Record<string, HTMLElement> } | null = null;
let camHold = 0;
let unitPage = 0;
let unitUpHandler: ((e: PointerEvent) => void) | null = null;
let unitPages: { perPage: number; pages: number; order: EnemyId[]; show: (p: number) => void } | null = null;
function unitInfo(btn: HTMLElement, id: EnemyId) {
  const b = battle; if (!b) return;
  const d = UNITS[id];
  const tags = [d.flying && '🪽', d.ranged && '🏹', d.heal && '✚', d.splash && '💥', d.hero && '⭐', d.premium && '👑'].filter(Boolean).join(' ');
  const r = btn.getBoundingClientRect();
  const tip = h(`<div class="unit-tip"><b>${tk('u_' + id)}</b> ${tags}<div>❤️ ${num(d.hp)} · ${d.heal ? '✚ ' + num(d.heal) : '⚔️ ' + num(d.dmg)} · 🪙 ${num(b.costOf(id))} · ⏱ ${num(b.trainTime(id))}s</div>${tk('ud_' + id) !== 'ud_' + id ? `<small>${tk('ud_' + id)}</small>` : ''}<small class="auto">${b.repeat.has(id) ? t('autoOn') : t('autoHint')}</small></div>`);
  document.getElementById('app')!.appendChild(tip);
  tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
  tip.style.top = `${r.top - tip.offsetHeight - 10}px`;
} // -1 / 1 while a camera arrow is held
let tutorialStep = 0;

function stopBattleLoop() { cancelAnimationFrame(raf); battle = null; }

function startBattle(index: number, bonusGold: number) { startLevel(LEVELS[index - 1], bonusGold); }

function startLevel(L: LevelDef, bonusGold: number) {
  const index = L.index;
  stopBattleLoop();
  startMusic(L.boss || L.kind === 'challenge' ? 'boss' : 'battle', save.music, L.region);
  track('level_start', { level: index, kind: L.kind ?? 'campaign', id: L.id, bonus_gold: bonusGold });
  renderer.playerArmy = armyFor(L);
  battle = new Battle(L, perks(L), 150 + bonusGold, {
    onEnd: (win) => setTimeout(() => onBattleEnd(win), 1600),
    onStreak: (n, bonus) => { const k = n >= 12 ? 'st_godlike' : n >= 8 ? 'st_rampage' : n >= 5 ? 'st_mega' : 'st_triple'; ui.appendChild(h(`<div class="streak">${t(k as Key)} <small>+${num(bonus)} 🪙</small></div>`)); setTimeout(() => document.querySelector('.streak')?.remove(), 1600); sfx('rank'); },
    onRage: () => { bannerMsg(`🔥 ${t('rageMode')}`, 'rage'); sfx('volley'); },
    onWave: (n) => { if (n % 5 === 0) bannerMsg(`👑 ${t('wave')} ${num(n)}`); if (n % 3 === 0) setTimeout(() => skillCards(), 400); },
    onRush: () => { bannerMsg(`⚡ ${t('goldRush')}`, 'rush'); sfx('coin'); },
    onLastStand: () => { bannerMsg(`🏰 ${t('lastStand')}`, 'rage'); buzz([60, 40, 120]); },
    onWell: (owner) => { bannerMsg(owner === 0 ? `🌴 ${t('wellOurs')}` : `🌴 ${t('wellLost')}`, owner === 0 ? 'rush' : 'rage'); if (owner === 0) { sfx('coin'); buzz(30); } },
    onDrop: (_kind, side) => { if (side === 0) buzz(25); },
    onPerfect: () => { sfx('rank'); buzz(35); const p = h(`<div class="perfect-pop">✦ ${t('perfect')}</div>`); ui.appendChild(p); setTimeout(() => p.remove(), 900); },
    onSpawn: (id, side) => { if (side === 1 && !save.seen.includes(id)) save.seen.push(id); },
    onEliminated: (nation) => { const c = battle?.cmds.find((k) => k.nation === nation); if (c) { bannerMsg(`🏳️ ${tk('f_' + c.faction)} ${t('eliminated')}`, 'rush'); buzz([40, 30, 40]); } },
    onPower: (nation, power) => { const c = battle?.cmds.find((k) => k.nation === nation); if (c) feed(`${ROLES[c.faction]?.icon ?? ''} <b>${tk('f_' + c.faction)}</b> ⚡ ${t(('power_' + power) as Key)}`, c.ally ? 'ally' : 'foe'); },
    onBoss: (id) => { if ((id as string) === 'enrage') { bannerMsg(`🔥 ${t('bossEnraged')}`, 'rage'); buzz([80, 40, 80]); } else { bannerMsg(`👑 ${tk('u_' + id)}`, 'rage'); buzz(120); } },
    onRank: (u) => { sfx('rank'); if (u.side === 0 && u.rank >= 2) unlockAch('veteran'); },
    onUnitTrained: (id) => {
      rolloverDaily();
      save.quests.units++;
      if (id === 'archer') save.quests.archers++;
      progress('units');
      if (id === 'archer' || id === 'crossbow') progress('archers');
      if (id === 'camel' || id === 'cavalry' || id === 'lion') progress('riders');
      if (tutorialStep === 1 && id === 'sword') advanceTutorial();
    },
  });
  renderer.cam = 0;
  renderer.follow = true;
  tutorialStep = index === 1 && !save.tutorialDone ? 1 : 0;
  if (tutorialStep) track('tutorial_step', { step: 1 });
  buildHud();
  const warBanner = L.war?.mode === 'blitz' ? `⏱️ ${t('blitz')} · ${tk('u_' + L.war.boss) !== 'u_' + L.war.boss ? tk('u_' + L.war.boss) : unitName(L.war.boss!)}` : L.kind === 'war' ? `${WAR_ICON[L.war!.mode]} ${t(('war_' + L.war!.mode) as Key)} · ${'★'.repeat(Number(L.id!.split('-')[1]) + 1)}` : '';
  const towerBanner = L.kind === 'tower' ? `🗼 ${t('floor')} ${num(Number(L.id))} · ${towerRule(Number(L.id)).icon} ${tk(towerRule(Number(L.id)).id)}` : '';
  const fac = L.kind === 'conquest' ? factionById(L.id!.split('-')[0]) : null;
  const banner = warBanner || towerBanner || (fac ? `${fac.icon} ${tk('f_' + fac.id)} · ${t('battle')} ${num(Number(L.id!.split('-')[1]))}` : L.kind === 'challenge' ? `${challengeById(L.id!).icon} ${tk('ch_' + L.id)}` : L.kind === 'survival' ? `♾️ ${t('survival')}` : L.kind === 'daily' ? `📅 ${tk(L.id!)}` : L.boss ? `👑 ${tk('b_' + L.region)}` : '');
  if (banner) bannerMsg(banner);
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

// ---------------- Survival skill cards ----------------
const CARDS: { id: string; icon: string; apply: (b: Battle) => void }[] = [
  { id: 'horde', icon: '👥', apply: (b) => { b.cards.horde += 2; } },
  { id: 'sharp', icon: '⚔️', apply: (b) => { b.cards.dmg *= 1.2; } },
  { id: 'gold', icon: '🪙', apply: (b) => { b.cards.gold *= 1.35; } },
  { id: 'walls', icon: '🏰', apply: (b) => { b.castleMax[0] *= 1.2; b.castleHp[0] = Math.min(b.castleMax[0], b.castleHp[0] + b.castleMax[0] * 0.35); } },
  { id: 'archers', icon: '🏹', apply: (b) => { b.towerArchers[0] = Math.min(MAX_TOWER_ARCHERS, b.towerArchers[0] + 1); b.cards.dmg *= 1.05; } },
  { id: 'veterans', icon: '🎖️', apply: (b) => { for (const u of b.playerArmy) if (u.rank < 3 && !u.def.miner) { u.rank++; u.maxHp *= 1.15; u.dmg *= 1.15; u.hp = u.maxHp; } } },
  { id: 'swift', icon: '💨', apply: (b) => { b.cards.speed *= 1.15; } },
];
function skillCards() {
  const b = battle;
  if (!b || b.over) return;
  b.paused = true;
  const pick = [...CARDS].sort(() => Math.random() - 0.5).slice(0, 3);
  const el = h(`<div class="screen dim" style="z-index:25"><div class="panel col" style="align-items:center">
    <h2 style="color:var(--gold2)">🃏 ${t('chooseCard')}</h2>
    <div class="cards-pick">${pick.map((c2) => `<button class="skill-card" data-card="${c2.id}"><div class="sc-ico">${c2.icon}</div><b>${tk('card_' + c2.id)}</b><small>${tk('cardd_' + c2.id)}</small></button>`).join('')}</div>
  </div></div>`);
  ui.appendChild(el);
  el.querySelectorAll<HTMLElement>('[data-card]').forEach((btn) => btn.addEventListener('click', () => {
    CARDS.find((c2) => c2.id === btn.dataset.card)!.apply(b);
    sfx('rank'); el.remove(); b.paused = false; lastT = performance.now();
  }));
}

function advanceTutorial() {
  tutorialStep++;
  track('tutorial_step', { step: tutorialStep });
  if (tutorialStep > 3) { tutorialStep = 0; save.tutorialDone = true; persist(); }
  placeHint();
}

function placeHint() {
  if (!hudRefs) return;
  hudRefs.hint?.remove();
  hudRefs.hint = null;
  if (!tutorialStep) return;
  const target = tutorialStep === 1 ? hudRefs.btns.sword : tutorialStep === 2 ? hudRefs.modes.attack : null;
  const text = t(`tut${tutorialStep}` as Key);
  const hint = h(`<div class="hint">${text}</div>`);
  ui.appendChild(hint);
  hudRefs.hint = hint;
  requestAnimationFrame(() => {
    if (!target) { hint.style.left = '50%'; hint.style.top = '18%'; hint.style.transform = 'translateX(-50%)'; hint.classList.add('nohand'); return; }
    const r = target.getBoundingClientRect();
    hint.style.left = `${Math.max(8, Math.min(innerWidth - hint.offsetWidth - 8, r.left + r.width / 2 - hint.offsetWidth / 2))}px`;
    hint.style.top = `${r.top - hint.offsetHeight - 14}px`;
  });
  if (tutorialStep === 3) setTimeout(() => { if (tutorialStep === 3) advanceTutorial(); }, 4000);
}

function buildHud() {
  const b = battle!;
  const kindLabel = b.level.war?.timeLimit ? `⏱️ <b data-r="countdown">2:00</b>` : b.level.kind === 'war' ? `${WAR_ICON[b.level.war!.mode]} ${t(('war_' + b.level.war!.mode) as Key)}` : b.level.kind === 'tower' ? `🗼 ${t('floor')} ${num(Number(b.level.id))}` : b.level.kind === 'conquest' ? `${factionById(b.level.id!.split('-')[0]).icon} ${t('battle')} ${num(Number(b.level.id!.split('-')[1]))}` : b.level.winAfter ? `${challengeById(b.level.id!).icon} ${t('surviveFor')} <b data-r="countdown">${num(b.level.winAfter)}</b>` : b.level.kind === 'challenge' ? challengeById(b.level.id!).icon + ' ' + tk('ch_' + b.level.id) : b.level.kind === 'survival' ? '♾️ <b data-r="wave">0</b>' : b.level.kind === 'daily' ? '📅 ' + t('dailyCh') : `${b.level.boss ? '👑' : ''} ${t('level')} ${num(b.level.index)}`;
  const desert = b.roster === PLAYER_UNITS;
  const unlockedUnits: EnemyId[] = desert
    ? PLAYER_UNITS.filter((id) => (b.level.kind === 'campaign' || !b.level.kind ? (isBase(id) ? UNITS[id].unlock <= Math.max(b.level.index, save.unlocked) : unitAvailable(id)) : unitAvailable(id)) && b.isAllowed(id))
    : b.roster.filter((id) => b.isAllowed(id));
  const el = h(`<div class="hud">
    <div class="hud-top">
      <span class="chip gold-chip" style="font-size:20px"><span class="ico">🪙</span><b data-r="gold">0</b></span>
      <span class="chip">⏱ <b data-r="time">0:00</b></span>
      <div class="minimap" data-r="mini"><canvas data-r="minic"></canvas></div>
      <button class="btn secondary small" data-a="follow" title="${t('follow')}">📍</button>
      <div class="boss-bar" data-r="bossbar" style="display:none"><b data-r="bossname"></b><div><i data-r="bosshp"></i></div></div>
      <span class="chip army-count" title="army">🛡️ <b data-r="myn">0</b> <i>⚔</i> <b data-r="en">0</b> 💀</span>
      <span class="chip bonds-chip" data-r="bonds" title="${t('bonds')}" style="display:none"></span>
      <span class="chip">${kindLabel}</span>
      <button class="btn secondary small speed-btn" data-a="speed" aria-label="speed">${'▶'.repeat(save.speed)} ×${save.speed}</button>
      <button class="btn secondary small" data-a="gear" aria-label="settings">⚙️</button>
      <button class="btn secondary small" data-a="pause" aria-label="pause">II</button>
    </div>
    <div class="hud-bottom">
      <div class="unit-pager">
        <button class="pg" data-pg="-1" aria-label="previous">‹</button>
        <div class="units">${unlockedUnits.map((id) => `<button class="ubtn ${UNITS[id].hero ? 'hero' : ''}" data-u="${id}" aria-label="${tk('u_' + id)}">
          <span class="qn" style="display:none"></span><span class="rep" style="display:none">↻</span><img src="${unitIcon(id)}" alt=""><span class="cost">${num(b.costOf(id))}</span><span class="prog"></span></button>`).join('')}</div>
        <button class="pg" data-pg="1" aria-label="next">›</button>
        <div class="pg-dots"></div>
      </div>
      <div class="grow"></div>
      <button class="tbtn" data-a="hide" title="${t('hideMiners')}">🏠<b data-r="hidelbl">${t('hide')}</b></button>
      <button class="tbtn" data-a="mine" title="${t('mineUp')}">⛏️<b data-r="mlvl">1/3</b><small data-r="mcost"></small></button>
      <button class="tbtn" data-a="tower" title="${t('towerArcher')}">🏹<b data-r="tcount">1/${MAX_TOWER_ARCHERS}</b><small data-r="tcost"></small></button>
      ${b.roadsOn ? `<button class="tbtn" data-a="road" title="${t('road')}"><span>🛣️</span><b data-r="roadlbl">${t('roadAuto')}</b></button>` : ''}
      ${b.cmds.some((c) => c.ally) ? `<button class="tbtn ally-power" data-a="allypower" title="${t('allyPower')}"><span data-r="apico">${ROLES[b.cmds.find((c) => c.ally)!.faction]?.icon ?? '🤝'}</span><b>${t('allyPower')}</b></button>` : ''}
      <button class="tbtn" data-a="formation" title="${t('formation')}"><span data-r="fico">⚖️</span><b data-r="flbl">${t('f_line')}</b></button>
      <button class="cbtn" data-a="ctrl" title="${t('control')}">🎯</button>
      <div class="modes">
        <button class="mbtn" data-m="attack">⚔ ${t('attack')}</button>
        <button class="mbtn" data-m="hold">⛺ ${t('hold')}</button>
        <button class="mbtn on" data-m="defend">🛡 ${t('defend')}</button>
      </div>
      <button class="abtn" data-a="ability" title="${tk('a_' + save.ability)}">${ABILITIES[save.ability].icon}</button>
    </div>
  </div>`);
  const camArrows = save.camMode !== 'touch' ? [h(`<button class="cam-arrow left" data-cam="-1" aria-label="left">◀</button>`), h(`<button class="cam-arrow right" data-cam="1" aria-label="right">▶</button>`)] : [];
  const pads = [
    h(`<div class="pad left" style="display:none"><button class="pbtn" data-d="-1">◀</button><button class="pbtn" data-d="1">▶</button></div>`),
    h(`<div class="pad right" style="display:none"><button class="pbtn hit" data-a="hit">⚔</button></div>`),
  ];
  mount(el);
  pads.forEach((p) => ui.appendChild(p));
  camArrows.forEach((a) => {
    ui.appendChild(a);
    const dir = Number(a.dataset.cam);
    const on = (e: Event) => { e.preventDefault(); camHold = dir; renderer.follow = false; a.classList.add('held'); };
    const off = () => { if (camHold === dir) camHold = 0; a.classList.remove('held'); };
    a.addEventListener('pointerdown', on); a.addEventListener('pointerup', off); a.addEventListener('pointerleave', off); a.addEventListener('pointercancel', off);
  });

  const btns: Record<string, HTMLElement> = {};
  // ---- paged unit bar: groups that fit the screen, switched with arrows, dots or a swipe ----
  const order = Array.from(el.querySelectorAll<HTMLElement>('[data-u]'));
  const btnW = innerHeight <= 430 ? 68 : 80;
  const sideW = 5 * 70 + 160; // tower/mine/hide/formation/ctrl buttons + modes + ability
  const perPage = Math.max(3, Math.min(9, Math.floor((innerWidth - sideW - 70) / btnW)));
  const pages = Math.max(1, Math.ceil(order.length / perPage));
  const dots = $(el, '.pg-dots');
  dots.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<i data-dot="${i}"></i>`).join('') : '';
  const showPage = (p: number) => {
    unitPage = (p + pages) % pages;
    order.forEach((bt, i) => (bt.style.display = Math.floor(i / perPage) === unitPage ? '' : 'none'));
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === unitPage));
  };
  el.querySelectorAll<HTMLElement>('[data-pg]').forEach((pb) => { pb.style.display = pages > 1 ? '' : 'none'; pb.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx('click'); showPage(unitPage + Number(pb.dataset.pg)); }); });
  dots.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => d.addEventListener('pointerdown', (e) => { e.preventDefault(); showPage(Number(d.dataset.dot)); }));
  unitPages = { perPage, pages, order: order.map((o) => o.dataset.u as EnemyId), show: showPage };
  showPage(Math.min(unitPage, pages - 1));
  // tap = train, swipe = change page, long-press = unit info
  let press: { x: number; t: number; id: string; timer: number; info: boolean } | null = null;
  const unitsEl = $(el, '.units');
  order.forEach((btn) => {
    btns[btn.dataset.u!] = btn;
    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault(); unlockAudio();
      const id = btn.dataset.u!;
      press = { x: e.clientX, t: performance.now(), id, info: false, timer: window.setTimeout(() => {
        if (!press) return;
        press.info = true; unitInfo(btn, id as EnemyId);
        press.timer = window.setTimeout(() => { // keep holding: toggle auto-train for this unit
          if (!press || !battle) return;
          battle.toggleRepeat(id as EnemyId); buzz(30);
          const tip = document.querySelector('.unit-tip small.auto');
          if (tip) tip.textContent = battle.repeat.has(id as EnemyId) ? t('autoOn') : t('autoOff');
        }, 550);
      }, 450) };
    });
  });
  if (unitUpHandler) removeEventListener('pointerup', unitUpHandler);
  unitUpHandler = (e: PointerEvent) => {
    if (!press) return;
    clearTimeout(press.timer);
    const dx = e.clientX - press.x;
    document.querySelector('.unit-tip')?.remove();
    if (Math.abs(dx) > 40 && pages > 1) showPage(unitPage + (dx < 0 ? 1 : -1));
    else if (!press.info) battle?.train(press.id as EnemyId);
    press = null;
  };
  addEventListener('pointerup', unitUpHandler);
  unitsEl.addEventListener('pointerleave', () => { if (press) { clearTimeout(press.timer); } });
  unitsEl.addEventListener('contextmenu', (e) => { // right-click on desktop toggles auto-train
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-u]');
    if (!btn || !battle) return;
    e.preventDefault(); battle.toggleRepeat(btn.dataset.u as EnemyId);
  });
  el.querySelector('[data-a="road"]')?.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (!battle) return;
    battle.roadChoice = battle.roadChoice === 'auto' ? 0 : battle.roadChoice === 0 ? 1 : 'auto';
    $(el, '[data-r="roadlbl"]').textContent = t(battle.roadChoice === 'auto' ? 'roadAuto' : battle.roadChoice === 0 ? 'roadN' : 'roadS'); sfx('click');
  });
  el.querySelector('[data-a="allypower"]')?.addEventListener('pointerdown', (e) => { e.preventDefault(); const c = battle?.cmds.find((k) => k.ally); if (c && battle?.usePower(c)) buzz(40); });
  const fb = $(el, '[data-a="formation"]');
  const FICO: Record<string, string> = { line: '⚖️', wedge: '🔺', wall: '🧱', skirmish: '🏹' };
  fb.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (!battle) return;
    const next = FORMATIONS[(FORMATIONS.indexOf(battle.formation) + 1) % FORMATIONS.length];
    battle.setFormation(next);
    $(fb, '[data-r="fico"]').textContent = FICO[next]; $(fb, '[data-r="flbl"]').textContent = t(('f_' + next) as Key);
    document.querySelector('.form-tip')?.remove();
    const tip = h(`<div class="unit-tip form-tip"><b>${FICO[next]} ${t(('f_' + next) as Key)}</b><small>${t(('fmd_' + next) as Key)}</small></div>`);
    document.getElementById('app')!.appendChild(tip);
    const r = fb.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`; tip.style.top = `${r.top - tip.offsetHeight - 10}px`;
    setTimeout(() => tip.remove(), 1800);
  });
  const modes: Record<string, HTMLElement> = {};
  el.querySelectorAll<HTMLElement>('[data-m]').forEach((btn) => {
    modes[btn.dataset.m!] = btn;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      battle?.setMode(btn.dataset.m as 'attack');
      Object.values(modes).forEach((m) => m.classList.toggle('on', m === btn));
      renderer.follow = true;
      if (tutorialStep === 2 && btn.dataset.m === 'attack') advanceTutorial();
    });
  });
  const ability = $(el, '[data-a="ability"]');
  ability.addEventListener('pointerdown', (e) => { e.preventDefault(); if (battle?.useAbility()) progress('ability'); });
  const ctrl = $(el, '[data-a="ctrl"]');
  ctrl.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.takeControl(); renderer.follow = true; });
  $(el, '[data-a="pause"]').addEventListener('click', () => pauseMenu());
  $(el, '[data-a="gear"]').addEventListener('click', () => pauseMenu());
  const spd = $(el, '[data-a="speed"]');
  spd.addEventListener('click', () => { save.speed = save.speed === 3 ? 1 : (save.speed + 1) as 2 | 3; persist(); spd.textContent = `${'▶'.repeat(save.speed)} ×${save.speed}`; sfx('click'); });

  // Direct-control pad (hold buttons).
  pads[0].querySelectorAll<HTMLElement>('[data-d]').forEach((p) => {
    const d = Number(p.dataset.d);
    const on = (e: Event) => { e.preventDefault(); if (battle) battle.ctrlDir = d; p.classList.add('held'); };
    const off = () => { if (battle && battle.ctrlDir === d) battle.ctrlDir = 0; p.classList.remove('held'); };
    p.addEventListener('pointerdown', on); p.addEventListener('pointerup', off); p.addEventListener('pointerleave', off); p.addEventListener('pointercancel', off);
  });
  const hit = $(pads[1], '[data-a="hit"]');
  hit.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.pressAttack(); hit.classList.add('held'); });
  const hitOff = () => { if (battle) battle.ctrlAttack = false; hit.classList.remove('held'); };
  hit.addEventListener('pointerup', hitOff); hit.addEventListener('pointerleave', hitOff); hit.addEventListener('pointercancel', hitOff);

  $(el, '[data-a="follow"]').addEventListener('click', () => { renderer.follow = true; sfx('click'); });
  const hb = $(el, '[data-a="hide"]');
  hb.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.toggleHide(); });
  const mb = $(el, '[data-a="mine"]');
  mb.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.upgradeMine(); });
  const tb = $(el, '[data-a="tower"]');
  tb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (battle?.buyTowerArcher() && battle.towerArchers[0] >= MAX_TOWER_ARCHERS) unlockAch('towers'); });
  const mini = $(el, '[data-r="mini"]');
  mini.addEventListener('pointerdown', (e) => {
    const r = mini.getBoundingClientRect();
    renderer.follow = false;
    renderer.cam = ((e.clientX - r.left) / r.width) * W - renderer.viewW / 2;
    renderer.clampCam();
  });

  const minic = $<HTMLCanvasElement>(el, '[data-r="minic"]');
  hudRefs = { gold: $(el, '[data-r="gold"]'), time: $(el, '[data-r="time"]'), btns, ability, mini, minic, tower: tb, mine: mb, hide: hb, hint: null, ctrl, pads, modes };
  placeHint();
}

// Drag the battlefield to look around.
let drag: { x: number; cam: number; pan: boolean } | null = null;
canvas.addEventListener('pointerdown', (e) => { if (battle) { drag = { x: e.clientX, cam: renderer.cam, pan: save.camMode !== 'arrows' }; } });
addEventListener('pointermove', (e) => {
  if (!drag || !battle || !drag.pan) return;
  const dx = (e.clientX - drag.x) * (renderer.viewW / canvas.clientWidth);
  if (Math.abs(dx) > 6) renderer.follow = false;
  renderer.cam = drag.cam - dx;
  renderer.clampCam();
});
addEventListener('pointerup', (e) => {
  // a tap (not a drag) on the battlefield plants the rally flag: the army holds there
  if (battle && drag && Math.abs(e.clientX - drag.x) < 8 && e.target === canvas && !battle.paused) {
    const wx = renderer.cam + (e.clientX - canvas.getBoundingClientRect().left) * (renderer.viewW / canvas.clientWidth);
    battle.setRally(wx);
    renderer.follow = true;
  }
  drag = null;
});

// Keyboard support (desktop testing).
addEventListener('keydown', (e) => {
  if (!battle) return;
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (unitPages && digit) { const id = unitPages.order[unitPage * unitPages.perPage + Number(digit[1]) - 1]; if (id) { if (e.shiftKey) battle.toggleRepeat(id); else battle.train(id); } }
  if (e.key === 'f') { const next = FORMATIONS[(FORMATIONS.indexOf(battle.formation) + 1) % FORMATIONS.length]; battle.setFormation(next); }
  if (e.key === 'Tab' && unitPages) { e.preventDefault(); unitPages.show(unitPage + (e.shiftKey ? -1 : 1)); }
  if (e.key === 'a' || e.key === 'ArrowLeft') battle.ctrlDir = -1;
  if (e.key === 'd' || e.key === 'ArrowRight') battle.ctrlDir = 1;
  if (e.key === ' ' && !e.repeat) battle.pressAttack();
  if (e.key === 'q' && battle.useAbility()) progress('ability');
  if (e.key === 'e') battle.takeControl();
});
addEventListener('keyup', (e) => {
  if (!battle) return;
  if (['a', 'd', 'ArrowLeft', 'ArrowRight'].includes(e.key)) battle.ctrlDir = 0;
  if (e.key === ' ') battle.ctrlAttack = false;
});

function updateHud() {
  const b = battle!, r = hudRefs!;
  r.gold.textContent = num(Math.floor(b.gold));
  const s = Math.floor(b.time);
  r.time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const cd = document.querySelector('[data-r="countdown"]');
  const lim = b.level.winAfter ?? b.level.war?.timeLimit;
  if (cd && lim) { const left = Math.max(0, Math.ceil(lim - b.time)); cd.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; cd.classList.toggle('hurry', left <= 20); }
  const wv = document.querySelector('[data-r="wave"]');
  if (wv) wv.textContent = num(b.survivalWave);
  // boss health bar
  const boss = b.units.find((u) => u.side === 1 && !u.dead && u.def.boss);
  const bb = document.querySelector<HTMLElement>('[data-r="bossbar"]');
  if (bb) {
    bb.style.display = boss ? '' : 'none';
    if (boss) { bb.querySelector('[data-r="bossname"]')!.textContent = `👑 ${tk('u_' + boss.def.id) !== 'u_' + boss.def.id ? tk('u_' + boss.def.id) : tk('b_' + b.level.region)}`; (bb.querySelector('[data-r="bosshp"]') as HTMLElement).style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`; }
  }
  // page dots glow when a unit on that page is ready to train
  if (unitPages && unitPages.pages > 1) {
    const ready = new Array(unitPages.pages).fill(false);
    unitPages.order.forEach((id, i) => { if (b.canTrain(id)) ready[Math.floor(i / unitPages!.perPage)] = true; });
    document.querySelectorAll<HTMLElement>('.pg-dots i').forEach((d, i) => d.classList.toggle('ready', ready[i]));
  }
  // live army counter (fighters only)
  let myn = 0, en = 0;
  for (const u of b.units) if (!u.dead && !u.def.miner) { if (u.side === 0) myn++; else en++; }
  const mynEl = document.querySelector('[data-r="myn"]'), enEl = document.querySelector('[data-r="en"]');
  if (mynEl) mynEl.textContent = num(myn);
  if (enEl) enEl.textContent = num(en);
  // active tribal bonds (player side)
  const bondsEl = document.querySelector<HTMLElement>('[data-r="bonds"]');
  if (bondsEl) {
    const key = [...b.bonds[0]].sort().join(',');
    if (bondsEl.dataset.k !== key) {
      bondsEl.dataset.k = key;
      bondsEl.style.display = key ? '' : 'none';
      bondsEl.innerHTML = [...b.bonds[0]].map((id: BondId) => `<span title="${t(('bond_' + id) as Key)}: ${t(('bondd_' + id) as Key)}">${BONDS[id].icon}</span>`).join('');
    }
  }
  for (const id of b.roster) {
    const btn = r.btns[id];
    if (!btn) continue;
    btn.classList.toggle('cant', !b.canTrain(id));
    const rep = btn.querySelector<HTMLElement>('.rep');
    if (rep) { const on = b.repeat.has(id); if ((rep.style.display === 'none') === on) rep.style.display = on ? '' : 'none'; }
    const qn = b.queue.filter((q) => q.id === id).length;
    const qe = btn.querySelector<HTMLElement>('.qn')!;
    qe.style.display = qn ? '' : 'none';
    qe.textContent = String(qn);
    const head = b.queue[0];
    (btn.querySelector('.prog') as HTMLElement).style.height = head && head.id === id ? `${(1 - head.left / b.trainTime(id)) * 100}%` : '0';
  }
  r.ability.style.setProperty('--p', `${b.ability * 100}%`);
  const ap = document.querySelector<HTMLElement>('[data-a="allypower"]');
  if (ap) { const c = b.cmds.find((k) => k.ally); const p2 = c?.alive ? c.power : 0; ap.style.setProperty('--p', `${p2 * 100}%`); ap.classList.toggle('ready', p2 >= 1); }
  r.ability.classList.toggle('ready', b.ability >= 1);
  const ctrlOn = !!b.controlled;
  r.ctrl.classList.toggle('on', ctrlOn);
  r.pads.forEach((p) => (p.style.display = ctrlOn ? 'flex' : 'none'));
  // mine + hide buttons
  const mcost = b.mineCost();
  r.mine.querySelector('[data-r="mlvl"]')!.textContent = `${num(b.mineLevel[0])}/${num(3)}`;
  r.mine.querySelector('[data-r="mcost"]')!.textContent = isFinite(mcost) ? `🪙${num(mcost)}` : t('max');
  r.mine.classList.toggle('cant', !isFinite(mcost) || b.gold < mcost);
  r.hide.classList.toggle('on', b.hideMiners[0]);
  r.hide.querySelector('[data-r="hidelbl"]')!.textContent = b.hideMiners[0] ? t('release') : t('hide');
  for (const [m, el2] of Object.entries(r.modes)) el2.classList.toggle('on', m === b.mode);
  // tower archer button
  const tc = b.towerCost();
  r.tower.querySelector('[data-r="tcount"]')!.textContent = `${num(b.towerArchers[0])}/${num(MAX_TOWER_ARCHERS)}`;
  r.tower.querySelector('[data-r="tcost"]')!.textContent = isFinite(tc) ? `🪙${num(tc)}` : t('max');
  r.tower.classList.toggle('cant', !isFinite(tc) || b.gold < tc);
  // minimap (canvas: no DOM churn)
  const mc = r.minic, mx = mc.getContext('2d')!;
  if (mc.width !== mc.clientWidth * 2) { mc.width = mc.clientWidth * 2; mc.height = mc.clientHeight * 2; }
  const k = mc.width / W;
  mx.clearRect(0, 0, mc.width, mc.height);
  mx.fillStyle = b.well.owner === 0 ? '#7dff9a' : b.well.owner === 1 ? '#ff7a6a' : 'rgba(255,255,255,.5)'; mx.beginPath(); mx.arc(W / 2 * k, mc.height - 6, 4, 0, 7); mx.fill();
  for (const d of b.drops) { mx.fillStyle = '#ffe066'; mx.fillRect(d.x * k - 2, mc.height - 10, 4, 4); }
  for (const u of b.units) { if (u.dead || u.def.miner) continue; mx.fillStyle = u.side ? (save.a11y.colorblind ? '#4d8fff' : '#e0453a') : '#ffd34d'; mx.fillRect(u.x * k - 2, u.def.flying ? 4 : 12, u.def.boss ? 8 : 4, u.def.boss ? 14 : 10); }
  mx.strokeStyle = 'rgba(255,255,255,.8)'; mx.lineWidth = 3; mx.strokeRect(renderer.cam * k, 2, renderer.viewW * k, mc.height - 4);
}

let hudTick = 0;
let frameAvg = 16, slowFrames = 0, lastFrame = performance.now();
function loop(now: number) {
  if (!battle) return;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  for (let k = 0; k < save.speed; k++) battle.update(dt);
  if (battle.over) battle.finaleTick(dt);
  if (camHold) { renderer.follow = false; renderer.cam += camHold * 900 * dt; renderer.clampCam(); }
  renderer.autoCam(battle, dt * save.speed);
  // auto quality: if frames are slow for a couple of seconds, switch to fast graphics
  if (save.quality === 'auto') {
    frameAvg = frameAvg * 0.97 + (now - lastFrame) * 0.03;
    if (frameAvg > 26 && ++slowFrames > 120) { setLowQuality(true); slowFrames = -100000; }
  }
  lastFrame = now;
  renderer.draw(battle);
  if ((hudTick = (hudTick + 1) % 3) === 0) updateHud();
  raf = requestAnimationFrame(loop);
}

function pauseMenu() {
  if (!battle) return;
  battle.paused = true;
  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel col" style="min-width:260px;align-items:stretch">
    <h2 style="text-align:center">⚙️ ${t('pause')}</h2>
    <div class="row"><b class="grow">🎵 ${t('music')}</b><button class="btn small ${save.musicOn ? '' : 'secondary'}" data-a="pmusic">${save.musicOn ? t('on') : t('off')}</button>
      <b>🔊</b><button class="btn small ${save.sound ? '' : 'secondary'}" data-a="psfx">${save.sound ? t('on') : t('off')}</button></div>
    <div class="tracks">${['auto', ...TRACKS.map((x) => x.id)].map((id) => `<button class="track ${save.music === id ? 'on' : ''}" data-ptrack="${id}">${id === 'auto' ? '✨ ' + t('auto') : '🎶 ' + tk('t_' + id)}</button>`).join('')}</div>
    <div class="row"><b class="grow">❤️ ${t('hpNumbers')}</b><button class="btn small ${save.showHp ? '' : 'secondary'}" data-a="php">${save.showHp ? t('on') : t('off')}</button></div>
    <button class="btn" data-a="resume">${t('resume')}</button>
    <button class="btn secondary" data-a="quit">${t('quit')}</button></div></div>`);
  ui.appendChild(el);
  el.querySelector('[data-a="resume"]')!.addEventListener('click', () => { el.remove(); if (battle) { battle.paused = false; lastT = performance.now(); } });
  const redraw = () => { el.remove(); pauseMenu(); };
  el.querySelector('[data-a="pmusic"]')!.addEventListener('click', () => { unlockAudio(); save.musicOn = !save.musicOn; setMusicOn(save.musicOn); if (save.musicOn && battle) startMusic(battle.level.boss ? 'boss' : 'battle', save.music, battle.level.region); persist(); redraw(); });
  el.querySelector('[data-a="psfx"]')!.addEventListener('click', () => { save.sound = !save.sound; setSound(save.sound); persist(); redraw(); });
  el.querySelector('[data-a="php"]')!.addEventListener('click', () => { save.showHp = !save.showHp; renderer.showHp = save.showHp; persist(); redraw(); });
  el.querySelectorAll<HTMLElement>('[data-ptrack]').forEach((b2) => b2.addEventListener('click', () => { unlockAudio(); save.music = b2.dataset.ptrack!; if (!save.musicOn) { save.musicOn = true; setMusicOn(true); } if (battle) { if (save.music === 'auto') startMusic(battle.level.boss ? 'boss' : 'battle', 'auto', battle.level.region); else playTrack(save.music, true); } persist(); redraw(); }));
  el.querySelector('[data-a="quit"]')!.addEventListener('click', () => {
    const L = battle?.level;
    if (battle) track('level_fail', { level: battle.level.index, reason: 'quit', seconds: Math.round(battle.time) });
    stopBattleLoop(); if (L) backTo(L); else showCampaign();
  });
}

// ---------------- Loot chests ----------------
interface Loot { tier: 'wood' | 'silver' | 'gold'; gold: number; gems: number; upgrade?: UnitId }
function rollChest(L: LevelDef, stars: number): Loot | null {
  const bossy = L.boss || L.kind === 'challenge';
  const chance = bossy ? 1 : L.kind === 'conquest' ? 0.5 : 0.3 + stars * 0.05;
  if (Math.random() > chance) return null;
  const roll = Math.random() + (bossy ? 0.45 : 0) + (save.difficulty === 'hard' ? 0.15 : 0);
  const tier: Loot['tier'] = roll > 1.05 ? 'gold' : roll > 0.65 ? 'silver' : 'wood';
  const lvl = Math.max(1, L.kind === 'campaign' ? L.index : save.unlocked);
  const loot: Loot = { tier, gold: Math.round((tier === 'gold' ? 500 : tier === 'silver' ? 280 : 140) + lvl * (tier === 'wood' ? 6 : 10)), gems: tier === 'gold' ? 30 + Math.floor(Math.random() * 30) : tier === 'silver' ? 10 + Math.floor(Math.random() * 15) : 0 };
  if (tier === 'gold') { // a free upgrade for a unit you use
    const pool = PLAYER_UNITS.filter((u) => unitAvailable(u) && save.unitLevels[u] < MAX_UNIT_LEVEL);
    if (pool.length) loot.upgrade = pool[Math.floor(Math.random() * pool.length)];
  }
  save.gold += loot.gold; save.gems += loot.gems;
  if (loot.upgrade) save.unitLevels[loot.upgrade]++;
  persist();
  return loot;
}
function chestHtml(loot: Loot | null) {
  if (!loot) return '';
  const icon = loot.tier === 'gold' ? '👑' : loot.tier === 'silver' ? '💎' : '🪵';
  return `<button class="chest ${loot.tier}" data-a="chest"><div class="chest-box">🧰<span>${icon}</span></div><small>${tk('chest_' + loot.tier)} · ${t('tapToOpen')}</small>
    <div class="chest-loot">🪙 ${num(loot.gold)}${loot.gems ? ` · 💎 ${num(loot.gems)}` : ''}${loot.upgrade ? ` · ⬆️ ${tk('u_' + loot.upgrade)} +1` : ''}</div></button>`;
}
function bindChest(el: HTMLElement) {
  el.querySelector('[data-a="chest"]')?.addEventListener('click', (e) => { const btn = e.currentTarget as HTMLElement; if (btn.classList.contains('opened')) return; btn.classList.add('opening'); sfx('volley'); setTimeout(() => { btn.classList.add('opened'); sfx('rank'); }, 700); });
}

function statsHtml(b: Battle) {
  const s = b.stats;
  const mvp = (Object.entries(s.damage) as [UnitId, number][]).sort((a, z) => z[1] - a[1])[0];
  const row = (icon: string, k: Key, v: number) => `<div class="stat-cell"><span>${icon}</span><b>${num(Math.round(v))}</b><small>${t(k)}</small></div>`;
  return `<div class="stats-box">
    ${row('⚔️', 'st_kills', s.kills)}${row('💀', 'st_lost', s.lost)}${row('🛡️', 'st_trained', s.trained)}${row('🪙', 'st_mined', s.mined)}${b.level.ai ? row('⛏️', 'st_minersKilled', s.enemyMinersKilled) : ''}
    ${s.wellTime >= 1 ? row('🌴', 'st_well', s.wellTime) : ''}${s.drops ? row('📦', 'st_drops', s.drops) : ''}${s.perfect ? row('✦', 'st_perfect', s.perfect) : ''}
    ${mvp ? `<div class="stat-cell mvp"><img src="${iconFor(mvp[0])}" alt=""><small>${t('mvp')}: ${tk('u_' + mvp[0])}</small></div>` : ''}
  </div>`;
}

function logUnitStats(b: Battle) {
  track('unit_spawned', { level: b.level.index, ...b.producedCounts });
}

/** Feeds quest counters from a battle (only the part not counted yet: a revive can end a battle twice). */
const counted = new WeakMap<Battle, Record<string, number>>();
function countQuests(b: Battle, win: boolean) {
  const prev = counted.get(b) ?? {};
  const now: Record<string, number> = { kills: b.stats.kills, miners: b.stats.enemyMinersKilled, perfect: b.stats.perfect, drops: b.stats.drops, well: Math.floor(b.stats.wellTime), bosses: b.stats.bossKills, survival: b.level.kind === 'survival' ? b.survivalWave : 0 };
  for (const [k, v] of Object.entries(now)) progress(k as never, v - (prev[k] ?? 0));
  counted.set(b, now);
  if (!win) return;
  progress('wins');
  if (b.stars(true) === 3) progress('stars3');
  if (b.level.kind === 'war') progress('war');
  if (b.level.kind === 'conquest') progress('conquest');
  if (b.level.kind === 'challenge' || b.level.kind === 'tower') progress('trials');
}

function onBattleEnd(win: boolean) {
  const b = battle;
  if (!b) return;
  countQuests(b, win);
  hudRefs?.hint?.remove();
  tutorialStep = 0;
  if (win) save.tutorialDone = true;
  stopMusic();
  sfx(win ? 'win' : 'lose');
  const L = b.level;
  setTimeout(() => checkAchievements(b, win), 1200);
  if (!win) {
    const canRevive = !b.revived && L.kind !== 'survival'; // survival pays out on the spot
    const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result lose col" style="align-items:center">
      <h2>${t('defeat')}</h2>
      ${statsHtml(b)}
      ${canRevive ? `<button class="btn ad" data-a="revive">${t('reviveAd')}</button>` : ''}
      <div class="row"><button class="btn" data-a="retry">${t('retry')}</button><button class="btn secondary" data-a="upg">⚔️ ${t('upgrades')}</button><button class="btn secondary" data-a="menu">${t('back')}</button></div>
    </div></div>`);
    ui.appendChild(el);
    const fail = () => { logUnitStats(b); track('level_fail', { level: L.index, seconds: Math.round(b.time), revived: b.revived }); persist(); };
    el.querySelector('[data-a="revive"]')?.addEventListener('click', async () => {
      await showAd('rewarded', 'revive');
      el.remove();
      b.revive();
      startMusic(L.boss ? 'boss' : 'battle', save.music, L.region);
      lastT = performance.now();
    });
    el.querySelector('[data-a="retry"]')!.addEventListener('click', () => { fail(); startLevel(L, 0); });
    el.querySelector('[data-a="upg"]')!.addEventListener('click', () => { fail(); showUpgrades(); stopBattleLoop(); });
    el.querySelector('[data-a="menu"]')!.addEventListener('click', () => { fail(); backTo(L); stopBattleLoop(); });
    if (L.kind === 'survival') {
      // Survival always "loses" eventually: show the score instead of a defeat.
      const waves = b.survivalWave;
      const best = waves > save.survivalBest;
      const gold = waves * 30;
      const gems = best ? Math.max(0, waves - save.survivalBest) : 0;
      save.gold += gold; save.gems += gems;
      if (best) save.survivalBest = waves;
      if (best) syncScores();
      track('level_complete', { level: L.index, kind: 'survival', waves });
      persist();
      $(el, 'h2').innerHTML = `${t('survived')} ${num(waves)} ${t('waves')}${best ? `<div style="font-size:20px;color:var(--ok)">${t('newBest')}</div>` : ''}`;
      $(el, '.result').classList.remove('lose');
      $(el, '.result').insertAdjacentHTML('beforeend', `<div class="loot"><span class="chip gold-chip" style="font-size:20px">🪙 ${num(gold)}</span>${gems ? `<span class="chip" style="font-size:20px">💎 ${num(gems)}</span>` : ''}</div>`);
    }
    return;
  }
  if (L.kind === 'challenge' || L.kind === 'daily' || L.kind === 'conquest' || L.kind === 'tower' || L.kind === 'war') return onSpecialWin(b);

  const stars = b.stars(true);
  const prev = save.stars[L.index] ?? 0;
  const firstClear = prev === 0;
  let gold = Math.round(L.reward * (firstClear ? 1 : 0.6) * DIFFICULTY[save.difficulty].reward * eventMult());
  const gems = Math.max(0, stars - prev) * 3 + (firstClear && L.boss ? 20 : 0);
  save.stars[L.index] = Math.max(prev, stars);
  if (L.index === save.unlocked && L.index < LEVELS.length) save.unlocked++;
  save.gems += gems;
  rolloverDaily();
  save.quests.wins++;
  save.battlesSinceInterstitial++;
  logUnitStats(b);
  track('level_complete', { level: L.index, stars, seconds: Math.round(b.time), fort_pct: Math.round((b.castleHp[0] / b.castleMax[0]) * 100), revived: b.revived });
  save.gold += gold;
  persist();
  if (stars > prev) syncScores();

  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result col" style="align-items:center">
    <h2>${t('victory')}</h2>
    <div class="big-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
    <div class="loot"><span class="chip gold-chip" style="font-size:22px">🪙 <b data-r="g">${num(gold)}</b></span>${gems ? `<span class="chip" style="font-size:22px">💎 ${num(gems)}</span>` : ''}</div>
    ${statsHtml(b)}
    ${chestHtml(rollChest(L, stars))}
    <div class="row" style="justify-content:center"><button class="btn ad" data-a="double">${t('doubleAd')}</button><button class="btn secondary" data-a="share">📤 ${t('share')}</button></div>
    <div class="row"><button class="btn" data-a="next">${t('next')} ${isRtl() ? '◀' : '▶'}</button><button class="btn secondary" data-a="menu">${t('campaign')}</button></div>
  </div></div>`);
  ui.appendChild(el);
  bindChest(el);
  el.querySelector('[data-a="double"]')!.addEventListener('click', async (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    await showAd('rewarded', 'double_loot');
    save.gold += gold;
    gold *= 2;
    $(el, '[data-r="g"]').textContent = num(gold);
    sfx('coin');
    persist();
  });
  el.querySelector('[data-a="share"]')!.addEventListener('click', () => { sfx('click'); void shareVictory(b, stars); });
  const leave = async (next: () => void) => {
    stopBattleLoop();
    // Interstitial rules (PRD 7): only after result, level >= 6, max 1 per 3 battles,
    // never within 3 minutes of a rewarded ad.
    if (L.index >= 6 && save.battlesSinceInterstitial >= 3 && Date.now() - lastRewardedAd > 180000) {
      save.battlesSinceInterstitial = 0; persist();
      await showAd('interstitial', 'post_result');
    }
    flushEvents();
    next();
  };
  el.querySelector('[data-a="next"]')!.addEventListener('click', () => leave(() => preBattle(Math.min(LEVELS.length, L.index + 1))));
  el.querySelector('[data-a="menu"]')!.addEventListener('click', () => leave(() => showCampaign()));
}

/** Builds a 1200×630 victory card (MVP portrait, stars, stats) and shares or downloads it. */
async function shareVictory(b: Battle, stars: number) {
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, '#3a2412'); g.addColorStop(0.55, '#7a4a1e'); g.addColorStop(1, '#e0a84a');
  c.fillStyle = g; c.fillRect(0, 0, 1200, 630);
  c.fillStyle = 'rgba(255,220,150,.08)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(900, -40); c.lineTo(600 + i * 90, 700); c.lineTo(640 + i * 90, 700); c.closePath(); c.fill(); }
  // dunes
  c.fillStyle = '#c98f4a'; c.beginPath(); c.moveTo(0, 520); c.quadraticCurveTo(300, 450, 620, 520); c.quadraticCurveTo(900, 590, 1200, 500); c.lineTo(1200, 630); c.lineTo(0, 630); c.fill();
  const mvp = (Object.entries(b.stats.damage) as [UnitId, number][]).sort((a, z) => z[1] - a[1])[0]?.[0] ?? 'sword';
  const img = new Image(); img.src = Renderer.icon(UNITS[mvp], 420, 0, tierOf(save.unitLevels[mvp] ?? 1));
  await img.decode().catch(() => undefined);
  const rtl = isRtl();
  const tx = rtl ? 1140 : 60;
  c.drawImage(img, rtl ? 40 : 740, 150, 420, 420);
  c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left';
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif';
  c.fillStyle = '#ffd34d'; c.font = `900 84px ${font}`; c.fillText(t('title'), tx, 120);
  c.fillStyle = '#fff6dc'; c.font = `900 54px ${font}`; c.fillText(`${t('victory')} · ${t('level')} ${num(b.level.index)}`, tx, 200);
  c.fillStyle = '#ffd34d'; c.font = `900 70px ${font}`; c.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), tx, 290);
  c.fillStyle = '#fff'; c.font = `700 34px ${font}`;
  const lines = [`⚔️ ${t('st_kills')}: ${num(b.stats.kills)}`, `⏱ ${t('time')}: ${Math.floor(b.time / 60)}:${String(Math.floor(b.time % 60)).padStart(2, '0')}`, `🏅 ${t('mvp')}: ${unitName(mvp)}`];
  lines.forEach((ln, i) => c.fillText(ln, tx, 370 + i * 52));
  c.fillStyle = 'rgba(0,0,0,.35)'; c.font = `700 26px ${font}`; c.fillText(t('shareText'), tx, 590);
  const blob: Blob | null = await new Promise((res) => cv.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'sand-wars-victory.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: t('title'), text: t('shareText') }); return; }
  } catch { /* cancelled or unsupported: fall back to a download */ }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`<span class="toast-ico">🖼️</span><div><b>${t('imageSaved')}</b></div>`);
}

function backTo(L: LevelDef) {
  if (L.kind === 'war') showWar();
  else if (L.kind === 'tower') showTower();
  else if (L.kind === 'conquest') showFaction(factionById(L.id!.split('-')[0]));
  else if (L.kind === 'challenge') showChallenges();
  else if (L.kind === 'survival' || L.kind === 'daily') showModes();
  else showCampaign();
}

function onSpecialWin(b: Battle) {
  const L = b.level;
  let gold = 0, gems = 0;
  let unlocked: string[] = [];
  if (L.kind === 'tower') {
    const n = Number(L.id), first = n > save.tower;
    gold = Math.round(L.reward * (first ? 1 : 0.4));
    gems = first ? (n % 10 === 0 ? 60 : n % 5 === 0 ? 25 : 8) : 0;
    if (first) { save.tower = n; setTimeout(syncScores, 0); }
  } else if (L.kind === 'conquest') {
    const [fid, ks] = L.id!.split('-');
    const k = Number(ks);
    const first = (save.conquest[fid] ?? 0) < k;
    const stars = b.stars(true);
    const key = L.id!;
    gems = Math.max(0, stars - (save.conquestStars[key] ?? 0)) * 3 + (first ? (k === CONQUEST_BATTLES ? 60 : 10) : 0);
    save.conquestStars[key] = Math.max(save.conquestStars[key] ?? 0, stars);
    if (first) save.conquest[fid] = k;
    if (first && k === CONQUEST_BATTLES) setTimeout(() => toast(`<span class="toast-ico">🛡️</span><div><b>${t('armyUnlocked')}</b><div>${tk('f_' + fid)}</div></div>`), 600);
    gold = Math.round(L.reward * (first ? 1 : 0.6));
  } else if (L.war?.mode === 'blitz') {
    const key = L.id!.slice('blitz-'.length); // "<boss>-<ally>"
    const best = save.war.blitzBest ?? (save.war.blitzBest = {});
    const first = best[key] === undefined;
    const record = first || b.time < best[key];
    if (record) best[key] = Math.round(b.time);
    const stars = b.stars(true);
    gold = Math.round(L.reward * (0.6 + stars * 0.2));
    gems = (first ? 20 : 0) + (record && !first ? 5 : 0) + (save.war.firstWin.blitz !== todayStr() ? 20 : 0);
    save.war.firstWin.blitz = todayStr();
    setTimeout(() => toast(`<span class="toast-ico">⏱️</span><div><b>${'★'.repeat(stars)} ${Math.floor(b.time / 60)}:${String(Math.floor(b.time % 60)).padStart(2, '0')}</b>${record ? `<div>${t('newBest')}</div>` : ''}</div>`), 500);
  } else if (L.kind === 'war') {
    const [mode, ts] = L.id!.split('-');
    const key = L.id!;
    const first = !save.war.won[key];
    save.war.won[key] = (save.war.won[key] ?? 0) + 1;
    gold = Math.round(L.reward * (first ? 1.5 : 1));
    gems = (first ? 15 + Number(ts) * 10 : 0) + (save.war.firstWin[mode] !== todayStr() ? 20 : 0); // + first win of the day in this mode
    save.war.firstWin[mode] = todayStr();
  } else if (L.kind === 'challenge') {
    const c = challengeById(L.id!);
    const first = !save.trophies[c.id];
    save.trophies[c.id] = (save.trophies[c.id] ?? 0) + 1;
    gold = first ? c.reward.gold : Math.round(c.reward.gold * 0.4);
    gems = first ? c.reward.gems : 0;
    // Winning the challenge grants the right to buy its units/skills; passives unlock outright.
    if (first) unlocked = c.reward.unlocks;
  } else {
    const first = save.dailyDone !== todayStr();
    gold = first ? 300 : 80;
    gems = first ? 25 : 0;
    save.dailyDone = todayStr();
  }
  gold = Math.round(gold * DIFFICULTY[save.difficulty].reward * eventMult());
  save.gold += gold; save.gems += gems;
  rolloverDaily(); save.quests.wins++;
  track('level_complete', { level: L.index, kind: L.kind, id: L.id, seconds: Math.round(b.time) });
  persist();
  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result col" style="align-items:center">
    <h2>${t('victory')} ${L.kind === 'challenge' ? '🏆' : ''}</h2>
    <div class="loot"><span class="chip gold-chip" style="font-size:22px">🪙 ${num(gold)}</span>${gems ? `<span class="chip" style="font-size:22px">💎 ${num(gems)}</span>` : ''}</div>
    ${statsHtml(b)}
    ${chestHtml(rollChest(L, b.stars(true)))}
    ${unlocked.length ? `<div class="unlock-box"><div style="font-weight:900;color:var(--gold2)">✨ ${t('newUnlock')}</div>${unlocked.map((k) => `<div>${unlockIcon(k)} ${unlockName(k)}</div>`).join('')}</div>` : ''}
    <div class="row">${unlocked.length ? `<button class="btn" data-a="shop">🛒 ${t('shop')}</button>` : ''}<button class="btn secondary" data-a="back">${t('continue')}</button></div>
  </div></div>`);
  ui.appendChild(el);
  bindChest(el);
  el.querySelector('[data-a="shop"]')?.addEventListener('click', () => { stopBattleLoop(); showShop(unlocked.some((k) => k in UNITS) ? 'units' : unlocked.some((k) => k in ABILITIES) ? 'skills' : 'passives'); });
  el.querySelector('[data-a="back"]')!.addEventListener('click', () => { stopBattleLoop(); flushEvents(); backTo(L); });
}

/** Offline treasury: the mines keep digging while you're away (up to 8 hours). */
function offlineTreasury() {
  const away = Date.now() - (save.idleAt || Date.now());
  if (away < 15 * 60000) return;
  const hours = Math.min(8, away / 3600000);
  const gold = Math.round(hours * (40 + Math.min(70, save.unlocked) * 4));
  if (gold < 20) return;
  const ov = h(`<div class="screen dim" style="z-index:40"><div class="panel col idle-box" style="align-items:center;text-align:center">
    <div style="font-size:56px">⛏️💰</div><h3>${t('idleTitle')}</h3>
    <div class="chip gold-chip" style="font-size:24px">🪙 ${num(gold)}</div><small style="color:var(--muted)">⏳ ${hms(Math.min(8 * 3600000, away))}</small>
    <div class="row"><button class="btn" data-a="take">${t('idleCollect')}</button><button class="btn ad" data-a="take2">${t('idleDouble')}</button></div>
  </div></div>`);
  const take = (mult: number) => { save.gold += gold * mult; save.idleAt = Date.now(); persist(); sfx('coin'); ov.remove(); if (!battle) showMenu(); };
  $(ov, '[data-a="take"]').addEventListener('click', () => take(1));
  $(ov, '[data-a="take2"]').addEventListener('click', async () => { await showAd('rewarded', 'idle_double'); take(2); });
  document.getElementById('app')!.appendChild(ov);
}

// ---------------- boot ----------------
function onResize() { renderer.resize(); if (battle) renderer.clampCam(); else drawIdle(); }
function drawIdle() { /* menus use CSS backgrounds */ const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); }
addEventListener('resize', onResize);
rolloverDaily();
applySettings();
onResize();
showMenu();
offlineTreasury();
if (claimSubDaily()) setTimeout(() => toast(`<span class="toast-ico">📅</span><div><b>${t('subDaily')}</b></div>`), 800);
void initCloud(() => { applySettings(); if (!battle) showMenu(); }).then(syncScores);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && battle && !battle.over && !battle.paused) pauseMenu();
});
// Dev-only hook for automated UI tests.
if (import.meta.env.DEV) (window as unknown as { __sw: unknown }).__sw = { get battle() { return battle; }, renderer, setLowQuality, save, conquestLevel, factionById, startBattle, startLevel, challengeLevel, challengeById, survivalLevel, showShop, showModes, showChallenges, offlineTreasury, blitzLevel };

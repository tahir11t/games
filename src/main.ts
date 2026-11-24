import './style.css';
import { t, tk, setLang, getLang, num, type Key } from './i18n';
import { save, persist, initCloud, track, rolloverDaily, cloudOnline, flushEvents } from './save';
import { UNITS, PLAYER_UNITS, BASE_UNITS, MAX_UNIT_LEVEL, upgradeCost, upgradeMult, type UnitId } from './data/units';
import { LEVELS, REGIONS, type RegionId, type LevelDef } from './data/levels';
import { ABILITIES, PASSIVES, PASSIVE_MAX, UNIT_SHOP, type AbilityId, type PassiveId, type Requirement, type Perks } from './data/skills';
import { CHALLENGES, challengeById, challengeLevel, dailyFor, survivalLevel, type ChallengeDef } from './data/challenges';
import { Battle, W } from './game/battle';
import { Renderer } from './game/render';
import { sfx, setSound, setMusicOn, startMusic, stopMusic, unlockAudio, playTrack, TRACKS } from './game/audio';
import { DIFFICULTY, type Difficulty } from './game/battle';
import { LEVEL_COUNT } from './data/levels';

const ui = document.getElementById('ui')!;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const icons = Object.fromEntries(PLAYER_UNITS.map((id) => [id, Renderer.icon(UNITS[id])])) as Record<UnitId, string>;
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
function perks(): Perks & { difficulty: Difficulty } { return { unitLevels: save.unitLevels, ability: save.ability, passives: save.passives, difficulty: save.difficulty }; }
const diffIcon: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' };
function diffPicker() {
  return `<div class="diff-row">${(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => `<button class="diff ${save.difficulty === d ? 'on' : ''}" data-diff="${d}">${diffIcon[d]} ${t(('d_' + d) as Key)}</button>`).join('')}</div><div class="diff-desc">🧠 ${t(('dd_' + save.difficulty) as Key)}</div>`;
}
function bindDiff(el: HTMLElement, redraw: () => void) {
  el.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) => b.addEventListener('click', () => { save.difficulty = b.dataset.diff as Difficulty; sfx('click'); persist(); redraw(); }));
}
const unlockName = (k: string) => (k in UNITS ? tk('u_' + k) : k in ABILITIES ? tk('a_' + k) : tk('p_' + k));
const unlockIcon = (k: string) => (k in UNITS ? `<img src="${icons[k as UnitId]}" style="width:40px;height:40px;vertical-align:middle">` : k in ABILITIES ? ABILITIES[k as AbilityId].icon : PASSIVES[k as PassiveId].icon);

function applySettings() {
  setLang(save.lang);
  setSound(save.sound);
  setMusicOn(save.musicOn);
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
}

function topbar(back = true) {
  return `<div class="topbar">
    ${back ? `<button class="btn secondary small" data-act="back">${getLang() === 'ar' ? '→' : '←'} ${t('back')}</button>` : ''}
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
        <div class="menu-buttons">
          <button class="btn play" data-go="play">${t('play')} · ${t('level')} ${num(save.unlocked)}</button>
          <button class="btn secondary" data-go="modes">🏟️ ${t('modes')}</button>
          <button class="btn secondary" data-go="shop">🛒 ${t('shop')}</button>
          <button class="btn secondary" data-go="upgrades">⚔️ ${t('upgrades')}</button>
          <button class="btn secondary" data-go="rewards">🎁 ${t('daily')}${rewardsBadge() ? ' •' : ''}</button>
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
  }));
  mount(el);
}

function rewardsBadge() {
  return canClaimDaily() || Date.now() >= save.chestAt;
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
        <img src="${icons[id]}" alt="">
        <div class="meta">
          <div class="name">${tk('u_' + id)} <span style="color:var(--gold2)">Lv ${num(lvl)}</span></div>
          <div class="stat">${t('hp')} ${num(Math.round(d.hp * m))} · ${d.heal ? '✚ ' + num(Math.round(d.heal * m)) : t('dmg') + ' ' + num(Math.round(d.dmg * m))}</div>
          ${locked ? `<div class="stat">🔒 ${t('unlocksAt')} ${num(d.unlock)}</div>` : ''}
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
    sfx('coin');
    track('upgrade_purchased', { unit: id, level: save.unitLevels[id], cost });
    persist();
    showUpgrades();
  }));
  mount(el);
}

// ---------------- Rewards: 7-day calendar, free chest, daily quests ----------------
const DAILY = [{ g: 100 }, { g: 150 }, { gems: 10 }, { g: 250 }, { g: 300 }, { gems: 25 }, { g: 500, gems: 50 }];
const todayStr = () => new Date().toISOString().slice(0, 10);
function canClaimDaily() { return save.daily.lastClaim !== todayStr(); }
const QUESTS = [
  { id: 'q_win2', key: 'wins' as const, goal: 2, reward: { g: 150, gems: 5 } },
  { id: 'q_archers', key: 'archers' as const, goal: 20, reward: { g: 200, gems: 5 } },
  { id: 'q_units', key: 'units' as const, goal: 50, reward: { g: 250, gems: 10 } },
];
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
        <div class="calendar">${DAILY.map((r, i) => `<div class="day ${i < dayIdx ? 'done' : ''} ${i === dayIdx ? 'today' : ''}">${t('day')} ${num(i + 1)}<b>${rewardLabel(r)}</b></div>`).join('')}</div>
        <button class="btn" data-a="daily" ${canClaimDaily() ? '' : 'disabled'}>${canClaimDaily() ? t('claim') : t('claimed')}</button>
        <h3 style="margin-top:6px">📜 ${t('quests')}</h3>
        ${QUESTS.map((q) => {
          const v = Math.min(q.goal, save.quests[q.key]);
          const done = save.quests.claimed.includes(q.id);
          return `<div class="quest"><div class="grow"><div style="font-weight:700">${tk(q.id)} <span style="color:var(--muted)">${num(v)}/${num(q.goal)}</span></div><div class="bar"><i style="width:${(v / q.goal) * 100}%"></i></div></div>
            <button class="btn small" data-q="${q.id}" ${v >= q.goal && !done ? '' : 'disabled'}>${done ? '✓' : rewardLabel(q.reward)}</button></div>`;
        }).join('')}
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
    const q = QUESTS.find((x) => x.id === b.dataset.q)!;
    if (save.quests.claimed.includes(q.id) || save.quests[q.key] < q.goal) return;
    save.quests.claimed.push(q.id);
    grant(q.reward); persist(); showRewards();
  }));
  mount(el);
}

// ---------------- Settings ----------------
function showSettings() {
  const langs: [string, string][] = [['ar', 'العربية'], ['en', 'English'], ['tr', 'Türkçe']];
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="grow settings-wrap">
      <div class="panel col settings">
        <div class="row"><b class="grow">${t('language')}</b>${langs.map(([k, n]) => `<button class="btn small ${save.lang === k ? '' : 'secondary'}" data-lang="${k}">${n}</button>`).join('')}</div>
        <div class="row"><b class="grow">${t('difficulty')}</b></div>
        ${diffPicker()}
        <div class="row"><b class="grow">🎵 ${t('music')}</b><button class="btn small ${save.musicOn ? '' : 'secondary'}" data-a="music">${save.musicOn ? t('on') : t('off')}</button>
          <b>🔊 ${t('sfx')}</b><button class="btn small ${save.sound ? '' : 'secondary'}" data-a="sound">${save.sound ? t('on') : t('off')}</button></div>
        <div class="tracks">${['auto', ...TRACKS.map((x) => x.id)].map((id) => `<button class="track ${save.music === id ? 'on' : ''}" data-track="${id}">${id === 'auto' ? '✨ ' + t('auto') : '🎶 ' + tk('t_' + id)}</button>`).join('')}</div>
        <div class="row"><b class="grow">${t('cloud')}</b><span class="chip">${cloudOnline ? '☁️ ' + t('cloudOk') : '📱 ' + t('cloudOff')}</span></div>
        <div style="font-size:12px;color:var(--muted)">v0.3.0</div>
      </div>
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { save.lang = b.dataset.lang as 'ar' | 'en' | 'tr'; persist(); applySettings(); showSettings(); }));
  el.querySelector('[data-a="sound"]')!.addEventListener('click', () => { save.sound = !save.sound; persist(); setSound(save.sound); showSettings(); });
  el.querySelector('[data-a="music"]')!.addEventListener('click', () => { save.musicOn = !save.musicOn; persist(); setMusicOn(save.musicOn); if (save.musicOn) startMusic('menu', save.music); showSettings(); });
  el.querySelectorAll<HTMLElement>('[data-track]').forEach((b) => b.addEventListener('click', () => {
    unlockAudio(); save.music = b.dataset.track!; persist();
    if (!save.musicOn) { save.musicOn = true; setMusicOn(true); }
    // Preview the chosen track right away.
    if (save.music === 'auto') startMusic('menu', 'auto'); else playTrack(save.music);
    showSettings();
  }));
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
      ${card('survival', '♾️', t('survival'), t('survivalDesc'), `${t('best')}: ${num(save.survivalBest)} ${t('waves')}`, survOpen ? '' : `🔒 ${t('needLevel')} ${num(5)}`)}
      ${card('daily', daily.mod.icon, t('dailyCh'), tk(daily.mod.id), save.dailyDone === today ? t('doneToday') : '💎 25 · 🪙 300', dailyOpen ? '' : `🔒 ${t('needLevel')} ${num(3)}`)}
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
    sfx('click');
    const go = b.dataset.go;
    if (go === 'campaign') showCampaign();
    if (go === 'challenges') showChallenges();
    if (go === 'survival') startLevel(survivalLevel(), 0);
    if (go === 'daily') startLevel(daily.level, 0);
  }));
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
type ShopTab = 'units' | 'skills' | 'passives';
function showShop(tab: ShopTab) {
  const tabs = (['units', 'skills', 'passives'] as ShopTab[]).map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${t(k === 'passives' ? 'passivesT' : k)}</button>`).join('');
  let items = '';
  if (tab === 'units') {
    items = (Object.keys(UNIT_SHOP) as UnitId[]).map((id) => {
      const r = UNIT_SHOP[id]!;
      const d = UNITS[id];
      const own = save.owned.includes(id);
      const lock = reqHtml(r);
      return `<div class="card shop ${own ? 'owned' : ''} ${lock ? 'locked' : ''}">
        <img src="${icons[id]}" alt="">
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

// ---------------- Pre-battle ----------------
function boostAdsLeft() {
  const k = 'boost:' + todayStr();
  return Math.max(0, 3 - Number(sessionStorageGet(k) ?? 0));
}
function sessionStorageGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

function preBattle(index: number) {
  const L = LEVELS[index - 1];
  // First levels: straight into battle, no menus (PRD: understand in 30s).
  if (index <= 2 && !save.stars[index]) return startBattle(index, 0);
  const left = boostAdsLeft();
  const el = h(`<div class="screen dim">
    <div class="panel col" style="align-items:center;text-align:center;min-width:320px">
      <div style="color:var(--muted);font-weight:700">${tk('r_' + L.region)}</div>
      <h2 style="font-size:34px;color:var(--gold2)">${L.boss ? '👑 ' + tk('b_' + L.region) : t('level') + ' ' + num(index)}</h2>
      <div class="big-stars" style="font-size:30px">${starsHtml(save.stars[index] ?? 0)}</div>
      <div style="font-size:13px;color:var(--muted)">${t('starRules')}</div>
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
let hudRefs: { gold: HTMLElement; time: HTMLElement; btns: Record<string, HTMLElement>; ability: HTMLElement; mini: HTMLElement; view: HTMLElement; hint: HTMLElement | null; ctrl: HTMLElement; pads: HTMLElement[]; modes: Record<string, HTMLElement> } | null = null;
let tutorialStep = 0;

function stopBattleLoop() { cancelAnimationFrame(raf); battle = null; }

function startBattle(index: number, bonusGold: number) { startLevel(LEVELS[index - 1], bonusGold); }

function startLevel(L: LevelDef, bonusGold: number) {
  const index = L.index;
  stopBattleLoop();
  startMusic(L.boss || L.kind === 'challenge' ? 'boss' : 'battle', save.music, L.region);
  track('level_start', { level: index, kind: L.kind ?? 'campaign', id: L.id, bonus_gold: bonusGold });
  battle = new Battle(L, perks(), 150 + bonusGold, {
    onEnd: (win) => setTimeout(() => onBattleEnd(win), 900),
    onWave: (n) => { if (n % 5 === 0) ui.appendChild(h(`<div class="boss-banner">👑 ${t('wave')} ${num(n)}</div>`)); },
    onRank: () => sfx('rank'),
    onUnitTrained: (id) => {
      rolloverDaily();
      save.quests.units++;
      if (id === 'archer') save.quests.archers++;
      if (tutorialStep === 1 && id === 'sword') advanceTutorial();
    },
  });
  renderer.cam = 0;
  renderer.follow = true;
  tutorialStep = index === 1 && !save.tutorialDone ? 1 : 0;
  if (tutorialStep) track('tutorial_step', { step: 1 });
  buildHud();
  const banner = L.kind === 'challenge' ? `${challengeById(L.id!).icon} ${tk('ch_' + L.id)}` : L.kind === 'survival' ? `♾️ ${t('survival')}` : L.kind === 'daily' ? `📅 ${tk(L.id!)}` : L.boss ? `👑 ${tk('b_' + L.region)}` : '';
  if (banner) ui.appendChild(h(`<div class="boss-banner">${banner}</div>`));
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
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
  const kindLabel = b.level.winAfter ? `${challengeById(b.level.id!).icon} ${t('surviveFor')} <b data-r="countdown">${num(b.level.winAfter)}</b>` : b.level.kind === 'challenge' ? challengeById(b.level.id!).icon + ' ' + tk('ch_' + b.level.id) : b.level.kind === 'survival' ? '♾️ <b data-r="wave">0</b>' : b.level.kind === 'daily' ? '📅 ' + t('dailyCh') : `${b.level.boss ? '👑' : ''} ${t('level')} ${num(b.level.index)}`;
  const unlockedUnits = PLAYER_UNITS.filter((id) => (b.level.kind === 'campaign' || !b.level.kind ? (isBase(id) ? UNITS[id].unlock <= Math.max(b.level.index, save.unlocked) : unitAvailable(id)) : unitAvailable(id)) && b.isAllowed(id));
  const el = h(`<div class="hud">
    <div class="hud-top">
      <span class="chip gold-chip" style="font-size:20px"><span class="ico">🪙</span><b data-r="gold">0</b></span>
      <span class="chip">⏱ <b data-r="time">0:00</b></span>
      <div class="minimap" data-r="mini"><div class="view" data-r="view"></div></div>
      <span class="chip">${kindLabel}</span>
      <button class="btn secondary small speed-btn" data-a="speed" aria-label="speed">▶${save.speed === 2 ? '▶' : ''} ×${save.speed}</button>
      <button class="btn secondary small" data-a="pause" aria-label="pause">II</button>
    </div>
    <div class="hud-bottom">
      <div class="units">${PLAYER_UNITS.filter((id) => unlockedUnits.includes(id)).map((id) => `<button class="ubtn ${unlockedUnits.includes(id) ? '' : 'locked'}" data-u="${id}" aria-label="${tk('u_' + id)}">
        <span class="qn" style="display:none"></span><img src="${icons[id]}" alt=""><span class="cost">${num(UNITS[id].cost)}</span><span class="prog"></span></button>`).join('')}</div>
      <div class="grow"></div>
      <button class="cbtn" data-a="ctrl" title="${t('control')}">🎯</button>
      <div class="modes">
        <button class="mbtn" data-m="attack">⚔ ${t('attack')}</button>
        <button class="mbtn" data-m="hold">⛺ ${t('hold')}</button>
        <button class="mbtn on" data-m="defend">🛡 ${t('defend')}</button>
      </div>
      <button class="abtn" data-a="ability" title="${tk('a_' + save.ability)}">${ABILITIES[save.ability].icon}</button>
    </div>
  </div>`);
  const pads = [
    h(`<div class="pad left" style="display:none"><button class="pbtn" data-d="-1">◀</button><button class="pbtn" data-d="1">▶</button></div>`),
    h(`<div class="pad right" style="display:none"><button class="pbtn hit" data-a="hit">⚔</button></div>`),
  ];
  mount(el);
  pads.forEach((p) => ui.appendChild(p));

  const btns: Record<string, HTMLElement> = {};
  el.querySelectorAll<HTMLElement>('[data-u]').forEach((btn) => {
    btns[btn.dataset.u!] = btn;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); battle?.train(btn.dataset.u as UnitId); });
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
  ability.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.useAbility(); });
  const ctrl = $(el, '[data-a="ctrl"]');
  ctrl.addEventListener('pointerdown', (e) => { e.preventDefault(); battle?.takeControl(); renderer.follow = true; });
  $(el, '[data-a="pause"]').addEventListener('click', () => pauseMenu());
  const spd = $(el, '[data-a="speed"]');
  spd.addEventListener('click', () => { save.speed = save.speed === 1 ? 2 : 1; persist(); spd.textContent = `▶${save.speed === 2 ? '▶' : ''} ×${save.speed}`; sfx('click'); });

  // Direct-control pad (hold buttons).
  pads[0].querySelectorAll<HTMLElement>('[data-d]').forEach((p) => {
    const d = Number(p.dataset.d);
    const on = (e: Event) => { e.preventDefault(); if (battle) battle.ctrlDir = d; p.classList.add('held'); };
    const off = () => { if (battle && battle.ctrlDir === d) battle.ctrlDir = 0; p.classList.remove('held'); };
    p.addEventListener('pointerdown', on); p.addEventListener('pointerup', off); p.addEventListener('pointerleave', off); p.addEventListener('pointercancel', off);
  });
  const hit = $(pads[1], '[data-a="hit"]');
  hit.addEventListener('pointerdown', (e) => { e.preventDefault(); if (battle) battle.ctrlAttack = true; hit.classList.add('held'); });
  const hitOff = () => { if (battle) battle.ctrlAttack = false; hit.classList.remove('held'); };
  hit.addEventListener('pointerup', hitOff); hit.addEventListener('pointerleave', hitOff); hit.addEventListener('pointercancel', hitOff);

  const mini = $(el, '[data-r="mini"]');
  mini.addEventListener('pointerdown', (e) => {
    const r = mini.getBoundingClientRect();
    renderer.follow = false;
    renderer.cam = ((e.clientX - r.left) / r.width) * W - renderer.viewW / 2;
    renderer.clampCam();
  });

  hudRefs = { gold: $(el, '[data-r="gold"]'), time: $(el, '[data-r="time"]'), btns, ability, mini, view: $(el, '[data-r="view"]'), hint: null, ctrl, pads, modes };
  placeHint();
}

// Drag the battlefield to look around.
let drag: { x: number; cam: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { if (battle) { drag = { x: e.clientX, cam: renderer.cam }; } });
addEventListener('pointermove', (e) => {
  if (!drag || !battle) return;
  const dx = (e.clientX - drag.x) * (renderer.viewW / canvas.clientWidth);
  if (Math.abs(dx) > 6) renderer.follow = false;
  renderer.cam = drag.cam - dx;
  renderer.clampCam();
});
addEventListener('pointerup', () => (drag = null));

// Keyboard support (desktop testing).
addEventListener('keydown', (e) => {
  if (!battle) return;
  const map: Record<string, UnitId> = { '1': 'miner', '2': 'sword', '3': 'archer', '4': 'spear', '5': 'camel', '6': 'catapult' };
  if (map[e.key]) battle.train(map[e.key]);
  if (e.key === 'a' || e.key === 'ArrowLeft') battle.ctrlDir = -1;
  if (e.key === 'd' || e.key === 'ArrowRight') battle.ctrlDir = 1;
  if (e.key === ' ') battle.ctrlAttack = true;
  if (e.key === 'q') battle.useAbility();
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
  if (cd && b.level.winAfter) cd.textContent = num(Math.max(0, Math.ceil(b.level.winAfter - b.time)));
  const wv = document.querySelector('[data-r="wave"]');
  if (wv) wv.textContent = num(b.survivalWave);
  for (const id of PLAYER_UNITS) {
    const btn = r.btns[id];
    if (!btn) continue;
    btn.classList.toggle('cant', !b.canTrain(id));
    const qn = b.queue.filter((q) => q.id === id).length;
    const qe = btn.querySelector<HTMLElement>('.qn')!;
    qe.style.display = qn ? '' : 'none';
    qe.textContent = String(qn);
    const head = b.queue[0];
    (btn.querySelector('.prog') as HTMLElement).style.height = head && head.id === id ? `${(1 - head.left / UNITS[id].train) * 100}%` : '0';
  }
  r.ability.style.setProperty('--p', `${b.ability * 100}%`);
  r.ability.classList.toggle('ready', b.ability >= 1);
  const ctrlOn = !!b.controlled;
  r.ctrl.classList.toggle('on', ctrlOn);
  r.pads.forEach((p) => (p.style.display = ctrlOn ? 'flex' : 'none'));
  // minimap
  r.view.style.left = `${(renderer.cam / W) * 100}%`;
  r.view.style.width = `${(renderer.viewW / W) * 100}%`;
  const dots = b.units.filter((u) => !u.dead && u.def.id !== 'miner');
  let html = `<div class="view" style="left:${(renderer.cam / W) * 100}%;width:${(renderer.viewW / W) * 100}%"></div>`;
  for (let i = 0; i < dots.length; i += dots.length > 50 ? 2 : 1) html += `<i style="left:${(dots[i].x / W) * 100}%;background:${dots[i].side ? '#e0453a' : '#ffd34d'}"></i>`;
  r.mini.innerHTML = html;
  r.view = r.mini.firstElementChild as HTMLElement;
}

let hudTick = 0;
function loop(now: number) {
  if (!battle) return;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  for (let k = 0; k < save.speed; k++) battle.update(dt);
  renderer.autoCam(battle, dt * save.speed);
  renderer.draw(battle);
  if ((hudTick = (hudTick + 1) % 3) === 0) updateHud();
  raf = requestAnimationFrame(loop);
}

function pauseMenu() {
  if (!battle) return;
  battle.paused = true;
  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel col" style="min-width:260px;align-items:stretch">
    <h2 style="text-align:center">${t('pause')}</h2>
    <button class="btn" data-a="resume">${t('resume')}</button>
    <button class="btn secondary" data-a="quit">${t('quit')}</button></div></div>`);
  ui.appendChild(el);
  el.querySelector('[data-a="resume"]')!.addEventListener('click', () => { el.remove(); if (battle) { battle.paused = false; lastT = performance.now(); } });
  el.querySelector('[data-a="quit"]')!.addEventListener('click', () => {
    const L = battle?.level;
    if (battle) track('level_fail', { level: battle.level.index, reason: 'quit', seconds: Math.round(battle.time) });
    stopBattleLoop(); if (L) backTo(L); else showCampaign();
  });
}

function statsHtml(b: Battle) {
  const s = b.stats;
  const mvp = (Object.entries(s.damage) as [UnitId, number][]).sort((a, z) => z[1] - a[1])[0];
  const row = (icon: string, k: Key, v: number) => `<div class="stat-cell"><span>${icon}</span><b>${num(Math.round(v))}</b><small>${t(k)}</small></div>`;
  return `<div class="stats-box">
    ${row('⚔️', 'st_kills', s.kills)}${row('💀', 'st_lost', s.lost)}${row('🛡️', 'st_trained', s.trained)}${row('🪙', 'st_mined', s.mined)}${b.level.ai ? row('⛏️', 'st_minersKilled', s.enemyMinersKilled) : ''}
    ${mvp ? `<div class="stat-cell mvp"><img src="${icons[mvp[0]]}" alt=""><small>${t('mvp')}: ${tk('u_' + mvp[0])}</small></div>` : ''}
  </div>`;
}

function logUnitStats(b: Battle) {
  track('unit_spawned', { level: b.level.index, ...b.producedCounts });
}

function onBattleEnd(win: boolean) {
  const b = battle;
  if (!b) return;
  hudRefs?.hint?.remove();
  tutorialStep = 0;
  if (win) save.tutorialDone = true;
  stopMusic();
  sfx(win ? 'win' : 'lose');
  const L = b.level;
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
      track('level_complete', { level: L.index, kind: 'survival', waves });
      persist();
      $(el, 'h2').innerHTML = `${t('survived')} ${num(waves)} ${t('waves')}${best ? `<div style="font-size:20px;color:var(--ok)">${t('newBest')}</div>` : ''}`;
      $(el, '.result').classList.remove('lose');
      $(el, '.result').insertAdjacentHTML('beforeend', `<div class="loot"><span class="chip gold-chip" style="font-size:20px">🪙 ${num(gold)}</span>${gems ? `<span class="chip" style="font-size:20px">💎 ${num(gems)}</span>` : ''}</div>`);
    }
    return;
  }
  if (L.kind === 'challenge' || L.kind === 'daily') return onSpecialWin(b);

  const stars = b.stars(true);
  const prev = save.stars[L.index] ?? 0;
  const firstClear = prev === 0;
  let gold = Math.round(L.reward * (firstClear ? 1 : 0.6) * DIFFICULTY[save.difficulty].reward);
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

  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result col" style="align-items:center">
    <h2>${t('victory')}</h2>
    <div class="big-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
    <div class="loot"><span class="chip gold-chip" style="font-size:22px">🪙 <b data-r="g">${num(gold)}</b></span>${gems ? `<span class="chip" style="font-size:22px">💎 ${num(gems)}</span>` : ''}</div>
    ${statsHtml(b)}
    <button class="btn ad" data-a="double">${t('doubleAd')}</button>
    <div class="row"><button class="btn" data-a="next">${t('next')} ${getLang() === 'ar' ? '◀' : '▶'}</button><button class="btn secondary" data-a="menu">${t('campaign')}</button></div>
  </div></div>`);
  ui.appendChild(el);
  el.querySelector('[data-a="double"]')!.addEventListener('click', async (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    await showAd('rewarded', 'double_loot');
    save.gold += gold;
    gold *= 2;
    $(el, '[data-r="g"]').textContent = num(gold);
    sfx('coin');
    persist();
  });
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

function backTo(L: LevelDef) {
  if (L.kind === 'challenge') showChallenges();
  else if (L.kind === 'survival' || L.kind === 'daily') showModes();
  else showCampaign();
}

function onSpecialWin(b: Battle) {
  const L = b.level;
  let gold = 0, gems = 0;
  let unlocked: string[] = [];
  if (L.kind === 'challenge') {
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
  gold = Math.round(gold * DIFFICULTY[save.difficulty].reward);
  save.gold += gold; save.gems += gems;
  rolloverDaily(); save.quests.wins++;
  track('level_complete', { level: L.index, kind: L.kind, id: L.id, seconds: Math.round(b.time) });
  persist();
  const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result col" style="align-items:center">
    <h2>${t('victory')} ${L.kind === 'challenge' ? '🏆' : ''}</h2>
    <div class="loot"><span class="chip gold-chip" style="font-size:22px">🪙 ${num(gold)}</span>${gems ? `<span class="chip" style="font-size:22px">💎 ${num(gems)}</span>` : ''}</div>
    ${statsHtml(b)}
    ${unlocked.length ? `<div class="unlock-box"><div style="font-weight:900;color:var(--gold2)">✨ ${t('newUnlock')}</div>${unlocked.map((k) => `<div>${unlockIcon(k)} ${unlockName(k)}</div>`).join('')}</div>` : ''}
    <div class="row">${unlocked.length ? `<button class="btn" data-a="shop">🛒 ${t('shop')}</button>` : ''}<button class="btn secondary" data-a="back">${t('continue')}</button></div>
  </div></div>`);
  ui.appendChild(el);
  el.querySelector('[data-a="shop"]')?.addEventListener('click', () => { stopBattleLoop(); showShop(unlocked.some((k) => k in UNITS) ? 'units' : unlocked.some((k) => k in ABILITIES) ? 'skills' : 'passives'); });
  el.querySelector('[data-a="back"]')!.addEventListener('click', () => { stopBattleLoop(); flushEvents(); backTo(L); });
}

// ---------------- boot ----------------
function onResize() { renderer.resize(); if (battle) renderer.clampCam(); else drawIdle(); }
function drawIdle() { /* menus use CSS backgrounds */ const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); }
addEventListener('resize', onResize);
rolloverDaily();
applySettings();
onResize();
showMenu();
void initCloud(() => { applySettings(); if (!battle) showMenu(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && battle && !battle.over && !battle.paused) pauseMenu();
});
// Dev-only hook for automated UI tests.
if (import.meta.env.DEV) (window as unknown as { __sw: unknown }).__sw = { get battle() { return battle; }, save, startBattle, startLevel, challengeLevel, challengeById, survivalLevel, showShop, showModes, showChallenges };

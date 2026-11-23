import './style.css';
import { t, tk, setLang, getLang, num, type Key } from './i18n';
import { save, persist, initCloud, track, rolloverDaily, cloudOnline, flushEvents } from './save';
import { UNITS, PLAYER_UNITS, MAX_UNIT_LEVEL, upgradeCost, upgradeMult, type UnitId } from './data/units';
import { LEVELS, REGIONS, type RegionId } from './data/levels';
import { Battle, W } from './game/battle';
import { Renderer } from './game/render';
import { sfx, setSound, startMusic, stopMusic, unlockAudio } from './game/audio';

const ui = document.getElementById('ui')!;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const icons = Object.fromEntries(PLAYER_UNITS.map((id) => [id, Renderer.icon(UNITS[id])])) as Record<UnitId, string>;

const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const starsHtml = (n: number) => [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
let lastRewardedAd = 0;

function applySettings() {
  setLang(save.lang);
  setSound(save.sound);
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
  startMusic('menu');
  const el = h(`<div class="screen">
    ${topbar(false)}
    <div class="menu-main">
      <img class="menu-art" src="icon.svg" alt="">
      <div class="col" style="align-items:center">
        <div class="title">${t('title')}</div>
        <div style="margin:-6px 0 14px;color:var(--sand2);font-weight:700">${t('tagline')}</div>
        <div class="menu-buttons">
          <button class="btn play" data-go="play">${t('play')} · ${t('level')} ${num(save.unlocked)}</button>
          <button class="btn secondary" data-go="campaign">🗺️ ${t('campaign')}</button>
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
    if (go === 'campaign') showCampaign();
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
    <div class="cards">${PLAYER_UNITS.map((id) => {
      const d = UNITS[id];
      const lvl = save.unitLevels[id];
      const locked = save.unlocked < d.unlock;
      const cost = upgradeCost(lvl);
      const m = upgradeMult(lvl);
      return `<div class="card ${locked ? 'locked' : ''}">
        <img src="${icons[id]}" alt="">
        <div class="meta">
          <div class="name">${tk('u_' + id)} <span style="color:var(--gold2)">Lv ${num(lvl)}</span></div>
          <div class="stat">${t('hp')} ${num(Math.round(d.hp * m))} · ${t('dmg')} ${num(Math.round(d.dmg * m))}</div>
          ${locked ? `<div class="stat">🔒 ${t('unlocksAt')} ${num(d.unlock)}</div>` : ''}
        </div>
        ${locked ? '' : lvl >= MAX_UNIT_LEVEL ? `<span class="chip">${t('max')}</span>` :
        `<button class="btn small" data-up="${id}" ${save.gold < cost ? 'disabled' : ''}>🪙 ${num(cost)}</button>`}
      </div>`;
    }).join('')}</div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-up]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.up as UnitId;
    const cost = upgradeCost(save.unitLevels[id]);
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
  const el = h(`<div class="screen">
    ${topbar()}
    <div class="grow" style="display:flex;align-items:center;justify-content:center">
      <div class="panel col" style="min-width:320px">
        <div class="row"><b class="grow">${t('language')}</b>
          <button class="btn small ${save.lang === 'ar' ? '' : 'secondary'}" data-lang="ar">العربية</button>
          <button class="btn small ${save.lang === 'en' ? '' : 'secondary'}" data-lang="en">English</button></div>
        <div class="row"><b class="grow">${t('sound')}</b>
          <button class="btn small" data-a="sound">${save.sound ? t('on') : t('off')}</button></div>
        <div class="row"><b class="grow">${t('cloud')}</b><span class="chip">${cloudOnline ? '☁️ ' + t('cloudOk') : '📱 ' + t('cloudOff')}</span></div>
        <div style="font-size:12px;color:var(--muted)">v0.1.0 · prototype</div>
      </div>
    </div>
  </div>`);
  el.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { save.lang = b.dataset.lang as 'ar' | 'en'; persist(); applySettings(); showSettings(); }));
  el.querySelector('[data-a="sound"]')!.addEventListener('click', () => { save.sound = !save.sound; persist(); setSound(save.sound); if (save.sound) startMusic('menu'); showSettings(); });
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
      <button class="btn" data-a="go" style="font-size:22px;min-width:200px">⚔️ ${t('play')}</button>
      <button class="btn ad" data-a="boost" ${left ? '' : 'disabled'}>${t('boostAd')} (${num(left)})</button>
      <button class="btn secondary small" data-a="cancel">${t('back')}</button>
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
  mount(el);
}

// ---------------- Battle ----------------
let battle: Battle | null = null;
let raf = 0;
let lastT = 0;
let hudRefs: { gold: HTMLElement; time: HTMLElement; btns: Record<string, HTMLElement>; ability: HTMLElement; mini: HTMLElement; view: HTMLElement; hint: HTMLElement | null; ctrl: HTMLElement; pads: HTMLElement[]; modes: Record<string, HTMLElement> } | null = null;
let tutorialStep = 0;

function stopBattleLoop() { cancelAnimationFrame(raf); battle = null; }

function startBattle(index: number, bonusGold: number) {
  const L = LEVELS[index - 1];
  stopBattleLoop();
  startMusic(L.boss ? 'boss' : 'battle');
  track('level_start', { level: index, bonus_gold: bonusGold });
  battle = new Battle(L, save.unitLevels, 150 + bonusGold, {
    onEnd: (win) => setTimeout(() => onBattleEnd(win), 900),
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
  if (L.boss) ui.appendChild(h(`<div class="boss-banner">👑 ${tk('b_' + L.region)}</div>`));
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
  const unlockedUnits = PLAYER_UNITS.filter((id) => UNITS[id].unlock <= Math.max(b.level.index, save.unlocked));
  const el = h(`<div class="hud">
    <div class="hud-top">
      <span class="chip gold-chip" style="font-size:20px"><span class="ico">🪙</span><b data-r="gold">0</b></span>
      <span class="chip">⏱ <b data-r="time">0:00</b></span>
      <div class="minimap" data-r="mini"><div class="view" data-r="view"></div></div>
      <span class="chip">${b.level.boss ? '👑' : ''} ${t('level')} ${num(b.level.index)}</span>
      <button class="btn secondary small" data-a="pause" aria-label="pause">II</button>
    </div>
    <div class="hud-bottom">
      <div class="units">${PLAYER_UNITS.map((id) => `<button class="ubtn ${unlockedUnits.includes(id) ? '' : 'locked'}" data-u="${id}" aria-label="${tk('u_' + id)}">
        <span class="qn" style="display:none"></span><img src="${icons[id]}" alt=""><span class="cost">${num(UNITS[id].cost)}</span><span class="prog"></span></button>`).join('')}</div>
      <div class="grow"></div>
      <button class="cbtn" data-a="ctrl" title="${t('control')}">🎯</button>
      <div class="modes">
        <button class="mbtn" data-m="attack">⚔ ${t('attack')}</button>
        <button class="mbtn" data-m="hold">⛺ ${t('hold')}</button>
        <button class="mbtn on" data-m="defend">🛡 ${t('defend')}</button>
      </div>
      <button class="abtn" data-a="ability" title="${t('a_volley')}">🏹</button>
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
  for (const id of PLAYER_UNITS) {
    const btn = r.btns[id];
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
  battle.update(dt);
  renderer.autoCam(battle, dt);
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
    if (battle) track('level_fail', { level: battle.level.index, reason: 'quit', seconds: Math.round(battle.time) });
    showCampaign(); stopBattleLoop();
  });
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
    const canRevive = !b.revived;
    const el = h(`<div class="screen dim" style="z-index:20"><div class="panel result lose col" style="align-items:center">
      <h2>${t('defeat')}</h2>
      ${canRevive ? `<button class="btn ad" data-a="revive">${t('reviveAd')}</button>` : ''}
      <div class="row"><button class="btn" data-a="retry">${t('retry')}</button><button class="btn secondary" data-a="upg">⚔️ ${t('upgrades')}</button><button class="btn secondary" data-a="menu">${t('back')}</button></div>
    </div></div>`);
    ui.appendChild(el);
    const fail = () => { logUnitStats(b); track('level_fail', { level: L.index, seconds: Math.round(b.time), revived: b.revived }); persist(); };
    el.querySelector('[data-a="revive"]')?.addEventListener('click', async () => {
      await showAd('rewarded', 'revive');
      el.remove();
      b.revive();
      startMusic(L.boss ? 'boss' : 'battle');
      lastT = performance.now();
    });
    el.querySelector('[data-a="retry"]')!.addEventListener('click', () => { fail(); startBattle(L.index, 0); });
    el.querySelector('[data-a="upg"]')!.addEventListener('click', () => { fail(); showUpgrades(); stopBattleLoop(); });
    el.querySelector('[data-a="menu"]')!.addEventListener('click', () => { fail(); showCampaign(); stopBattleLoop(); });
    return;
  }

  const stars = b.stars(true);
  const prev = save.stars[L.index] ?? 0;
  const firstClear = prev === 0;
  let gold = Math.round(L.reward * (firstClear ? 1 : 0.6));
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
if (import.meta.env.DEV) (window as unknown as { __sw: unknown }).__sw = { get battle() { return battle; }, save, startBattle };

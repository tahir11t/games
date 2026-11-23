export type Lang = 'ar' | 'en';

const S = {
  title: { ar: 'حرب الرمال', en: 'Sand Wars' },
  tagline: { ar: 'ابنِ جيشك واهدم حصن العدو', en: 'Build your army. Topple the enemy fort.' },
  play: { ar: 'العب', en: 'Play' },
  campaign: { ar: 'الحملة', en: 'Campaign' },
  upgrades: { ar: 'الترقيات', en: 'Upgrades' },
  daily: { ar: 'المكافآت', en: 'Rewards' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  back: { ar: 'رجوع', en: 'Back' },
  level: { ar: 'المستوى', en: 'Level' },
  defend: { ar: 'دفاع', en: 'Defend' },
  hold: { ar: 'تمركز', en: 'Hold' },
  attack: { ar: 'هجوم', en: 'Attack' },
  control: { ar: 'تحكّم', en: 'Control' },
  release: { ar: 'تحرير', en: 'Release' },
  ability: { ar: 'قدرة القائد', en: 'Commander' },
  victory: { ar: 'نصر!', en: 'Victory!' },
  defeat: { ar: 'هزيمة', en: 'Defeat' },
  continue: { ar: 'متابعة', en: 'Continue' },
  retry: { ar: 'أعد المحاولة', en: 'Retry' },
  next: { ar: 'التالي', en: 'Next' },
  doubleAd: { ar: 'ضاعف الغنائم ×2 (إعلان)', en: 'Double loot ×2 (ad)' },
  reviveAd: { ar: 'أحيِ الحصن 50% (إعلان)', en: 'Revive fort 50% (ad)' },
  boostAd: { ar: '+150 ذهب للبداية (إعلان)', en: '+150 starting gold (ad)' },
  adPlaying: { ar: 'إعلان تجريبي… ستحصل على المكافأة بعد انتهائه', en: 'Test ad… reward granted when it ends' },
  gold: { ar: 'ذهب', en: 'Gold' },
  gems: { ar: 'جواهر', en: 'Gems' },
  stars: { ar: 'نجوم', en: 'Stars' },
  upgrade: { ar: 'ترقية', en: 'Upgrade' },
  max: { ar: 'الأقصى', en: 'Max' },
  locked: { ar: 'مقفل', en: 'Locked' },
  unlocksAt: { ar: 'يُفتح في المستوى', en: 'Unlocks at level' },
  pause: { ar: 'إيقاف', en: 'Pause' },
  resume: { ar: 'استئناف', en: 'Resume' },
  quit: { ar: 'انسحاب', en: 'Quit' },
  language: { ar: 'اللغة', en: 'Language' },
  sound: { ar: 'الصوت', en: 'Sound' },
  on: { ar: 'تشغيل', en: 'On' },
  off: { ar: 'إيقاف', en: 'Off' },
  cloud: { ar: 'الحفظ السحابي', en: 'Cloud save' },
  cloudOk: { ar: 'متصل', en: 'Connected' },
  cloudOff: { ar: 'غير متصل (حفظ محلي)', en: 'Offline (local save)' },
  claim: { ar: 'استلم', en: 'Claim' },
  claimed: { ar: 'تم الاستلام', en: 'Claimed' },
  day: { ar: 'اليوم', en: 'Day' },
  chest: { ar: 'الصندوق المجاني', en: 'Free chest' },
  chestReady: { ar: 'جاهز!', en: 'Ready!' },
  openNowAd: { ar: 'افتح الآن (إعلان)', en: 'Open now (ad)' },
  open: { ar: 'افتح', en: 'Open' },
  quests: { ar: 'المهام اليومية', en: 'Daily quests' },
  starRules: { ar: 'فوز · الحصن فوق 50% · أقل من 3 دقائق', en: 'Win · Fort above 50% · Under 3 min' },
  rotate: { ar: 'أدِر الجهاز للوضع الأفقي', en: 'Rotate your device to landscape' },
  tut1: { ar: 'اضغط السيّاف لتدريب جندي', en: 'Tap the swordsman to train a soldier' },
  tut2: { ar: 'اضغط «هجوم» ليتقدّم جيشك', en: 'Tap “Attack” to march forward' },
  tut3: { ar: 'اهدم حصن العدو!', en: 'Destroy the enemy fort!' },
  time: { ar: 'الوقت', en: 'Time' },
  fort: { ar: 'الحصن', en: 'Fort' },
  // units
  u_miner: { ar: 'عامل المنجم', en: 'Miner' },
  u_sword: { ar: 'السيّاف', en: 'Swordsman' },
  u_archer: { ar: 'الرامي', en: 'Archer' },
  u_spear: { ar: 'حامل الرمح', en: 'Spearman' },
  u_camel: { ar: 'فارس الجمل', en: 'Camel Rider' },
  u_catapult: { ar: 'المنجنيق', en: 'Catapult' },
  // regions
  r_oasis: { ar: 'واحة النخيل', en: 'Palm Oasis' },
  r_dunes: { ar: 'الكثبان الحمراء', en: 'Red Dunes' },
  r_mountains: { ar: 'الجبال الصخرية', en: 'Rocky Mountains' },
  r_shadow: { ar: 'مدينة الظلال', en: 'City of Shadows' },
  b_oasis: { ar: 'زعيم اللصوص', en: 'Bandit Chief' },
  b_dunes: { ar: 'العقرب العملاق', en: 'Giant Scorpion' },
  b_mountains: { ar: 'ملك الجبل', en: 'Mountain King' },
  b_shadow: { ar: 'سيّد الظلال', en: 'Shadow Lord' },
  // abilities
  a_volley: { ar: 'وابل السهام', en: 'Arrow Volley' },
  q_win2: { ar: 'افُز بمعركتين', en: 'Win 2 battles' },
  q_archers: { ar: 'درّب 20 رامياً', en: 'Train 20 archers' },
  q_units: { ar: 'درّب 50 وحدة', en: 'Train 50 units' },
  hp: { ar: 'صحة', en: 'HP' },
  dmg: { ar: 'ضرر', en: 'DMG' },
} as const;

export type Key = keyof typeof S;

let lang: Lang = 'ar';
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
}
export const t = (k: Key) => S[k][lang];
export const tk = (k: string) => (S as Record<string, Record<Lang, string>>)[k]?.[lang] ?? k;
export const num = (n: number) => (lang === 'ar' ? n.toLocaleString('ar-EG') : n.toLocaleString('en-US'));

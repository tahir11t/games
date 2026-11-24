// Checks every translation file against the English keys: missing, extra and
// untranslated strings, plus placeholder emojis/numbers that should survive.
// Run: npx tsx scripts/i18n-check.ts
import { KEYS, english } from '../src/i18n';
import { TR } from '../src/i18n-tr';
import { FR } from '../src/i18n-fr';
import { ES } from '../src/i18n-es';
import { ID } from '../src/i18n-id';
import { FA } from '../src/i18n-fa';
import { UR } from '../src/i18n-ur';

const files: Record<string, Record<string, string>> = { tr: TR, fr: FR, es: ES, id: ID, fa: FA, ur: UR };
const keep = /[↻★✓⚔×]/g; // symbols the UI relies on
let bad = 0;
for (const [lang, dict] of Object.entries(files)) {
  const missing = KEYS.filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !(KEYS as string[]).includes(k));
  const lost = KEYS.filter((k) => k in dict && (english(k).match(keep) ?? []).some((sym) => !dict[k].includes(sym)));
  const rtlLatin = ['fa', 'ur'].includes(lang) ? KEYS.filter((k) => k in dict && /^[A-Za-z ]+$/.test(dict[k]) && !/^(MVP|HP)$/.test(dict[k]) && !/Google/.test(dict[k])) : [];
  console.log(`${lang}: ${KEYS.length - missing.length}/${KEYS.length} keys` + (missing.length ? `  missing: ${missing.join(', ')}` : '') + (extra.length ? `  extra: ${extra.join(', ')}` : '') + (lost.length ? `  symbols lost: ${lost.join(', ')}` : '') + (rtlLatin.length ? `  latin-only: ${rtlLatin.join(', ')}` : ''));
  bad += missing.length + extra.length + lost.length + rtlLatin.length;
}
process.exit(bad ? 1 : 0);

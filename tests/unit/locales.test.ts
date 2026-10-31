import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../src/shared/i18n';

const root = resolve(import.meta.dirname, '..', '..');
const LOCALE_DIR = resolve(root, 'public/_locales');
type Messages = Record<string, { message: string }>;
const load = (lang: string) => JSON.parse(readFileSync(resolve(LOCALE_DIR, lang, 'messages.json'), 'utf8')) as Messages;
const locales = readdirSync(LOCALE_DIR).sort();
const en = load('en');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|html)$/.test(name)) out.push(p);
  }
  return out;
}

function usedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of [...files(resolve(root, 'entrypoints')), ...files(resolve(root, 'src'))]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt\('([A-Za-z0-9_]+)'(?!\s*\+)/g)) keys.add(m[1]);
    for (const m of text.matchAll(/\btParts\('([A-Za-z0-9_]+)'/g)) keys.add(m[1]);
    for (const m of text.matchAll(/data-i18n(?:-title|-placeholder|-tip)?="([A-Za-z0-9_]+)"/g)) keys.add(m[1]);
    for (const m of text.matchAll(/(?:label|tip|title|desc|note): '([A-Za-z0-9_]+)'/g)) keys.add(m[1]);
  }
  // Keys built at run time from a prefix and an id.
  for (const c of ['clickfix', 'malware', 'c2', 'phishing']) keys.add('category_' + c).add('rep_' + c).add('rep_' + c + '_family');
  for (const k of ['clipboard', 'manual_copy', 'paste', 'protocol', 'fullscreen', 'page_instructions', 'web3_loader', 'reputation', 'reputation_block']) keys.add('kind_' + k);
  for (const a of ['blocked', 'warned', 'copied_anyway', 'continued', 'trusted']) keys.add('action_' + a);
  for (const s of ['powershell', 'applescript', 'terminal', 'script', 'cmd', 'windows', 'generic']) keys.add('what_' + s).add('what_' + s + '_hidden');
  for (const e of ['download_run', 'disables_av', 'password', 'remote_share', 'remote_script', 'remote_install', 'dns', 'finger', 'runs']) keys.add('effect_' + e);
  for (const l of ['captcha', 'update', 'fix']) keys.add('lure_' + l);
  for (const g of ['explorer', 'terminal', 'run', 'paste']) keys.add('target_' + g);
  for (const p of ['applescript', 'search_ms', 'ms_msdt', 'ms_officecmd', 'ms_appinstaller']) keys.add('proto_' + p);
  return keys;
}

const placeholders = (s: string) => [...new Set(s.match(/\$\d/g) ?? [])].sort().join();

describe('translations', () => {
  it('every language in the picker has a locale folder and the other way round', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(locales);
  });
  it('every key used in the code exists in English', () => {
    for (const key of usedKeys()) expect(en[key], key).toBeDefined();
  });
  for (const lang of locales) {
    describe(lang, () => {
      const msgs = load(lang);
      it('has exactly the English keys', () => {
        expect(Object.keys(msgs).sort()).toEqual(Object.keys(en).sort());
      });
      it('keeps every placeholder', () => {
        for (const key of Object.keys(en)) expect(placeholders(msgs[key]?.message ?? ''), `${lang} ${key}`).toBe(placeholders(en[key].message));
      });
      it('fits the store limits', () => {
        expect(msgs.extName.message).toBe('ClickFix Warden');
        expect(msgs.extDescription.message.length).toBeLessThanOrEqual(132);
      });
      it('never puts two placeholders side by side, Chrome reads "$2$" as a named one and refuses to load', () => {
        for (const [key, v] of Object.entries(msgs)) expect(v.message, `${lang} ${key}`).not.toMatch(/\$[A-Za-z0-9_@]+\$/);
      });
      it('has no semicolons, long dashes or empty texts', () => {
        for (const [key, v] of Object.entries(msgs)) {
          expect(v.message, `${lang} ${key}`).not.toMatch(/[;–—]/);
          expect(v.message.trim().length, `${lang} ${key}`).toBeGreaterThan(0);
        }
      });
    });
  }
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..', '..');
const load = (lang: string) => JSON.parse(readFileSync(resolve(root, `public/_locales/${lang}/messages.json`), 'utf8')) as Record<string, { message: string }>;
const en = load('en');
const bg = load('bg');

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
    for (const m of text.matchAll(/data-i18n(?:-title|-placeholder|-tip)?="([A-Za-z0-9_]+)"/g)) keys.add(m[1]);
    for (const m of text.matchAll(/(?:label|tip): '([A-Za-z0-9_]+)'/g)) keys.add(m[1]);
  }
  // Keys built at run time from a prefix and an id.
  for (const c of ['clickfix', 'malware', 'c2', 'phishing']) keys.add('category_' + c);
  for (const k of ['clipboard', 'manual_copy', 'paste', 'protocol', 'fullscreen', 'page_instructions', 'web3_loader', 'reputation', 'reputation_block']) keys.add('kind_' + k);
  for (const a of ['blocked', 'warned', 'copied_anyway', 'continued', 'trusted']) keys.add('action_' + a);
  for (const s of ['powershell', 'applescript', 'terminal', 'script', 'cmd', 'windows', 'generic']) keys.add('what_' + s).add('what_' + s + '_hidden');
  for (const e of ['download_run', 'disables_av', 'password', 'remote_share', 'remote_script', 'remote_install', 'dns', 'finger', 'runs']) keys.add('effect_' + e);
  for (const l of ['captcha', 'update', 'fix']) keys.add('lure_' + l);
  for (const g of ['explorer', 'terminal', 'run', 'paste']) keys.add('target_' + g);
  for (const c of ['clickfix', 'malware', 'c2', 'phishing']) keys.add('rep_' + c).add('rep_' + c + '_family');
  for (const k of ['titleClipboard', 'titleManual', 'titlePaste', 'titleProtocol', 'titleFullscreen', 'descClipboardA', 'descClipboardB', 'descNote', 'descManualA', 'descManualB', 'descManualNote', 'descPasteA', 'descPasteB', 'descProtocolA', 'descFullscreenA', 'descStoppedB', 'descFullscreenNote']) keys.add(k);
  return keys;
}

describe('translations', () => {
  it('English and Bulgarian have the same keys', () => {
    expect(Object.keys(bg).sort()).toEqual(Object.keys(en).sort());
  });
  it('every key used in the code exists', () => {
    for (const key of usedKeys()) {
      expect(en[key], `en ${key}`).toBeDefined();
      expect(bg[key], `bg ${key}`).toBeDefined();
    }
  });
  it('store limits are respected', () => {
    for (const lang of [en, bg]) {
      expect(lang.extName.message.length).toBeLessThanOrEqual(75);
      expect(lang.extDescription.message.length).toBeLessThanOrEqual(132);
    }
  });
  it('no semicolons or long dashes in the interface text', () => {
    for (const lang of [en, bg]) for (const [key, v] of Object.entries(lang)) expect(v.message, key).not.toMatch(/[;–—]/);
  });
  it('placeholders match between languages', () => {
    for (const key of Object.keys(en)) {
      const count = (s: string) => (s.match(/\$\d/g) ?? []).sort().join();
      expect(count(bg[key].message), key).toBe(count(en[key].message));
    }
  });
});

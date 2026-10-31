import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const locale = { lang: 'en' };
const LOCALES = readdirSync(resolve(import.meta.dirname, '..', '..', 'public/_locales'));
const messages = (lang: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', `public/_locales/${lang}/messages.json`), 'utf8')) as Record<string, { message: string }>;

// The warnings are built with browser.i18n, so the test reads the real message files.
vi.mock('wxt/browser', () => ({
  browser: {
    i18n: {
      getMessage: (key: string, subs?: string | string[]) => {
        const all = messages(locale.lang);
        let text = all[key]?.message ?? '';
        const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
        list.forEach((s, i) => (text = text.split(`$${i + 1}`).join(s)));
        return text;
      },
      getUILanguage: () => locale.lang,
    },
  },
}));

const { evaluateCommand } = await import('../../src/engine/score');
const { BUNDLED_RULES } = await import('../../src/engine/rules');
const { scorePageText } = await import('../../src/engine/page');
const { whatOfCommand, whyOfCommand, whatOfReport } = await import('../../src/ui/explain');
const { LURES } = await import('./samples');

function explain(cmd: string, pageText = '', trigger: 'captcha' | null = null) {
  const page = scorePageText(pageText, BUNDLED_RULES);
  const v = evaluateCommand(cmd, BUNDLED_RULES, { pageScore: page.score, pageReasons: page.reasons, trigger });
  return { what: whatOfCommand(v.reasons), why: whyOfCommand(v.reasons) };
}

describe('warning sentences', () => {
  it('describes the fake reCAPTCHA PowerShell lure', () => {
    locale.lang = 'en';
    const e = explain(LURES['powershell hidden with fake recaptcha id'], 'Press Windows Key + R, press CTRL + V', 'captcha');
    expect(e.what).toBe('a hidden PowerShell command that downloads and runs a program');
    expect(e.why).toBe('the page pretends to be a CAPTCHA and tells you to paste it into the Run box');
  });
  it('builds complete sentences in every language', () => {
    for (const lang of LOCALES) {
      locale.lang = lang;
      const e = explain(LURES['powershell hidden with fake recaptcha id'], 'Press Windows Key + R, press CTRL + V', 'captcha');
      for (const text of [e.what, e.why]) {
        expect(text, lang).not.toMatch(/\$\d|what_|effect_|lure_|target_|whyPage/);
        expect(text.length, lang).toBeGreaterThan(5);
      }
    }
    locale.lang = 'en';
  });
  it('names mshta, WebDAV and macOS lures by what they do', () => {
    expect(explain(LURES['mshta with cloudflare decoy']).what).toBe('a hidden script command that runs a script straight from the internet');
    expect(explain(LURES['webdav rundll32']).what).toBe('a Windows command that runs files from a remote network share');
    expect(explain(LURES['osascript password prompt']).what).toBe('an AppleScript command that asks for your password with a fake window');
    expect(explain(LURES['macos base64 into bash']).what).toBe('a Terminal command that downloads and runs a program');
  });
  it('falls back to what is wrong with the command when the page says nothing', () => {
    expect(explain(LURES['filefix padded path']).why).toBe('the real command is hidden behind blank space');
    expect(explain(LURES['mshta with cloudflare decoy']).why).toBe('fake verification text is hidden after the command');
    expect(explain(LURES['filefix padded path'], 'Open File Explorer and select the address bar (Ctrl + L), paste with Ctrl + V').why).toBe(
      'the page tells you to paste it into the File Explorer address bar',
    );
  });
  it('describes a report from the database', () => {
    const rec = { source: 'threatfox' as const, category: 'clickfix' as const, malware: 'ClearFake', firstSeen: '2026-10-20', ref: 'https://threatfox.abuse.ch/ioc/2/', tags: [] };
    expect(whatOfReport([{ key: 'h:x', records: [rec] }])?.what).toBe('a ClickFix page that spreads ClearFake');
    expect(whatOfReport([{ key: 'h:x', records: [{ ...rec, category: 'malware', malware: 'Lumma Stealer' }] }])?.what).toBe('a Lumma Stealer download');
  });
});

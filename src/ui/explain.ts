// Turns the engine's reasons into the two bold phrases of a warning, what was found and why it was stopped.

import type { Reason } from '../engine/types';
import type { FeedHit } from '../feed/types';
import { t } from '../shared/i18n';

type Ids = Set<string>;

function subjectKey(ids: Ids): string {
  if (ids.has('exec-powershell') || ids.has('exec-iex') || ids.has('fetch-ps-web')) return 'powershell';
  if (ids.has('exec-osascript')) return 'applescript';
  if (ids.has('exec-shell') || ids.has('exec-chmod-run') || ids.has('fetch-pipe-shell') || ids.has('fetch-cmd-subst') || ids.has('hall-base64-shell')) return 'terminal';
  if (ids.has('exec-mshta') || ids.has('exec-wscript')) return 'script';
  if (ids.has('exec-cmd')) return 'cmd';
  for (const id of ids) if (id.startsWith('exec-')) return 'windows';
  return 'generic';
}

const HIDDEN = ['hall-hidden-window', 'hall-minimized', 'hall-encoded', 'hall-decoy-comment', 'hall-conhost-headless', 'struct-padding', 'struct-invisible', 'struct-obfuscation', 'struct-homoglyph'];

function effectKey(ids: Ids): string {
  if (ids.has('hall-amsi') || ids.has('hall-defender')) return 'disables_av';
  if (ids.has('hall-osascript-password')) return 'password';
  if (['hall-webdav', 'exec-pushd-unc', 'exec-explorer-unc', 'hall-cmdkey', 'hall-regsvr32-remote', 'hall-rundll32-remote'].some((i) => ids.has(i))) return 'remote_share';
  if (ids.has('hall-mshta-remote')) return 'remote_script';
  if (ids.has('hall-msiexec-remote')) return 'remote_install';
  if (ids.has('hall-dns-exec')) return 'dns';
  if (ids.has('hall-finger-pipe')) return 'finger';
  for (const id of ids) if (id.startsWith('fetch-')) return 'download_run';
  if (['hall-certutil-download', 'hall-bitsadmin-download', 'hall-base64-shell', 'hall-quarantine'].some((i) => ids.has(i))) return 'download_run';
  return 'runs';
}

/** "a hidden PowerShell command that downloads and runs a program" */
export function whatOfCommand(reasons: Reason[]): string {
  const ids = new Set(reasons.map((r) => r.id));
  const hidden = HIDDEN.some((i) => ids.has(i));
  const subject = t(`what_${subjectKey(ids)}${hidden ? '_hidden' : ''}`);
  return t('whatTemplate', [subject, t(`effect_${effectKey(ids)}`)]);
}

function pageWhy(ids: Ids): string | null {
  let lure: string | null = null;
  if (ids.has('trigger-captcha') || ids.has('page-verify-human')) lure = 'captcha';
  else if (ids.has('page-fake-update')) lure = 'update';
  else if (ids.has('trigger-fix') || ids.has('page-fix')) lure = 'fix';
  let target: string | null = null;
  if (ids.has('page-filefix')) target = 'explorer';
  else if (ids.has('page-mac-terminal') || ids.has('page-open-terminal') || ids.has('page-win-x')) target = 'terminal';
  else if (ids.has('page-win-r') || ids.has('page-run-dialog')) target = 'run';
  else if (ids.has('page-paste')) target = 'paste';
  if (lure && target) return t('whyPage2', [t(`lure_${lure}`), t(`target_${target}`)]);
  if (lure) return t('whyPage1', t(`lure_${lure}`));
  if (target) return t('whyPage1', t(`target_${target}`));
  return null;
}

/** "the page pretends to be a CAPTCHA and tells you to paste it into the Run box" */
export function whyOfCommand(reasons: Reason[]): string {
  const ids = new Set(reasons.map((r) => r.id));
  const page = pageWhy(ids);
  if (page) return page;
  if (ids.has('payload-reported')) return t('why_payload_reported');
  if (ids.has('page-reported')) return t('why_site_reported');
  if (ids.has('hall-decoy-comment') || ids.has('hall-decoy-phrase')) return t('why_decoy');
  if (ids.has('struct-padding')) return t('why_padding');
  if (['struct-obfuscation', 'struct-homoglyph', 'struct-invisible', 'hall-encoded'].some((i) => ids.has(i))) return t('why_disguised');
  if (ids.has('hall-hidden-window') || ids.has('hall-conhost-headless') || ids.has('hall-minimized')) return t('why_hidden_window');
  return t('why_generic');
}

/** Why a fake update screen was stopped, from the page instructions alone. */
export function whyOfPage(reasons: Reason[]): string {
  return pageWhy(new Set(reasons.map((r) => r.id))) ?? t('why_fullscreen');
}

/** "a ClickFix page that spreads ClearFake" or "a Lumma Stealer download" */
export function whatOfReport(hits: FeedHit[]): { source: string; what: string; firstSeen: string; ref: string } | null {
  const records = hits.flatMap((h) => h.records);
  if (!records.length) return null;
  const order = ['clickfix', 'malware', 'c2', 'phishing'];
  records.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const r = records[0];
  const family = r.malware && r.malware.toLowerCase() !== 'clickfix' ? r.malware : '';
  const what = family ? t(`rep_${r.category}_family`, family) : t(`rep_${r.category}`);
  const source = { urlhaus: 'URLhaus', threatfox: 'ThreatFox', feodo: 'Feodo Tracker' }[r.source] ?? r.source;
  return { source, what, firstSeen: r.firstSeen, ref: r.ref };
}

/** "1 October 2026" in the interface language. */
export function longDate(isoDay: string, lang: string): string {
  const d = new Date(isoDay + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

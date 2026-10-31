import { browser } from 'wxt/browser';
import { BUNDLED_RULES, pickRules } from '../../src/engine/rules';
import { type FeedMeta, SOURCE_NAMES, type UpdateState } from '../../src/feed/types';
import { DONATE_URL } from '../../src/shared/constants';
import { localizePage, relativeTime, t } from '../../src/shared/i18n';
import type { Detection, Message, PageStatus } from '../../src/shared/messages';
import { computeEffectiveSettings, isTrusted, saveSettings } from '../../src/shared/settings';

localizePage();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T>(msg: Message) => browser.runtime.sendMessage(msg) as Promise<T>;

async function render(): Promise<void> {
  const eff = await computeEffectiveSettings();
  const enabled = $<HTMLInputElement>('enabled');
  enabled.checked = eff.settings.enabled;
  enabled.disabled = eff.locked || eff.managedKeys.includes('enabled');
  $('offNote').hidden = eff.settings.enabled;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  let host = '';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname;
  } catch {
    // not a web page
  }
  const status = $('status');
  const trust = $<HTMLButtonElement>('trust');
  const reports = $('reports');
  reports.replaceChildren();
  if (!host) {
    $('host').textContent = t('popupNotWebPage');
    status.replaceChildren();
    trust.hidden = true;
  } else {
    $('host').textContent = host;
    const trusted = isTrusted(host, eff.settings);
    const page = await send<PageStatus>({ type: 'page-status', url });
    const pill = document.createElement('span');
    if (trusted) {
      pill.className = 'pill neutral';
      pill.textContent = t('popupTrusted');
    } else if (page?.hits?.length) {
      pill.className = 'pill bad';
      pill.textContent = t('popupReported');
      reports.hidden = false;
      for (const hit of page.hits)
        for (const r of hit.records) {
          const li = document.createElement('li');
          li.textContent = [SOURCE_NAMES[r.source], t('category_' + r.category), r.malware, r.firstSeen].filter(Boolean).join(', ');
          reports.append(li);
        }
    } else {
      pill.className = 'pill ok';
      pill.textContent = t('popupNoReports');
    }
    status.replaceChildren(pill);
    trust.hidden = eff.locked;
    trust.textContent = trusted ? t('popupUntrust') : t('popupTrust');
    trust.title = trusted ? t('tipUntrust') : t('tipTrust');
    trust.onclick = async () => {
      await send({ type: trusted ? 'untrust-site' : 'trust-site', host });
      setTimeout(render, 150);
    };
  }

  const { feedMeta, updateState, rules } = (await browser.storage.local.get(['feedMeta', 'updateState', 'rules'])) as {
    feedMeta?: FeedMeta;
    updateState?: UpdateState;
    rules?: unknown;
  };
  $('feedLine').textContent = feedMeta
    ? t('popupFeedLine', [String(feedMeta.count), relativeTime(feedMeta.generated)])
    : updateState?.lastError
      ? t('popupFeedError')
      : t('popupFeedNone');
  $('feedLine').title = feedMeta ? feedMeta.sources.map((s) => `${SOURCE_NAMES[s.id] ?? s.name}: ${s.count}`).join(', ') : updateState?.lastError ?? '';
  const active = pickRules(rules);
  $('rulesLine').textContent = t('popupRulesLine', [String(active.version), active === BUNDLED_RULES ? t('popupRulesBundled') : t('popupRulesUpdated')]);

  const { log } = (await browser.storage.local.get('log')) as { log?: Detection[] };
  const recent = $('recent');
  recent.replaceChildren();
  const items = (log ?? []).filter((d) => d.action !== 'trusted').slice(0, 3);
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = t('popupNoDetections');
    recent.append(li);
  }
  for (const d of items) {
    const li = document.createElement('li');
    const what = document.createElement('div');
    what.textContent = `${t('kind_' + d.kind.replace(/-/g, '_'))}, ${d.host}`;
    const when = document.createElement('div');
    when.className = 'muted';
    when.textContent = `${t('action_' + d.action.replace(/-/g, '_'))}, ${relativeTime(d.time)}`;
    li.append(what, when);
    recent.append(li);
  }
}

$<HTMLInputElement>('enabled').addEventListener('change', async (e) => {
  await saveSettings({ enabled: (e.target as HTMLInputElement).checked });
  setTimeout(render, 150);
});
$('update').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('update');
  btn.disabled = true;
  btn.textContent = t('popupUpdating');
  await send({ type: 'update-now' });
  btn.disabled = false;
  btn.textContent = t('popupUpdate');
  void render();
});
$('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  void browser.runtime.openOptionsPage();
  window.close();
});
$('openHistory').addEventListener('click', (e) => {
  e.preventDefault();
  void browser.tabs.create({ url: browser.runtime.getURL('/options.html') + '#history' });
  window.close();
});
if (DONATE_URL) {
  const donate = $<HTMLAnchorElement>('donate');
  donate.hidden = false;
  donate.href = DONATE_URL;
  donate.target = '_blank';
  donate.rel = 'noopener noreferrer';
}

void render();

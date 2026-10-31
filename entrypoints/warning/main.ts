import { browser } from 'wxt/browser';
import type { FeedHit } from '../../src/feed/types';
import { loadI18nOverride, localizePage, t, tParts, uiLang } from '../../src/shared/i18n';
import type { Message } from '../../src/shared/messages';
import { longDate, whatOfReport } from '../../src/ui/explain';
import { confirmDialog, el, warnIcon } from '../../src/ui/graphite';
import { addPageParts } from '../../src/ui/page-parts';

addPageParts();

const target = new URLSearchParams(location.search).get('u') ?? '';
const send = (msg: Message) => browser.runtime.sendMessage(msg);
let host = '';
try {
  host = new URL(target).hostname;
} catch {
  host = target;
}

document.getElementById('iconbox')!.append(warnIcon(document, 30));
const urlBox = document.getElementById('url')!;
urlBox.textContent = target;
urlBox.title = target;

async function render(): Promise<void> {
  const hits = ((await send({ type: 'lookup-url', url: target })) ?? []) as FeedHit[];
  const rep = whatOfReport(hits);
  const lead = document.getElementById('lead')!;
  const strong = (s: string) => el(document, 'strong', undefined, s);
  if (rep) lead.append(...tParts('warnLead', [strong(host), rep.source, strong(rep.what), strong(t('warnSteals'))]));
  else lead.append(...tParts('warnLeadUnknown', [strong(host), strong(t('warnSteals'))]));

  const row = document.getElementById('reports')!;
  row.append(el(document, 'span', 'key', t('warnReportedBy')));
  const val = el(document, 'span', 'val');
  if (rep) {
    const r = hits.flatMap((h) => h.records).find((x) => x.ref === rep.ref);
    const bits = [rep.source, t('category_' + (r?.category ?? 'malware')), r?.malware ?? ''].filter(Boolean);
    if (rep.firstSeen) bits.push(t('bannerFirstSeen', longDate(rep.firstSeen, uiLang())));
    val.textContent = bits.join(', ');
  }
  row.append(val);
  if (rep && /^https:\/\/(urlhaus|threatfox|feodotracker)\.abuse\.ch\//.test(rep.ref)) {
    const a = el(document, 'a', undefined, t('bannerDetails'));
    a.href = rep.ref;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    row.append(a);
  }
}

document.getElementById('leave')!.addEventListener('click', () => void send({ type: 'leave-site' }));
document.getElementById('continue')!.addEventListener('click', () => {
  if (!/^https?:\/\//i.test(target)) return;
  document.body.append(
    confirmDialog(document, {
      host,
      reported: true,
      mode: 'open',
      onConfirm: () => void send({ type: 'bypass', url: target }),
    }),
  );
});

void (async () => {
  await loadI18nOverride();
  localizePage();
  await render();
})();
